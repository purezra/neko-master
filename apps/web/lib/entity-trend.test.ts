import { describe, expect, it } from "vitest";
import { getEntityTrendRange } from "./entity-trend";

describe("overview daily traffic range", () => {
  const end = Date.parse("2026-10-18T10:42:31Z");
  it.each([7, 30])("preserves exactly %i daily intervals for rolling presets", days => {
    const range = getEntityTrendRange(days === 7 ? "7d" : "30d", { start: new Date(end - days * 86400000).toISOString(), end: new Date(end).toISOString() }, end)!;
    expect((Date.parse(range.end) - Date.parse(range.start)) / 86400000).toBe(days);
    expect(range.end).toBe("2026-10-18T10:00:00.000Z");
  });
  it("enables custom periods at 48 hours and excludes shorter or future-only periods", () => {
    const range = { start: new Date(end - 2 * 86400000).toISOString(), end: new Date(end).toISOString() };
    expect(getEntityTrendRange("custom", range, end)).not.toBeNull();
    expect(getEntityTrendRange("24h", range, end)).toBeNull();
    expect(getEntityTrendRange("custom", { ...range, start: new Date(end - 47 * 3600000).toISOString() }, end)).toBeNull();
    expect(getEntityTrendRange("custom", { start: new Date(end).toISOString(), end: new Date(end + 3 * 86400000).toISOString() }, end)).toBeNull();
  });
});
