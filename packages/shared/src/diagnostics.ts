/** Short-lived gateway observations, independent of durable traffic statistics. */
export const DIAGNOSTIC_SERVICE_IDS = [
  'chatgpt', 'gemini', 'grok', 'perplexity', 'telegram', 'twitter', 'claude',
  'workbuddy', 'cursor', 'opencode', 'github', 'tabbit', 'alma', 'muse', 'cline',
  'downloads', 'cloudflare', 'youtube',
] as const;
export type DiagnosticServiceId = typeof DIAGNOSTIC_SERVICE_IDS[number];

export interface DiagnosticConnection {
  id: string;
  host: string;
  destinationIP: string;
  destinationPort: string;
  sourceIP: string;
  sourcePort: string;
  network: string;
  process: string;
  chains: string[];
  rule: string;
  rulePayload: string;
  upload: number;
  download: number;
  start: string;
  firstSeen: number;
  firstUploadAt?: number;
  lastSeen: number;
  active: boolean;
}

export type DiagnosticConnectionStatus = 'stale' | 'rejected' | 'responded' | 'waiting' | 'suspectedTimeout' | 'noResponse';

/** Snapshot evidence cannot establish whether an application or website succeeded. */
export function getDiagnosticConnectionStatus(connection: DiagnosticConnection, sampledAt: number | null, now: number): DiagnosticConnectionStatus {
  if (sampledAt === null || now - sampledAt > 15_000) return 'stale';
  if (connection.chains.some(hop => ['REJECT', 'REJECT-DROP'].includes(hop.toUpperCase()))) return 'rejected';
  if (connection.download > 0) return 'responded';
  if (!connection.active) return 'noResponse';
  if (connection.network.toLowerCase() === 'tcp' && connection.upload > 0 && connection.lastSeen - (connection.firstUploadAt ?? connection.firstSeen) >= 10_000) return 'suspectedTimeout';
  return 'waiting';
}

export interface DiagnosticConnectionsPage {
  connections: DiagnosticConnection[];
  total: number;
  sampledAt: number | null;
  observingSince: number | null;
  truncated: boolean;
}

export interface DiagnosticProxy {
  name: string;
  type: string;
  now?: string;
  all?: string[];
  alive?: boolean;
  history?: Array<{ time: string; delay: number }>;
  'provider-name'?: string;
}

export interface DiagnosticProxies {
  proxies: Record<string, DiagnosticProxy>;
  nodes: DiagnosticNode[];
  canControl: boolean;
}

export interface DiagnosticNode extends DiagnosticProxy {
  id: string;
  provider?: string;
}

export interface DiagnosticHealthResult {
  id: string;
  name: string;
  delay: number | null;
}

export interface DiagnosticHealthState {
  running: boolean;
  total: number;
  results: DiagnosticHealthResult[];
  startedAt: number | null;
  finishedAt: number | null;
}
