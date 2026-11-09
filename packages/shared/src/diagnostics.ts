/** Short-lived gateway observations, independent of durable traffic statistics. */
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
  lastSeen: number;
  active: boolean;
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
