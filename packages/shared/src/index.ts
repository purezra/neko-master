import type { GeoIPInfo } from "./geo-ip-utils.js";

// Gateway Connection Metadata
export interface ConnectionMetadata {
  network: string;
  type: string;
  sourceIP: string;
  destinationIP: string;
  sourceGeoIP: string[] | null;
  destinationGeoIP: string[] | null;
  sourceIPASN: string;
  destinationIPASN: string;
  sourcePort: string;
  destinationPort: string;
  inboundIP: string;
  inboundPort: string;
  inboundName: string;
  inboundUser: string;
  host: string;
  dnsMode: string;
  uid: number;
  process: string;
  processPath: string;
  specialProxy: string;
  specialRules: string;
  remoteDestination: string;
  dscp: number;
  sniffHost: string;
}

export interface Connection {
  id: string;
  metadata: ConnectionMetadata;
  upload: number;
  download: number;
  start: string;
  chains: string[];
  providerChains: string[];
  rule: string;
  rulePayload: string;
}

export interface ConnectionsData {
  downloadTotal: number;
  uploadTotal: number;
  connections: Connection[];
  memory?: number;
}

// Aggregated Statistics
export interface DomainStats {
  domain: string;
  ips: string[];
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
  rules: string[];
  chains: string[];
}

export interface IPStats {
  ip: string;
  domains: string[];
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
  asn?: string;
  geoIP?: GeoIPInfo;
  chains?: string[];
}

export interface HourlyStats {
  hour: string;
  upload: number;
  download: number;
  connections: number;
}

export interface TrafficTrendPoint {
  time: string;
  upload: number;
  download: number;
}

export interface DailyStats {
  date: string;
  upload: number;
  download: number;
  connections: number;
}

export interface ProxyStats {
  chain: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
}

export interface DeviceProfile {
  sourceIP: string;
  displayName: string;
  groupName: string;
}

export interface ComparisonRange {
  start: string;
  /** Exclusive end. */
  end: string;
}

export interface TrafficComparisonRow {
  key: string;
  currentBytes: number;
  baselineBytes: number;
  displayName?: string;
  groupName?: string;
}

export interface DeviceDomainComparisonOptions {
  offset: number;
  limit: number;
  search: string;
  filter: 'all' | 'increased' | 'decreased' | 'new';
}

export interface DeviceDomainComparisonPage {
  rows: TrafficComparisonRow[];
  total: number;
  currentBytes: number;
  baselineBytes: number;
}

export interface DeviceDomainComparison extends DeviceDomainComparisonPage {
  device: DeviceProfile;
  currentRange: ComparisonRange;
  baselineRange: ComparisonRange;
}

export interface TrafficComparisonTotals {
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  uniqueDomains: number;
  uniqueIPs: number;
}

export interface TrafficComparison {
  currentRange: ComparisonRange;
  baselineRange: ComparisonRange;
  current: TrafficComparisonTotals;
  baseline: TrafficComparisonTotals;
  domains: TrafficComparisonRow[];
  devices: TrafficComparisonRow[];
}

export interface DeviceStats {
  displayName?: string;
  groupName?: string;
  sourceIP: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
}

export interface RuleStats {
  rule: string;
  finalProxy: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
}

export interface RuleProxyMapping {
  rule: string;
  proxy: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
}

export interface CountryStats {
  country: string;
  countryName: string;
  continent: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen?: string;
}

// Per-proxy traffic breakdown for a specific domain or IP
export interface ProxyTrafficStats {
  chain: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
}

export interface RuleChainFlowAll {
  nodes: Array<{
    name: string;
    layer: number;
    nodeType: "rule" | "group" | "proxy";
    totalUpload: number;
    totalDownload: number;
    totalConnections: number;
    rules: string[];
  }>;
  links: Array<{
    source: number;
    target: number;
    rules: string[];
  }>;
  rulePaths: Record<string, { nodeIndices: number[]; linkIndices: number[] }>;
  maxLayer: number;
}

// API Response Types
export interface StatsSummary {
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  totalDomains: number;
  totalIPs: number;
  totalProxies: number;
  totalRules?: number;
  todayUpload?: number;
  todayDownload?: number;
  activeConnections?: number;
  topDomains: DomainStats[];
  topIPs: IPStats[];
  proxyStats: ProxyStats[];
  countryStats?: CountryStats[];
  deviceStats?: DeviceStats[];
  deviceDetailSourceIP?: string;
  deviceDomains?: DomainStats[];
  deviceIPs?: IPStats[];
  proxyDetailChain?: string;
  proxyDomains?: DomainStats[];
  proxyIPs?: IPStats[];
  ruleDetailName?: string;
  ruleDomains?: DomainStats[];
  ruleIPs?: IPStats[];
  ruleChainFlowAll?: RuleChainFlowAll;
  domainsPage?: { data: DomainStats[]; total: number };
  domainsPageQuery?: {
    offset: number;
    limit: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    search?: string;
  };
  ipsPage?: { data: IPStats[]; total: number };
  ipsPageQuery?: {
    offset: number;
    limit: number;
    sortBy?: string;
    sortOrder?: "asc" | "desc";
    search?: string;
  };
  trendStats?: TrafficTrendPoint[];
  ruleStats?: RuleStats[];
  hourlyStats: HourlyStats[];
}

