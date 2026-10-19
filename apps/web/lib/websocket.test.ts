import { describe, expect, it } from "vitest";
import { isMatchingStatsPush } from "./websocket";

const range = { start: "2026-10-18T02:00:00Z", end: "2026-10-19T02:00:00Z" };
const subscription = { backendId: 2, range, summaryFields: ["totals", "deviceStats"] as const };
const current = { ...subscription, summaryFields: [...subscription.summaryFields] };

describe("stats subscription isolation", () => {
  it("drops a late push from the old gateway after switching", () => {
    expect(isMatchingStatsPush({ backendId: 1, ...range }, current)).toBe(false);
    expect(isMatchingStatsPush({ backendId: 2, ...range }, current)).toBe(true);
  });

  it("drops old ranges and partial range tags", () => {
    expect(isMatchingStatsPush({ backendId: 2, ...range, end: "2026-10-19T01:00:00Z" }, current)).toBe(false);
    expect(isMatchingStatsPush({ backendId: 2, start: range.start }, current)).toBe(false);
  });

  it("compares instants rather than timestamp spelling", () => {
    expect(isMatchingStatsPush({ backendId: 2, start: "2026-10-18T10:00:00+08:00", end: "2026-10-19T10:00:00+08:00" }, current)).toBe(true);
  });

  it("drops pushes for an earlier summary subscription", () => {
    expect(isMatchingStatsPush({ summaryFields: ["topDomains"] }, current)).toBe(false);
    expect(isMatchingStatsPush({ summaryFields: ["deviceStats", "totals", "totals"] }, current)).toBe(true);
  });

  it("keeps legacy untagged pushes and unrestricted subscriptions compatible", () => {
    expect(isMatchingStatsPush({}, current)).toBe(true);
    expect(isMatchingStatsPush({ backendId: 1, summaryFields: ["topDomains"] }, {})).toBe(true);
  });

  it("rejects malformed timestamps", () => {
    expect(isMatchingStatsPush({ start: "invalid", end: range.end }, current)).toBe(false);
  });
});
