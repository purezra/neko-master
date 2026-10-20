import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { buildExportDatasets } from "./dataset";
import { buildExportXlsxBlob } from "./xlsx";

// Use the writer's ZIP dependency to inspect the actual generated workbook.
const writerRequire = createRequire(createRequire(import.meta.url).resolve("write-excel-file/browser"));
const { unzipSync, strFromU8 } = writerRequire("fflate") as {
  unzipSync: (data: Uint8Array) => Record<string, Uint8Array>;
  strFromU8: (data: Uint8Array) => string;
};

describe("generated Excel workbook", () => {
  it("splits devices into distinct, valid worksheets without dropping raw rules or rows", async () => {
    const range = { start: "2026-10-18T02:00:00Z", end: "2026-10-19T02:00:00Z" };
    const base = { domain: "sample.test", ip: "203.0.113.1", rule: "Group", matchedRule: "RuleSet", rulePayload: "ai-rules", chain: "Node > Group", totalUpload: 12, totalDownload: 34, totalConnections: 1, lastSeen: range.start };
    const datasets = buildExportDatasets({ sources: { devices: [], domains: [], ips: [], rules: [], countries: [], proxies: [], deviceDetails: [
      { ...base, sourceIP: "192.168.1.2", displayName: "same/name" }, { ...base, sourceIP: "192.168.1.2", domain: "other.test" },
      { ...base, sourceIP: "192.168.1.3", displayName: "same/name" }, { ...base, sourceIP: "", displayName: "" },
    ] }, enabled: { deviceDetails: true }, topN: 10, timeRange: range, backendName: "test", locale: "en" });
    const blob = await buildExportXlsxBlob(datasets, { ...range, endExclusive: true, backendName: "test", topN: 10, exportedAt: new Date() }, "en", true);
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const workbook = strFromU8(files["xl/workbook.xml"]);
    expect(workbook.match(/<sheet\b/g)).toHaveLength(3);
    const names = [...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"/g)].map(match => match[1]);
    expect(new Set(names).size).toBe(3);
    expect(names.every(name => name.length <= 31 && !/[:\\/?*\[\]]/.test(name))).toBe(true);
    const strings = strFromU8(files["xl/sharedStrings.xml"]);
    expect(strings).toContain("ai-rules"); expect(strings).toContain("Matched Rule");
    expect(strings).toContain("Unknown device");
    const sheets = Object.keys(files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name));
    expect(sheets.map(name => [...strFromU8(files[name]).matchAll(/<row\b[^>]*r="(\d+)"/g)].filter(match => Number(match[1]) > 4).length).sort()).toEqual([1, 1, 2]);
  });
  it("stores Beijing wall-clock dates and formatted traffic units in real XLSX cells", async () => {
    const range = { start: "2026-10-18T02:00:00Z", end: "2026-10-19T02:00:00Z" };
    const datasets = buildExportDatasets({
      sources: { summary: { totalDownload: 1024 ** 3, totalUpload: 1024 ** 2, totalConnections: 2048, totalDomains: 1, totalIPs: 1, totalProxies: 1, topDomains: [], topIPs: [], proxyStats: [], hourlyStats: [] }, domains: [], ips: [], rules: [], countries: [], devices: [], proxies: [] },
      enabled: { summary: true, proxies: false, domains: false, ips: false, rules: false, countries: false, devices: false }, timeRange: range, topN: 50, backendName: "OpenClash 网关", locale: "zh",
    });
    const blob = await buildExportXlsxBlob(datasets, { ...range, endExclusive: true, backendName: "OpenClash 网关", topN: 50, exportedAt: new Date(range.end) }, "zh");
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    const sheet = strFromU8(files["xl/worksheets/sheet1.xml"]);
    const strings = strFromU8(files["xl/sharedStrings.xml"]);
    const startCell = sheet.match(/<c\b[^>]*\br="B6"[^>]*>(.*?)<\/c>/)?.[1];
    expect(startCell).toBeDefined();
    const serial = Number(startCell?.match(/<v>(.*?)<\/v>/)?.[1]);
    expect(Math.abs((serial - 25569) * 86400000 - Date.parse("2026-10-18T10:00:00Z"))).toBeLessThan(5);
    expect(strings).toContain("[2026-10-18 10:00:00, 2026-10-19 10:00:00) (UTC+08:00)");
    expect(strings).toContain("1.0000 GB"); expect(strings).toContain("1.00 MB");
    expect(sheet).toContain("<v>2048</v>");
    expect(strFromU8(files["xl/styles.xml"])).toContain("UTC+08:00");
  });
});
