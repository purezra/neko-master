import type {
  CountryStats,
  DeviceStats,
  DeviceTrafficDetail,
  DomainStats,
  IPStats,
  ProxyStats,
  RuleStats,
  StatsSummary,
} from "@neko-master/shared";
import type { TimeRange } from "@/lib/api";
import { getLocalizedCountryName } from "@/lib/i18n-country";
import { parseApiTimestamp } from "@/lib/utils";

export const EXPORT_DATASET_IDS = [
  "summary",
  "domains",
  "ips",
  "rules",
  "countries",
  "proxies",
  "devices",
  "deviceDetails",
] as const;

export type ExportDatasetId = (typeof EXPORT_DATASET_IDS)[number];

export const EXPORT_TOP_N_OPTIONS = [10, 20, 50, 100, 200] as const;

export type ExportTopN = (typeof EXPORT_TOP_N_OPTIONS)[number];

export type ExportColumnKind = "text" | "number" | "bytes" | "datetime";

export interface ExportColumn {
  key: string;
  label: { zh: string; en: string };
  kind?: ExportColumnKind;
}

export type ExportCellValue = string | number | Date | null;

export interface ExportDataset {
  id: ExportDatasetId;
  label: { zh: string; en: string };
  columns: ExportColumn[];
  rows: Array<Record<string, ExportCellValue>>;
  /** Rows whose mixed-type summary value is a byte count. */
  byteRows?: number[];
}

export interface ExportSourceData {
  summary?: StatsSummary | null;
  countries: CountryStats[];
  rules: RuleStats[];
  proxies: ProxyStats[];
  devices: DeviceStats[];
  domains: DomainStats[];
  ips: IPStats[];
  deviceDetails?: DeviceTrafficDetail[];
}

export interface BuildExportDatasetsParams {
  sources: ExportSourceData;
  enabled: Partial<Record<ExportDatasetId, boolean>>;
  topN: number;
  timeRange: TimeRange;
  backendName: string;
  locale: string;
}

const COUNTRY_COLUMN: ExportColumn = {
  key: "countryName",
  label: { zh: "国家/地区", en: "Country/Region" },
};

const TOTAL_BYTES_COLUMN: ExportColumn = {
  key: "totalBytes",
  label: { zh: "总流量", en: "Total Traffic" },
  kind: "bytes",
};

const DOWNLOAD_BYTES_COLUMN: ExportColumn = {
  key: "downloadBytes",
  label: { zh: "下载", en: "Download" },
  kind: "bytes",
};

const UPLOAD_BYTES_COLUMN: ExportColumn = {
  key: "uploadBytes",
  label: { zh: "上传", en: "Upload" },
  kind: "bytes",
};

const CONNECTIONS_COLUMN: ExportColumn = {
  key: "connections",
  label: { zh: "连接数", en: "Connections" },
  kind: "number",
};

const LAST_SEEN_COLUMN: ExportColumn = {
  key: "lastSeen",
  label: { zh: "最后活动", en: "Last Seen" },
  kind: "datetime",
};

export function getDatasetLabel(
  dataset: ExportDataset,
  locale: string,
): string {
  return locale.startsWith("zh") ? dataset.label.zh : dataset.label.en;
}

export function getColumnLabel(column: ExportColumn, locale: string): string {
  return locale.startsWith("zh") ? column.label.zh : column.label.en;
}

function totalOf(stats: {
  totalUpload: number;
  totalDownload: number;
}): number {
  return stats.totalUpload + stats.totalDownload;
}

function byTotalDesc<T extends { totalUpload: number; totalDownload: number }>(
  rows: T[],
): T[] {
  return [...rows].sort((a, b) => totalOf(b) - totalOf(a));
}

function takeTop<T>(rows: T[], topN: number): T[] {
  return rows.slice(0, Math.max(0, topN));
}

function buildSummaryDataset(
  summary: StatsSummary | null | undefined,
  params: BuildExportDatasetsParams,
): ExportDataset {
  const rows: Array<Record<string, ExportCellValue>> = [];
  const byteRows: number[] = [];
  const push = (label: ExportColumn["label"], value: ExportCellValue, bytes = false) => {
    if (bytes) byteRows.push(rows.length);
    rows.push({
      metric: params.locale.startsWith("zh") ? label.zh : label.en,
      value,
    });
  };

  push({ zh: "网关", en: "Backend" }, params.backendName);
  push({ zh: "开始时间", en: "Start Time" }, new Date(params.timeRange.start));
  push({ zh: "结束时间（不含）", en: "End Time (exclusive)" }, new Date(params.timeRange.end));
  push({ zh: "总下载", en: "Total Download" }, summary?.totalDownload ?? 0, true);
  push({ zh: "总上传", en: "Total Upload" }, summary?.totalUpload ?? 0, true);
  push({ zh: "总连接数", en: "Total Connections" }, summary?.totalConnections ?? 0);
  push({ zh: "独立域名", en: "Unique Domains" }, summary?.totalDomains ?? 0);
  push({ zh: "独立 IP", en: "Unique IPs" }, summary?.totalIPs ?? 0);
  push({ zh: "代理节点", en: "Proxies" }, summary?.totalProxies ?? 0);
  push({ zh: "规则数", en: "Rules" }, summary?.totalRules ?? 0);

  return {
    id: "summary",
    byteRows,
    label: { zh: "汇总", en: "Summary" },
    columns: [
      { key: "metric", label: { zh: "指标", en: "Metric" } },
      { key: "value", label: { zh: "数值", en: "Value" } },
    ],
    rows,
  };
}

