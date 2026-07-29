import type { PoolClient } from "pg";
import { query } from "@/data-access/db";
import type { AchievementCenterData, AchievementSeries } from "@/lib/achievements/types";

export interface AchievementProgressRow {
  series_id: string;
  series_slug: string;
  series_name: string;
  description: string;
  badge_key: string;
  member_slug: string;
  member_name: string;
  observations: string;
  confirmed_at: Date | string | null;
  unlocked_at: Date | string | null;
}

interface AchievementSummaryRow {
  confirmed_count: string;
  unique_target_count: string;
}

interface UnlockedSeriesRow {
  slug: string;
  name_zh: string;
  unlocked_at: Date | string;
}

const ACHIEVEMENT_GOALS = [1, 3, 5, 10];

function isoDate(value: Date | string | null) {
  return value == null ? null : new Date(value).toISOString();
}

export function assembleAchievementSeries(rows: AchievementProgressRow[]): AchievementSeries[] {
  const seriesById = new Map<string, AchievementSeries>();

  for (const row of rows) {
    let series = seriesById.get(row.series_id);
    if (!series) {
      series = {
        slug: row.series_slug,
        name: row.series_name,
        description: row.description,
        badgeKey: row.badge_key,
        progress: 0,
        total: 0,
        completed: false,
        unlockedAt: isoDate(row.unlocked_at),
        members: [],
      };
      seriesById.set(row.series_id, series);
    }

    const observations = Number(row.observations);
    const permanentlyUnlocked = series.unlockedAt != null;
    series.members.push({
      slug: row.member_slug,
      name: row.member_name,
      confirmed: permanentlyUnlocked || observations > 0,
      confirmedAt: isoDate(row.confirmed_at),
      observations,
    });
  }

  return [...seriesById.values()].map((series) => {
    if (series.unlockedAt) {
      series.members = series.members.map((member) => ({ ...member, confirmed: true }));
    }
    series.total = series.members.length;
    series.progress = series.members.filter((member) => member.confirmed).length;
    series.completed = series.total > 0 && series.progress === series.total;
    if (series.completed && !series.unlockedAt) {
      const latestConfirmation = series.members
        .map((member) => member.confirmedAt)
        .filter((value): value is string => value != null)
        .sort()
        .at(-1);
      series.unlockedAt = latestConfirmation ?? null;
    }
    return series;
  });
}

export async function syncUserAchievementUnlocks(
  userId: number,
  client?: Pick<PoolClient, "query">,
): Promise<Array<{ slug: string; name: string; unlockedAt: string }>> {
  const execute = client
    ? client.query.bind(client)
    : async (text: string, params: unknown[]) => ({ rows: await query<UnlockedSeriesRow>(text, params) });
  const result = await execute(
    `INSERT INTO user_achievement_unlocks AS inserted_unlock (user_id, series_id, unlocked_at)
     SELECT $1, series.id, MAX(records.confirmed_at)
     FROM achievement_series AS series
     JOIN achievement_series_members AS members ON members.series_id = series.id
     JOIN observation_records AS records
       ON records.target_slug = members.target_slug
      AND records.user_id = $1
      AND records.confirmed_at IS NOT NULL
     WHERE series.is_active = true
     GROUP BY series.id
     HAVING COUNT(DISTINCT members.target_slug) = (
       SELECT COUNT(*)
       FROM achievement_series_members AS required_members
       WHERE required_members.series_id = series.id
     )
     ON CONFLICT (user_id, series_id) DO NOTHING
     RETURNING
       (SELECT slug FROM achievement_series WHERE id = inserted_unlock.series_id) AS slug,
       (SELECT name_zh FROM achievement_series WHERE id = inserted_unlock.series_id) AS name_zh,
       inserted_unlock.unlocked_at`,
    [userId],
  );
  return (result.rows as UnlockedSeriesRow[]).map((row) => ({
    slug: row.slug,
    name: row.name_zh,
    unlockedAt: new Date(row.unlocked_at).toISOString(),
  }));
}

export async function loadAchievementCenterData(owner: {
  userId: number | null;
  observerId: string;
  email: string | null;
}): Promise<AchievementCenterData & { nextGoal: number | null }> {
  if (owner.userId != null) await syncUserAchievementUnlocks(owner.userId);
  const ownerCondition = owner.userId != null
    ? "user_id = $1"
    : "observer_id = $1 AND user_id IS NULL";
  const ownerValue = owner.userId ?? owner.observerId;
  const unlockJoin = owner.userId != null
    ? "LEFT JOIN user_achievement_unlocks AS unlocks ON unlocks.series_id = series.id AND unlocks.user_id = $1"
    : "LEFT JOIN user_achievement_unlocks AS unlocks ON FALSE";

  const [summaryRows, progressRows] = await Promise.all([
    query<AchievementSummaryRow>(
      `SELECT COUNT(*)::text AS confirmed_count,
              COUNT(DISTINCT COALESCE(NULLIF(target_slug, ''), target_name))::text AS unique_target_count
       FROM observation_records
       WHERE ${ownerCondition} AND confirmed_at IS NOT NULL`,
      [ownerValue],
    ),
    query<AchievementProgressRow>(
      `SELECT series.id::text AS series_id,
              series.slug AS series_slug,
              series.name_zh AS series_name,
              series.description,
              series.badge_key,
              members.target_slug AS member_slug,
              members.target_name AS member_name,
              COALESCE(observations.observations, 0)::text AS observations,
              observations.confirmed_at,
              unlocks.unlocked_at
       FROM achievement_series AS series
       JOIN achievement_series_members AS members ON members.series_id = series.id
       LEFT JOIN (
         SELECT target_slug, COUNT(*) AS observations, MAX(confirmed_at) AS confirmed_at
         FROM observation_records
         WHERE ${ownerCondition}
           AND confirmed_at IS NOT NULL
           AND target_slug IS NOT NULL
         GROUP BY target_slug
       ) AS observations ON observations.target_slug = members.target_slug
       ${unlockJoin}
       WHERE series.is_active = true
       ORDER BY series.sort_order ASC, members.sort_order ASC, members.id ASC`,
      [ownerValue],
    ),
  ]);

  const summary = summaryRows[0] ?? { confirmed_count: "0", unique_target_count: "0" };
  const confirmedCount = Number(summary.confirmed_count);
  const uniqueTargetCount = Number(summary.unique_target_count);
  const series = assembleAchievementSeries(progressRows);

  return {
    confirmedCount,
    uniqueTargetCount,
    completedSeriesCount: series.filter((item) => item.completed).length,
    totalSeriesCount: series.length,
    nextGoal: ACHIEVEMENT_GOALS.find((goal) => goal > uniqueTargetCount) ?? null,
    account: owner.email ? { email: owner.email } : null,
    series,
  };
}