export interface TimeRangeQuery {
  start?: string;
  end?: string;
  limit?: number;
}

// WebSocket Events
export interface StatsUpdateEvent {
  type: 'stats_update';
  data: ConnectionsData;
  timestamp: string;
}

export interface AggregatedUpdateEvent {
  type: 'aggregated_update';
  domains: DomainStats[];
  totalStats: {
    upload: number;
    download: number;
  };
  timestamp: string;
}

export type WebSocketEvent = StatsUpdateEvent | AggregatedUpdateEvent;

export interface AuthState {
  enabled: boolean;
  hasToken: boolean;
  forceAccessControlOff?: boolean;
  showcaseMode?: boolean;
}

// Surge API Types
export interface SurgeRequest {
  id: string;
  time: number;
  timestamp?: string;
  policyName: string;
  originalPolicyName: string;
  rule: string;
  processPath: string;
  remoteHost: string;
  remoteAddress?: string;
  remotePort?: number;
  localAddress?: string;
  localPort?: number;
  sourceAddress?: string;
  sourcePort?: number;
  inBytes: number;
  outBytes: number;
  inCurrentSpeed?: number;
  outCurrentSpeed?: number;
  inMaxSpeed?: number;
  outMaxSpeed?: number;
  status?: string;
  completed?: boolean;
  disconnected?: boolean;
  failed?: boolean;
  rejected?: boolean;
  startDate?: number;
  completedDate?: number;
  setupCompletedDate?: number;
  URL?: string;
  method?: string;
  notes?: string[];
}

export interface SurgeRequestsData {
  requests: SurgeRequest[];
}

export interface SurgePolicy {
  name: string;
  type: string;
  lineHash: string;
}

export interface SurgePolicyGroup {
  name: string;
  type: string;
  lineHash: string;
  policy: string;
  policies: string[];
  icon?: string;
}

export interface SurgePoliciesData {
  proxies: SurgePolicy[];
  groups: SurgePolicyGroup[];
}

// Surge Rules API Response
export interface SurgeRuleItem {
  type: string;
  payload: string;
  policy: string;
  raw: string;
}

export interface SurgeRulesData {
  rules: SurgeRuleItem[];
  availablePolicies: string[];
}

// Backend Type
export type BackendType = 'clash' | 'surge';

// Gateway utilities
export * from './gateway-utils.js';
export * from './geo-ip-utils.js';

export type TrafficEntityDimension = 'domain' | 'proxy' | 'country';
export interface DailyTrafficTotals {
  bucket: number;
  upload: number;
  download: number;
}
export interface DeviceDailyTrafficTotals extends DailyTrafficTotals {
  /** null represents devices outside the top ten; empty string is unknown. */
  sourceIP: string | null;
}
export interface DeviceTrafficDetail {
  sourceIP: string;
  displayName?: string;
  groupName?: string;
  domain: string;
  ip: string;
  rule: string;
  chain: string;
  /** Empty for historical rows or gateways that did not report a rule. */
  matchedRule?: string;
  rulePayload?: string;
  totalUpload: number;
  totalDownload: number;
  totalConnections: number;
  lastSeen: string;
}
export interface DeviceTrafficFilters {
  sourceIP?: string;
  groupName?: string;
  ungrouped?: boolean;
  domain?: string;
  rule?: string;
  policyGroup?: string;
  sortBy?: 'device' | 'domain' | 'totalTraffic' | 'totalUpload' | 'totalDownload' | 'totalConnections' | 'lastSeen';
  sortOrder?: 'asc' | 'desc';
}
export interface DeviceTrafficDetailPage {
  rows: DeviceTrafficDetail[];
  hasMore: boolean;
}
export interface EntityDailyTrend {
  dimension: TrafficEntityDimension;
  value: string;
  start: string;
  end: string;
  points: Array<{ start: string; end: string; upload: number; download: number }>;
  devices?: Array<{
    sourceIP: string | null;
    displayName?: string;
    points: EntityDailyTrend['points'];
  }>;
}
