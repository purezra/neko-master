import { useMemo } from "react";
import type { TimeRange } from "@/lib/api";

/**
 * Stabilizes a TimeRange object reference so that downstream consumers
 * (e.g. react-query keys) only see a new reference when the actual
 * start/end values change.
 */
export function useStableTimeRange(
  timeRange?: TimeRange,
  options?: { roundToMinute?: boolean },
): TimeRange | undefined {
  const startValue = timeRange?.start;
  const endValue = timeRange?.end;
  const persistedOnly = timeRange?.persistedOnly;
  const roundToMinute = options?.roundToMinute;
  return useMemo<TimeRange | undefined>(() => {
    if (!startValue || !endValue) return undefined;
    const start = new Date(startValue);
    const end = new Date(endValue);
    if (roundToMinute) {
      start.setUTCSeconds(0, 0);
      end.setUTCSeconds(0, 0);
    }
    return {
      start: start.toISOString(),
      end: end.toISOString(),
      ...(persistedOnly ? { persistedOnly: true } : {}),
    };
  }, [startValue, endValue, persistedOnly, roundToMinute]);
}
