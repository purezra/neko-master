import type { TimeRange } from "@/lib/api";
import type { TimePreset } from "@/lib/types/dashboard";
import { getExportWindow } from "@/lib/export/range";

export function getEntityTrendRange(preset: TimePreset, range: TimeRange, now = Date.now()): TimeRange | null {
  if (!["7d", "30d", "custom"].includes(preset)) return null;
  if (Date.parse(range.end) - Date.parse(range.start) < 2 * 86400000) return null;
  const closedRange = getExportWindow(range, now)?.range;
  return closedRange && Date.parse(closedRange.end) - Date.parse(closedRange.start) >= 2 * 86400000 ? closedRange : null;
}
