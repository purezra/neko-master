import type { TimeRange } from "@/lib/api";

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const SIX_HOURS_MS = 6 * HOUR_MS;

export interface ExportWindow {
  /** Actual exported interval: start inclusive, end exclusive. */
  range: TimeRange;
  /** Existing stats APIs use an inclusive end. */
  queryRange: TimeRange;
}

export function getExportWindow(
  requested: TimeRange,
  now = Date.now(),
): ExportWindow | null {
  const start = Date.parse(requested.start);
  const end = Math.min(Date.parse(requested.end), now);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return null;

  // Match SQLite's fact-table routing. Export only closed buckets, so the
  // next export can start at the exclusive end without re-reading a bucket.
  const bucketMs = end - start > SIX_HOURS_MS ? HOUR_MS : MINUTE_MS;
  const startMs = Math.floor(start / bucketMs) * bucketMs;
  const endMs = Math.floor(end / bucketMs) * bucketMs;
  if (startMs >= endMs) return null;

  const range = {
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
  };
  return {
    range,
    queryRange: {
      start: range.start,
      end: new Date(endMs - 1).toISOString(),
      persistedOnly: true,
    },
  };
}

export function getExportContinuationRange(
  exclusiveEnd: string,
  now = Date.now(),
): TimeRange | null {
  const start = Date.parse(exclusiveEnd);
  if (!Number.isFinite(start)) return null;

  // A minute-based export can end inside an hour. Finish that hour first
  // before switching to hourly facts, even when returning several days later.
  const end = start % HOUR_MS !== 0 && now - start > SIX_HOURS_MS
    ? Math.min(now, Math.ceil(start / HOUR_MS) * HOUR_MS)
    : now;
  return getExportWindow({ start: exclusiveEnd, end: new Date(end).toISOString() }, now)?.range ?? null;
}
