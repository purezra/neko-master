import { afterEach, describe, expect, it, vi } from "vitest";
import { buildExportDatasets, type ExportSourceData } from "./dataset";
import { buildExportJsonPayload } from "./json";
import { buildExportCsv } from "./csv";

afterEach(() => vi.unstubAllEnvs());

describe("export timestamps", () => {
  it("exports all device details independently of Top N and retains IP-only visits and separate chains", () => {
    const range = { start: "2026-10-17T08:00:00Z", end: "2026-10-17T10:00:00Z" };
    const details = Array.from({ length: 12 }, (_, index) => ({
      sourceIP: `192.168.1.${index + 1}`, displayName: "Laptop", domain: index ? "sample.test" : "", ip: "203.0.113.1",
      rule: "Group", chain: index ? "Node > Group" : "DIRECT", totalUpload: 10, totalDownload: 30, totalConnections: 2, lastSeen: range.start,
    }));
    const datasets = buildExportDatasets({ sources: { devices: [], domains: [], ips: [], rules: [], countries: [], proxies: [], deviceDetails: details },
      enabled: { deviceDetails: true }, topN: 1, timeRange: range, backendName: "test", locale: "en" });
    expect(datasets[0].rows).toHaveLength(12);
    expect(datasets[0].rows[0]).toMatchObject({ domain: "", ip: "203.0.113.1", proxy: "DIRECT", policyGroup: "", totalBytes: 40 });
    expect(datasets[0].rows[1]).toMatchObject({ displayName: "Laptop", policyGroup: "Group", proxy: "Node", chain: "Node > Group", rule: "Group" });
    const meta = { ...range, endExclusive: true, backendName: "test", topN: 1, exportedAt: new Date(range.end) };
    expect(buildExportJsonPayload(datasets, meta, "en").datasets.deviceDetails.rows).toHaveLength(12);
    expect(buildExportJsonPayload(datasets, meta, "en").datasets.deviceDetails.topN).toBeNull();
    expect(buildExportCsv(datasets, meta, "en")).toContain("Full Proxy Chain");
    expect(buildExportCsv(datasets, meta, "en")).toContain("all device details");
  });

  it.each(["Asia/Shanghai", "America/New_York"])("preserves instants while displaying Beijing time in %s", (zone) => {
    vi.stubEnv("TZ", zone);
    const raw = "2026-10-17T09:00:00";
    const stats = { totalUpload: 1, totalDownload: 2, totalConnections: 1, lastSeen: raw };
    const sources: ExportSourceData = {
      domains: [{ ...stats, domain: "example.test", ips: [], rules: [], chains: [] }],
      ips: [{ ...stats, ip: "203.0.113.1", domains: [], chains: [] }],
      rules: [{ ...stats, rule: "MATCH", finalProxy: "DIRECT" }],
      countries: [{ ...stats, country: "US", countryName: "US", continent: "NA" }],
      proxies: [{ ...stats, chain: "DIRECT" }],
      devices: [{ ...stats, sourceIP: "192.168.1.2" }],
    };
    const range = { start: "2026-10-17T08:00:00Z", end: "2026-10-17T10:00:00Z" };
    const datasets = buildExportDatasets({
      sources, enabled: { summary: false, domains: true, ips: true, rules: true, countries: true, proxies: true, devices: true },
      topN: 10, timeRange: range, backendName: "test", locale: "en",
    });
    const meta = { ...range, endExclusive: true, backendName: "test", topN: 10, exportedAt: new Date(range.end) };
    const json = buildExportJsonPayload(datasets, meta, "en");
    for (const dataset of Object.values(json.datasets)) {
      expect(dataset.rows[0].lastSeen).toBe("2026-10-17T17:00:00.000+08:00");
      expect(Date.parse(String(dataset.rows[0].lastSeen))).toBe(Date.parse(`${raw}Z`));
    }
    expect(json.meta.range.endExclusive).toBe(true);
    expect(buildExportCsv(datasets, meta, "en")).toContain("2026-10-17T17:00:00.000+08:00");
    expect(buildExportCsv(datasets, meta, "en")).toContain("[2026-10-17 16:00:00, 2026-10-17 18:00:00) (UTC+08:00)");
    // Dataset dates retain their instant; timezone conversion is serialization-only.
    expect((datasets[0].rows[0].lastSeen as Date).getTime()).toBe(Date.parse(`${raw}Z`));
  });
});
