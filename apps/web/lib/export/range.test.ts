import { describe, expect, it } from "vitest";
import { getExportContinuationRange, getExportWindow } from "./range";

const now = Date.parse("2026-10-18T09:43:25Z");

describe("export time boundaries", () => {
  it("excludes the unfinished minute and converts the exclusive end for the API", () => {
    expect(getExportWindow({ start: "2026-10-18T09:30:25Z", end: "2026-10-18T09:43:25Z" }, now)).toEqual({
      range: { start: "2026-10-18T09:30:00.000Z", end: "2026-10-18T09:43:00.000Z" },
      queryRange: { start: "2026-10-18T09:30:00.000Z", end: "2026-10-18T09:42:59.999Z", persistedOnly: true },
    });
  });

  it("uses complete UTC hours for long ranges", () => {
    const result = getExportWindow({ start: "2026-10-17T09:30:25Z", end: "2026-10-18T09:43:25Z" }, now)!;
    expect(result.range).toEqual({ start: "2026-10-17T09:00:00.000Z", end: "2026-10-18T09:00:00.000Z" });
    expect(result.queryRange.end).toBe("2026-10-18T08:59:59.999Z");
  });

  it("resumes without re-reading the last hour", () => {
    const next = getExportContinuationRange("2026-10-17T09:00:00Z", now)!;
    expect(next.start).toBe("2026-10-17T09:00:00.000Z");
    expect(next.end).toBe("2026-10-18T09:00:00.000Z");
  });

  it("finishes the partial hour before switching from minute to hourly facts", () => {
    const first = getExportContinuationRange("2026-10-17T09:43:00Z", now)!;
    expect(first).toEqual({ start: "2026-10-17T09:43:00.000Z", end: "2026-10-17T10:00:00.000Z" });
    const second = getExportContinuationRange(first.end, now)!;
    expect(second.start).toBe(first.end);
    expect(getExportWindow(second, now)!.range.start).toBe(first.end);
  });

  it.each([
    { start: "invalid", end: "2026-10-18T09:43:25Z" },
    { start: "2026-10-18T10:00:00Z", end: "2026-10-18T09:00:00Z" },
    { start: "2026-10-18T09:43:01Z", end: "2026-10-18T09:43:25Z" },
  ])("rejects empty or invalid intervals: %j", (range) => {
    expect(getExportWindow(range, now)).toBeNull();
  });

  it("does not advance a cursor before another bucket has closed", () => {
    expect(getExportContinuationRange("2026-10-18T09:43:00Z", now)).toBeNull();
  });
});
