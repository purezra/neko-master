import type { DomainUsageRow } from "@neko-master/shared";

export type UsageMetric = "traffic" | "connections";
export interface UsageItem {
  key: string | null;
  displayName?: string;
  chains: string[];
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
}

export function usageValue(row: Pick<DomainUsageRow, "totalUpload" | "totalDownload" | "totalConnections">, metric: UsageMetric): number {
  return metric === "connections" ? row.totalConnections : row.totalUpload + row.totalDownload;
}

export function groupDomainUsage(rows: DomainUsageRow[], dimension: "device" | "proxy", metric: UsageMetric): UsageItem[] {
  const groups = new Map<string | null, UsageItem>();
  for (const row of rows) {
    const key = dimension === "device" ? row.sourceIP : row.chain === null ? null : row.chain.split(" > ")[0].trim();
    const item = groups.get(key) ?? { key, displayName: dimension === "device" ? row.displayName : undefined,
      chains: [], totalUpload: 0, totalDownload: 0, totalConnections: 0 };
    item.totalUpload += row.totalUpload;
    item.totalDownload += row.totalDownload;
    item.totalConnections += row.totalConnections;
    if (row.chain && !item.chains.includes(row.chain)) item.chains.push(row.chain);
    groups.set(key, item);
  }
  return [...groups.values()].sort((a, b) => usageValue(b, metric) - usageValue(a, metric) || (a.key ?? "").localeCompare(b.key ?? ""));
}
