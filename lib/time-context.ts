/**
 * 时间共享上下文 V1 — 离散时间 key ↔ Date 转换
 *
 * timeContext 取值：
 *   "now"     → 当前时间
 *   "plus1h"  → 当前时间 + 1 小时
 *   "late"    → 早于 22:00 取当天 22:00，晚于 22:00 取 +2h
 *   null/undefined → 默认 current time
 */

export type TimeContextKey = "now" | "plus1h" | "late";

export const TIME_CONTEXT_KEYS: TimeContextKey[] = ["now", "plus1h", "late"];

const KEY_LABELS: Record<TimeContextKey, string> = {
  now: "现在",
  plus1h: "1小时后",
  late: "今晚稍晚",
};

export function timeContextLabel(key: TimeContextKey): string {
  return KEY_LABELS[key];
}

/** timeContext → 实际 Date */
export function resolveTimeContext(key: TimeContextKey | string | null): Date {
  const now = new Date();

  if (key === "plus1h") {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }

  if (key === "late") {
    const hour = now.getHours();
    if (hour < 22) {
      const d = new Date(now);
      d.setHours(22, 0, 0, 0);
      return d;
    }
    return new Date(now.getTime() + 2 * 60 * 60 * 1000);
  }

  // "now" or null/unknown → current time
  return now;
}

/** 将 timeContext 构建为完整查询串。可传入基础路径或已有查询串。 */
export function withTimeContext(pathOrQuery: string, key: TimeContextKey | null): string {
  if (!key || key === "now") return pathOrQuery;
  const hasQuery = pathOrQuery.includes("?");
  const sep = hasQuery ? "&" : "?";
  return `${pathOrQuery}${sep}timeContext=${key}`;
}

/** 从 URL 读取 timeContext，非法值返回 null */
export function parseTimeContext(raw: string | null): TimeContextKey | null {
  if (!raw) return null;
  if ((TIME_CONTEXT_KEYS as string[]).includes(raw)) return raw as TimeContextKey;
  return null; // 非法值静默忽略
}
