import type { ComparisonRange } from "@neko-master/shared";
import { getExportWindow } from "@/lib/export/range";

export type ComparisonPreset = "today" | "week" | "selected";

export function getComparisonWindows(preset: ComparisonPreset, selected: ComparisonRange, now = Date.now()): { current: ComparisonRange; baseline: ComparisonRange } | null {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === "week") start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const requested = preset === "selected" ? selected : { start: start.toISOString(), end: new Date(now).toISOString() };
  const window = getExportWindow(requested, now);
  if (!window) return null;
  const span = Date.parse(window.range.end) - Date.parse(window.range.start);
  if (span > 31 * 86400000) return null;
  const baselineStart = new Date(window.range.start);
  if (preset === "selected") baselineStart.setTime(baselineStart.getTime() - span);
  else baselineStart.setDate(baselineStart.getDate() - (preset === "week" ? 7 : 1));
  return {
    current: window.range,
    baseline: { start: baselineStart.toISOString(), end: new Date(baselineStart.getTime() + span).toISOString() },
  };
}

export function getTrafficChange(current: number, baseline: number): { delta: number; percent: number | null } {
  return { delta: current - baseline, percent: baseline === 0 ? (current === 0 ? 0 : null) : (current - baseline) / baseline * 100 };
}
