import type { DeviceTrafficDetail, DeviceStats, DeviceTrafficFilters } from "@neko-master/shared";

export function deviceScopeFilters(scope: string): DeviceTrafficFilters {
  if (scope.startsWith("ip:")) return { sourceIP: scope.slice(3) };
  if (scope.startsWith("group:")) return { groupName: scope.slice(6) };
  return scope === "ungrouped" ? { ungrouped: true } : {};
}

export function summarizeDeviceDetails(rows: DeviceTrafficDetail[]): DeviceStats[] {
  const devices = new Map<string, DeviceStats>();
  for (const row of rows) {
    const existing = devices.get(row.sourceIP);
    if (existing) {
      existing.totalUpload += row.totalUpload;
      existing.totalDownload += row.totalDownload;
      existing.totalConnections += row.totalConnections;
      if (row.lastSeen > existing.lastSeen) existing.lastSeen = row.lastSeen;
    } else devices.set(row.sourceIP, { sourceIP: row.sourceIP, displayName: row.displayName, groupName: row.groupName,
      totalUpload: row.totalUpload, totalDownload: row.totalDownload, totalConnections: row.totalConnections, lastSeen: row.lastSeen });
  }
  return [...devices.values()];
}
