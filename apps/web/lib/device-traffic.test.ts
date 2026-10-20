import { describe, expect, it } from "vitest";
import { deviceScopeFilters, summarizeDeviceDetails } from "./device-traffic";
import { trafficValue } from "./trend-series";
import { parseExportPreferences } from "./export/preferences";

describe("device analysis and export scope", () => {
  it("keeps all, named groups, ungrouped and unknown devices distinct", () => {
    expect(deviceScopeFilters("all")).toEqual({});
    expect(deviceScopeFilters("ungrouped")).toEqual({ ungrouped: true });
    expect(deviceScopeFilters("group:Home:Office")).toEqual({ groupName: "Home:Office" });
    expect(deviceScopeFilters("ip:192.168.1.2")).toEqual({ sourceIP: "192.168.1.2" });
    expect(deviceScopeFilters("ip:")).toEqual({ sourceIP: "" });
  });
  it("reconciles filtered detail rows into device totals", () => {
    const base = { sourceIP: "192.168.1.2", displayName: "Laptop", domain: "sample.test", ip: "203.0.113.1", chain: "Node > Group", rule: "Group", totalUpload: 2, totalDownload: 4, totalConnections: 1, lastSeen: "2026-10-20T08:00:00Z" };
    const devices = summarizeDeviceDetails([base, { ...base, lastSeen: "2026-10-20T09:00:00Z" }, { ...base, sourceIP: "192.168.1.3" }]);
    expect(devices).toHaveLength(2);
    expect(devices[0]).toMatchObject({ totalUpload: 4, totalDownload: 8, totalConnections: 2, lastSeen: "2026-10-20T09:00:00Z" });
  });
  it("uses the chosen metric without changing underlying counters", () => {
    const point = { upload: 3, download: 7 };
    expect(["total", "upload", "download"].map(metric => trafficValue(point, metric as "total" | "upload" | "download"))).toEqual([10, 3, 7]);
    expect(point).toEqual({ upload: 3, download: 7 });
  });
  it("restores export preferences and rejects corrupt stored values", () => {
    expect(parseExportPreferences("bad JSON").scope).toBe("all");
    expect(parseExportPreferences(JSON.stringify({ format: "invalid", topN: -1, scope: "bad", splitSheets: "true" }))).toMatchObject({ format: "json", topN: 50, scope: "all", splitSheets: false });
    expect(parseExportPreferences(JSON.stringify({ format: "xlsx", topN: 20, scope: "group:Home", splitSheets: true, selected: { deviceDetails: true, summary: false } }))).toMatchObject({ format: "xlsx", topN: 20, scope: "group:Home", splitSheets: true, selected: { summary: false, deviceDetails: true } });
  });
});