export function buildExportDatasets(
  params: BuildExportDatasetsParams,
): ExportDataset[] {
  const { sources, enabled, topN, locale } = params;
  const datasets: ExportDataset[] = [];

  if (enabled.summary) {
    datasets.push(buildSummaryDataset(sources.summary, params));
  }

  if (enabled.domains) {
    const rows = takeTop(byTotalDesc(sources.domains), topN).map((item) => ({
      domain: item.domain,
      totalBytes: totalOf(item),
      downloadBytes: item.totalDownload,
      uploadBytes: item.totalUpload,
      connections: item.totalConnections,
      rules: item.rules?.join(", ") ?? "",
      chains: item.chains?.join(", ") ?? "",
      ipCount: item.ips?.length ?? 0,
      lastSeen: item.lastSeen ? parseApiTimestamp(item.lastSeen) : null,
    }));
    datasets.push({
      id: "domains",
      label: { zh: "热门域名", en: "Top Domains" },
      columns: [
        { key: "domain", label: { zh: "域名", en: "Domain" } },
        TOTAL_BYTES_COLUMN,
        DOWNLOAD_BYTES_COLUMN,
        UPLOAD_BYTES_COLUMN,
        CONNECTIONS_COLUMN,
        { key: "rules", label: { zh: "规则", en: "Rules" } },
        { key: "chains", label: { zh: "代理节点", en: "Proxies" } },
        { key: "ipCount", label: { zh: "IP 数", en: "IP Count" }, kind: "number" },
        LAST_SEEN_COLUMN,
      ],
      rows,
    });
  }

  if (enabled.ips) {
    const rows = takeTop(byTotalDesc(sources.ips), topN).map((item) => ({
      ip: item.ip,
      totalBytes: totalOf(item),
      downloadBytes: item.totalDownload,
      uploadBytes: item.totalUpload,
      connections: item.totalConnections,
      countryName: item.geoIP
        ? item.geoIP.countryName ||
          getLocalizedCountryName(item.geoIP.countryCode, locale)
        : "",
      city: item.geoIP?.city ?? "",
      asOrganization: item.geoIP?.asOrganization ?? item.asn ?? "",
      domains: item.domains?.join(", ") ?? "",
      chains: item.chains?.join(", ") ?? "",
      lastSeen: item.lastSeen ? parseApiTimestamp(item.lastSeen) : null,
    }));
    datasets.push({
      id: "ips",
      label: { zh: "热门 IP", en: "Top IPs" },
      columns: [
        { key: "ip", label: { zh: "IP 地址", en: "IP Address" } },
        TOTAL_BYTES_COLUMN,
        DOWNLOAD_BYTES_COLUMN,
        UPLOAD_BYTES_COLUMN,
        CONNECTIONS_COLUMN,
        COUNTRY_COLUMN,
        { key: "city", label: { zh: "城市", en: "City" } },
        { key: "asOrganization", label: { zh: "AS 组织", en: "AS Organization" } },
        { key: "domains", label: { zh: "关联域名", en: "Domains" } },
        { key: "chains", label: { zh: "代理节点", en: "Proxies" } },
        LAST_SEEN_COLUMN,
      ],
      rows,
    });
  }

  if (enabled.rules) {
    const rows = takeTop(byTotalDesc(sources.rules), topN).map((item) => ({
      rule: item.rule,
      finalProxy: item.finalProxy,
      totalBytes: totalOf(item),
      downloadBytes: item.totalDownload,
      uploadBytes: item.totalUpload,
      connections: item.totalConnections,
      lastSeen: item.lastSeen ? parseApiTimestamp(item.lastSeen) : null,
    }));
    datasets.push({
      id: "rules",
      label: { zh: "规则流量", en: "Top Rules" },
      columns: [
        { key: "rule", label: { zh: "规则", en: "Rule" } },
        { key: "finalProxy", label: { zh: "最终代理", en: "Final Proxy" } },
        TOTAL_BYTES_COLUMN,
        DOWNLOAD_BYTES_COLUMN,
        UPLOAD_BYTES_COLUMN,
        CONNECTIONS_COLUMN,
        LAST_SEEN_COLUMN,
      ],
      rows,
    });
  }

  if (enabled.countries) {
    const rows = takeTop(byTotalDesc(sources.countries), topN).map((item) => ({
      countryName:
        item.countryName ||
        getLocalizedCountryName(item.country || item.countryName, locale),
      countryCode: item.country,
      continent: item.continent,
      totalBytes: totalOf(item),
      downloadBytes: item.totalDownload,
      uploadBytes: item.totalUpload,
      connections: item.totalConnections,
      lastSeen: item.lastSeen ? parseApiTimestamp(item.lastSeen) : null,
    }));
    datasets.push({
      id: "countries",
      label: { zh: "热门地区", en: "Top Regions" },
      columns: [
        COUNTRY_COLUMN,
        { key: "countryCode", label: { zh: "地区代码", en: "Country Code" } },
        { key: "continent", label: { zh: "大洲", en: "Continent" } },
        TOTAL_BYTES_COLUMN,
        DOWNLOAD_BYTES_COLUMN,
        UPLOAD_BYTES_COLUMN,
        CONNECTIONS_COLUMN,
        LAST_SEEN_COLUMN,
      ],
      rows,
    });
  }

  if (enabled.proxies) {
    const rows = takeTop(byTotalDesc(sources.proxies), topN).map((item) => ({
      chain: item.chain,
      totalBytes: totalOf(item),
      downloadBytes: item.totalDownload,
      uploadBytes: item.totalUpload,
      connections: item.totalConnections,
      lastSeen: item.lastSeen ? parseApiTimestamp(item.lastSeen) : null,
    }));
    datasets.push({
      id: "proxies",
      label: { zh: "热门代理", en: "Top Proxies" },
      columns: [
        { key: "chain", label: { zh: "代理节点", en: "Proxy" } },
        TOTAL_BYTES_COLUMN,
        DOWNLOAD_BYTES_COLUMN,
        UPLOAD_BYTES_COLUMN,
        CONNECTIONS_COLUMN,
        LAST_SEEN_COLUMN,
      ],
      rows,
    });
  }

  if (enabled.devices) {
    const rows = takeTop(byTotalDesc(sources.devices), topN).map((item) => ({
      sourceIP: item.sourceIP,
      displayName: item.displayName ?? "",
      groupName: item.groupName ?? "",
      totalBytes: totalOf(item),
      downloadBytes: item.totalDownload,
      uploadBytes: item.totalUpload,
      connections: item.totalConnections,
      lastSeen: item.lastSeen ? parseApiTimestamp(item.lastSeen) : null,
    }));
    datasets.push({
      id: "devices",
      label: { zh: "设备使用统计", en: "Device Usage" },
      columns: [
        { key: "sourceIP", label: { zh: "设备 IP", en: "Device IP" } },
        { key: "displayName", label: { zh: "设备备注", en: "Device Name" } },
        { key: "groupName", label: { zh: "分组", en: "Group" } },
        TOTAL_BYTES_COLUMN,
        DOWNLOAD_BYTES_COLUMN,
        UPLOAD_BYTES_COLUMN,
        CONNECTIONS_COLUMN,
        LAST_SEEN_COLUMN,
      ],
      rows,
    });
  }

  if (enabled.deviceDetails) {
    datasets.push({
      id: "deviceDetails",
      label: { zh: "设备访问明细", en: "Device Traffic Details" },
      columns: [
        { key: "sourceIP", label: { zh: "设备 IP", en: "Device IP" } },
        { key: "displayName", label: { zh: "设备备注", en: "Device Name" } },
        { key: "groupName", label: { zh: "设备分组", en: "Device Group" } },
        { key: "domain", label: { zh: "域名", en: "Domain" } },
        { key: "ip", label: { zh: "目标 IP", en: "Destination IP" } },
        { key: "rule", label: { zh: "统计规则", en: "Statistics Rule" } },
        { key: "matchedRule", label: { zh: "原始命中规则", en: "Matched Rule" } },
        { key: "rulePayload", label: { zh: "规则参数", en: "Rule Payload" } },
        { key: "policyGroup", label: { zh: "策略组", en: "Policy Group" } },
        { key: "proxy", label: { zh: "出口代理", en: "Outbound Proxy" } },
        { key: "chain", label: { zh: "完整代理链", en: "Full Proxy Chain" } },
        TOTAL_BYTES_COLUMN, DOWNLOAD_BYTES_COLUMN, UPLOAD_BYTES_COLUMN, CONNECTIONS_COLUMN, LAST_SEEN_COLUMN,
      ],
      // This dataset is complete and grouped by device, independent of Top N.
      rows: (sources.deviceDetails ?? []).map(item => {
        const hops = item.chain.split(" > ").map(hop => hop.trim()).filter(Boolean);
        return { sourceIP: item.sourceIP, displayName: item.displayName ?? "", groupName: item.groupName ?? "",
          domain: item.domain, ip: item.ip, rule: item.rule, matchedRule: item.matchedRule ?? "", rulePayload: item.rulePayload ?? "",
          policyGroup: hops.length > 1 ? hops[hops.length - 1] : "", proxy: hops[0] ?? "", chain: item.chain,
          totalBytes: totalOf(item), downloadBytes: item.totalDownload, uploadBytes: item.totalUpload,
          connections: item.totalConnections, lastSeen: item.lastSeen ? parseApiTimestamp(item.lastSeen) : null };
      }),
    });
  }

  return datasets;
}
