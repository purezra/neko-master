import { afterEach, describe, expect, it, vi } from "vitest";
import { getComparisonWindows, getTrafficChange } from "./comparison";

afterEach(() => vi.unstubAllEnvs());
describe("comparison windows", () => {
  const selected = { start: "2026-10-17T08:01:10Z", end: "2026-10-17T09:01:10Z" };
  it.each(["today", "week", "selected"] as const)("compares equal closed-bucket durations for %s", preset => {
    vi.stubEnv("TZ", "Asia/Shanghai");
    const result = getComparisonWindows(preset, selected, Date.parse("2026-10-18T09:43:00Z"))!;
    expect(Date.parse(result.current.end) - Date.parse(result.current.start)).toBe(Date.parse(result.baseline.end) - Date.parse(result.baseline.start));
    expect(Date.parse(result.baseline.end)).toBeLessThanOrEqual(Date.parse(result.current.start));
  });
  it("aligns today and yesterday to the user's local day", () => {
    vi.stubEnv("TZ", "Asia/Shanghai");
    const result = getComparisonWindows("today", selected, Date.parse("2026-10-18T09:43:00Z"))!;
    expect(result.current).toEqual({ start: "2026-10-17T16:00:00.000Z", end: "2026-10-18T09:00:00.000Z" });
    expect(result.baseline).toEqual({ start: "2026-10-16T16:00:00.000Z", end: "2026-10-17T09:00:00.000Z" });
  });
  it("uses Monday as the start of this week", () => {
    vi.stubEnv("TZ", "Asia/Shanghai");
    const result = getComparisonWindows("week", selected, Date.parse("2026-10-18T09:43:00Z"))!;
    expect(result.current.start).toBe("2026-10-11T16:00:00.000Z");
    expect(result.baseline.start).toBe("2026-10-04T16:00:00.000Z");
  });
  it("handles zero baselines without Infinity or NaN", () => {
    expect(getTrafficChange(10, 0)).toEqual({ delta: 10, percent: null });
    expect(getTrafficChange(0, 0)).toEqual({ delta: 0, percent: 0 });
    expect(getTrafficChange(5, 10)).toEqual({ delta: -5, percent: -50 });
  });
});
