import assert from "node:assert/strict";
import test from "node:test";
import { assembleAchievementSeries, type AchievementProgressRow } from "../../lib/achievements/progress";

function row(overrides: Partial<AchievementProgressRow>): AchievementProgressRow {
  return {
    series_id: "1",
    series_slug: "summer-triangle",
    series_name: "夏季大三角",
    description: "test",
    badge_key: "summer_triangle",
    member_slug: "vega",
    member_name: "织女星",
    observations: "0",
    confirmed_at: null,
    unlocked_at: null,
    ...overrides,
  };
}

test("repeated observations count once toward series progress", () => {
  const series = assembleAchievementSeries([
    row({ member_slug: "vega", member_name: "织女星", observations: "3", confirmed_at: "2026-07-27T12:00:00Z" }),
    row({ member_slug: "altair", member_name: "牛郎星", observations: "1", confirmed_at: "2026-07-27T12:10:00Z" }),
    row({ member_slug: "deneb", member_name: "天津四" }),
  ]);

  assert.equal(series[0].progress, 2);
  assert.equal(series[0].total, 3);
  assert.equal(series[0].completed, false);
});

test("the same confirmed star advances every series that contains it", () => {
  const series = assembleAchievementSeries([
    row({ series_id: "2", series_slug: "orion", series_name: "猎户座", badge_key: "orion", member_slug: "rigel", member_name: "参宿七", observations: "1", confirmed_at: "2026-07-27T12:00:00Z" }),
    row({ series_id: "3", series_slug: "winter-hexagon", series_name: "冬季六边形", badge_key: "winter_hexagon", member_slug: "rigel", member_name: "参宿七", observations: "1", confirmed_at: "2026-07-27T12:00:00Z" }),
  ]);

  assert.equal(series.length, 2);
  assert.equal(series[0].progress, 1);
  assert.equal(series[1].progress, 1);
});

test("a persisted unlock remains complete without current observation rows", () => {
  const series = assembleAchievementSeries([
    row({ member_slug: "vega", unlocked_at: "2026-07-27T13:00:00Z" }),
    row({ member_slug: "altair", member_name: "牛郎星", unlocked_at: "2026-07-27T13:00:00Z" }),
    row({ member_slug: "deneb", member_name: "天津四", unlocked_at: "2026-07-27T13:00:00Z" }),
  ]);

  assert.equal(series[0].completed, true);
  assert.equal(series[0].progress, 3);
  assert.ok(series[0].members.every((member) => member.confirmed));
});
