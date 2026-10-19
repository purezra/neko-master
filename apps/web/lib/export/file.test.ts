import { afterEach, describe, expect, it, vi } from "vitest";
import { formatExportTimestamp, formatExportRange, formatExportTraffic, getExportFileName, toExportExcelDate } from "./file";
import { buildExportJsonPayload } from "./json";
import { buildExportDatasets } from "./dataset";
import { buildExportCsv } from "./csv";

afterEach(() => vi.unstubAllEnvs());
const meta = { backendName: "OpenClash 网关", start: "2026-10-18T02:00:00Z", end: "2026-10-19T02:00:00Z", endExclusive: true, topN: 50, exportedAt: new Date("2026-10-19T02:02:31.123Z") };

describe("export presentation", () => {
  it.each(["UTC", "Asia/Shanghai", "America/New_York"])("uses Beijing time independent of the host zone %s", zone => {
    vi.stubEnv("TZ", zone);
    expect(formatExportTimestamp(meta.start)).toBe("2026-10-18T10:00:00.000+08:00");
    expect(Date.parse(formatExportTimestamp(meta.start))).toBe(Date.parse(meta.start));
    expect(formatExportRange(meta)).toBe("[2026-10-18 10:00:00, 2026-10-19 10:00:00) (UTC+08:00)");
    expect(getExportFileName("xlsx", meta)).toBe("neko-master-OpenClash 网关-20261018-100000_to_20261019-100000-UTC+0800-exported-20261019-100231123.xlsx");
    expect(toExportExcelDate(new Date(meta.start)).toISOString()).toBe("2026-10-18T10:00:00.000Z");
  });
  it("rolls dates into the next Beijing day and sanitizes filenames", () => {
    expect(formatExportTimestamp("2026-10-18T20:30:00Z")).toBe("2026-10-19T04:30:00.000+08:00");
    expect(getExportFileName("csv", { ...meta, backendName: 'bad:/\\*?"name' })).not.toMatch(/[<>:"/\\|?*]/);
  });
  it.each([[0, "0.00 KB"], [1, "0.00 KB"], [1024, "1.00 KB"], [1024 ** 2, "1.00 MB"], [1.25 * 1024 ** 2, "1.25 MB"], [1024 ** 3, "1.0000 GB"], [1.234567 * 1024 ** 3, "1.2346 GB"], [1024 ** 4, "1024.0000 GB"]])("formats %s bytes as %s", (value, text) => {
    expect(formatExportTraffic(value as number)).toBe(text);
  });
  it("formats summary and traffic columns without converting counts or machine-readable JSON bytes", () => {
    const datasets = buildExportDatasets({
      sources: { summary: { totalDownload: 1024 ** 3, totalUpload: 1024 ** 2, totalConnections: 2048, totalDomains: 1, totalIPs: 1, totalProxies: 1, topDomains: [], topIPs: [], proxyStats: [], hourlyStats: [] }, domains: [], ips: [], rules: [], countries: [], devices: [], proxies: [{ chain: "DIRECT", totalUpload: 1024, totalDownload: 1024 ** 3, totalConnections: 2048, lastSeen: "2026-10-19T02:00:00" }] },
      enabled: { summary: true, proxies: true, domains: false, ips: false, rules: false, countries: false, devices: false },
      timeRange: meta, topN: 50, backendName: meta.backendName, locale: "zh",
    });
    const csv = buildExportCsv(datasets, meta, "zh");
    expect(csv).toContain("总下载,1.0000 GB"); expect(csv).toContain("总上传,1.00 MB"); expect(csv).toContain("总连接数,2048");
    expect(csv).toContain("1.00 KB"); expect(csv).toContain("2026-10-19T10:00:00.000+08:00");
    const json = buildExportJsonPayload(datasets, meta, "zh");
    expect(json.meta).toMatchObject({ timeZone: "Asia/Shanghai", utcOffset: "+08:00", range: { endExclusive: true, start: "2026-10-18T10:00:00.000+08:00" } });
    expect(json.datasets.proxies.rows[0].downloadBytes).toBe(1024 ** 3);
  });
});
