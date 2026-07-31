import { apiSuccess } from "@/lib/api-response";
import { query } from "@/data-access/db";
import { upcomingShowers } from "@/lib/astronomy/meteor-showers";
import { assessMeteorVisibility, meteorRadiantForSlug } from "@/lib/astronomy/meteor-visibility";

interface EventRow {
  slug: string;
  name_zh: string;
  name_en: string;
  peak_date: string;
  zhr: number;
  active_start: string;
  active_end: string;
  recommended_time: string | null;
  location_hint: string | null;
  summary: string;
}

function parseCoordinate(value: string | null, min: number, max: number, fallback: number): number {
  if (value == null || value.trim() === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

function addVisibility(
  event: {
    slug: string;
    nameZh: string;
    nameEn: string;
    peakDate: string;
    zhr: number;
    activeStart: string;
    activeEnd: string;
    recommendedTime: string;
    locationHint: string;
    summary: string;
  },
  location: { lat: number; lng: number },
) {
  const visibility = assessMeteorVisibility({
    ...event,
    ...meteorRadiantForSlug(event.slug),
  }, location);
  return { ...event, visibility };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const location = {
    lat: parseCoordinate(searchParams.get("lat"), -90, 90, 39.9),
    lng: parseCoordinate(searchParams.get("lng"), -180, 180, 116.4),
  };
  let events;
  try {
    const rows = await query<EventRow>(
      `SELECT event.slug, event.name_zh, event.name_en,
              to_char(event.peak_date, 'YYYY-MM-DD') AS peak_date,
              event.zhr,
              to_char(event.active_start_date, 'MM-DD') AS active_start,
              to_char(event.active_end_date, 'MM-DD') AS active_end,
              notes.recommended_time_window AS recommended_time,
              notes.ideal_location_type AS location_hint,
              event.summary
       FROM astronomy_events AS event
       LEFT JOIN event_observation_notes AS notes ON notes.event_id = event.id
       WHERE event.event_type = 'meteor_shower'
         AND event.is_active = true
         AND event.active_end_date >= CURRENT_DATE
         AND event.active_start_date <= CURRENT_DATE + INTERVAL '1 year'
       ORDER BY event.peak_date ASC`,
    );
    events = rows.map((event) => addVisibility({
      slug: event.slug,
      nameZh: event.name_zh,
      nameEn: event.name_en,
      peakDate: event.peak_date,
      zhr: event.zhr,
      activeStart: event.active_start,
      activeEnd: event.active_end,
      recommendedTime: event.recommended_time ?? "午夜后至凌晨",
      locationHint: event.location_hint ?? "远离城市灯光的开阔地",
      summary: event.summary,
    }, location));
  } catch {
    events = upcomingShowers().map((event) => addVisibility({
      ...event,
      locationHint: event.locationHint,
      summary: `${event.nameZh}活跃期内均有机会观测，峰值夜更值得关注。`,
    }, location));
  }
  return apiSuccess({ events, location });
}
