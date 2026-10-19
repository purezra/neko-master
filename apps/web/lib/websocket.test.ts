import { afterEach, describe, expect, it, vi } from "vitest";
import { getWsUrlCandidates, isMatchingStatsPush } from "./websocket";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("WebSocket endpoint selection", () => {
  it("connects to the remote collector when a local dev frontend proxies its HTTP API", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_WS_HOST", "192.168.1.161");
    vi.stubEnv("NEXT_PUBLIC_WS_PORT", "3002");
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "");
    vi.stubGlobal("window", { location: { protocol: "http:", hostname: "localhost", host: "localhost:3100" } });
    expect(getWsUrlCandidates()[0]).toBe("ws://192.168.1.161:3002");
  });

  it("keeps runtime URL and host overrides ahead of development defaults", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_WS_HOST", "dev-collector");
    vi.stubEnv("NEXT_PUBLIC_WS_URL", "");
    vi.stubGlobal("window", {
      location: { protocol: "https:", hostname: "dashboard", host: "dashboard" },
      __RUNTIME_CONFIG__: { WS_URL: "/ws", WS_HOST: "collector", WS_PORT: 9443 },
    });
    expect(getWsUrlCandidates().slice(0, 2)).toEqual(["wss://collector/ws", "wss://collector:9443"]);
  });
});

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
