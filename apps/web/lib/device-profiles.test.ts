import { describe, expect, it } from "vitest";
import { filterDevices } from "./device-profiles";
import { buildExportDatasets } from "./export/dataset";

describe("device names and groups", () => {
  const data = [{ sourceIP: "192.168.1.2", totalUpload: 1, totalDownload: 2, totalConnections: 1, lastSeen: "2026-10-18T08:00:00Z" }];
  const profiles = [{ sourceIP: data[0].sourceIP, displayName: "My Desktop", groupName: "Work" }];
  it("searches names, IPs and groups", () => {
    expect(filterDevices(data, profiles, "desktop", "all")).toHaveLength(1);
    expect(filterDevices(data, profiles, "192.168", "group:Work")).toHaveLength(1);
    expect(filterDevices(data, profiles, "", "ungrouped")).toHaveLength(0);
    expect(filterDevices(data, profiles, "", "group:Home")).toHaveLength(0);
  });
  it("clears stale cached names when a profile is deleted", () => {
    expect(filterDevices([{ ...data[0], displayName: "Old name" }], [], "old", "all")).toHaveLength(0);
  });
  it("preserves names and groups in exports", () => {
    const datasets = buildExportDatasets({ sources: { devices: filterDevices(data, profiles, "", "all"), domains: [], ips: [], proxies: [], rules: [], countries: [] }, enabled: { devices: true, summary: false, domains: false, ips: false, proxies: false, rules: false, countries: false }, topN: 10, backendName: "test", locale: "en", timeRange: { start: "2026-10-18T08:00:00Z", end: "2026-10-18T09:00:00Z" } });
    expect(datasets[0].rows[0]).toMatchObject({ displayName: "My Desktop", groupName: "Work" });
  });
});
