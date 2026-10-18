import { afterEach, describe, expect, it, vi } from "vitest";
import { buildExportDatasets, type ExportSourceData } from "./dataset";
import { buildExportJsonPayload } from "./json";
import { buildExportCsv } from "./csv";

afterEach(() => vi.unstubAllEnvs());

describe("export timestamps", () => {
  it.each(["Asia/Shanghai", "America/New_York"])("preserves UTC API timestamps in %s", (zone) => {
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
      expect(dataset.rows[0].lastSeen).toBe("2026-10-17T09:00:00.000Z");
    }
    expect(json.meta.range.endExclusive).toBe(true);
    expect(buildExportCsv(datasets, meta, "en")).toContain("2026-10-17T09:00:00.000Z");
    expect(buildExportCsv(datasets, meta, "en")).toContain(`[${range.start}, ${range.end})`);
    // The same Date objects are passed to the XLSX writer.
    expect((datasets[0].rows[0].lastSeen as Date).getTime()).toBe(Date.parse(`${raw}Z`));
  });
});
