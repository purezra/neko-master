import type { DeviceTrafficFilters } from '@neko-master/shared';

export interface ResolvedDeviceTrafficFilters extends DeviceTrafficFilters {
  includeIPs?: string[];
  excludeIPs?: string[];
}

export function deviceTrafficOrder(filters: DeviceTrafficFilters): string {
  const columns = { device: 'sourceIP', domain: 'domain', totalTraffic: '(totalUpload + totalDownload)',
    totalUpload: 'totalUpload', totalDownload: 'totalDownload', totalConnections: 'totalConnections', lastSeen: 'lastSeen' };
  const direction = filters.sortOrder === 'desc' ? 'DESC' : 'ASC';
  return `${columns[filters.sortBy ?? 'device']} ${direction}, sourceIP, domain, ip, rule, chain, matchedRule, rulePayload`;
}
