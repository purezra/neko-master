import type { ComparisonRange } from '@neko-master/shared';

/** Validate the common, exclusive period contract, then adapt to inclusive repository reads. */
export function resolveComparisonRanges(currentRange: ComparisonRange, baselineRange: ComparisonRange): [ComparisonRange, ComparisonRange] {
  const ranges = [currentRange, baselineRange];
  const times = ranges.map(range => [Date.parse(range.start), Date.parse(range.end)]);
  if (times.some(([start, end]) => !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 31 * 86400000 || start % 60000 !== 0 || end % 60000 !== 0) ||
    times[0][1] - times[0][0] !== times[1][1] - times[1][0] || times[1][1] > times[0][0] ||
    times.some(([start, end]) => end - start > 6 * 3600000 && (start % 3600000 !== 0 || end % 3600000 !== 0))) {
    throw new RangeError('Comparison requires equal, non-overlapping complete bucket ranges of at most 31 days');
  }
  return ranges.map(range => ({ start: new Date(range.start).toISOString(), end: new Date(Date.parse(range.end) - 1).toISOString() })) as [ComparisonRange, ComparisonRange];
}
