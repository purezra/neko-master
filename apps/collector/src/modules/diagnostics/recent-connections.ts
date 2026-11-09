import type { Connection, DiagnosticConnection, DiagnosticConnectionsPage, DiagnosticServiceId } from '@neko-master/shared';
import { matchesDiagnosticService } from './service-filter.js';

const RETENTION_MS = 5 * 60_000;
const MAX_CONNECTIONS = 10_000;

type BackendObservations = {
  rows: Map<string, DiagnosticConnection>;
  sampledAt: number;
  observingSince: number;
  truncatedAt: number;
};

export class RecentConnections {
  private backends = new Map<number, BackendObservations>();

  observe(backendId: number, connections: Connection[], now = Date.now()): void {
    const state = this.backends.get(backendId) ?? {
      rows: new Map<string, DiagnosticConnection>(), sampledAt: now, observingSince: now, truncatedAt: 0,
    };
    state.sampledAt = now;
    this.backends.set(backendId, state);
    for (const [id, row] of state.rows) {
      if (row.lastSeen < now - RETENTION_MS) state.rows.delete(id);
      else row.active = false;
    }
    for (const connection of connections) {
      if (!connection || typeof connection.id !== 'string' || !connection.id) continue;
      const metadata = connection.metadata ?? {};
      const previous = state.rows.get(connection.id);
      const sameConnection = previous?.start === (connection.start || '');
      // Delete/reinsert so the oldest observations can be evicted in O(1).
      state.rows.delete(connection.id);
      state.rows.set(connection.id, {
        id: connection.id,
        host: metadata.host || metadata.sniffHost || '',
        destinationIP: metadata.destinationIP || '', destinationPort: String(metadata.destinationPort ?? ''),
        sourceIP: metadata.sourceIP || '', sourcePort: String(metadata.sourcePort ?? ''),
        network: metadata.network || '', process: metadata.process || '',
        chains: Array.isArray(connection.chains) ? [...connection.chains] : [],
        rule: connection.rule || '', rulePayload: connection.rulePayload || '',
        upload: connection.upload || 0, download: connection.download || 0, start: connection.start || '',
        firstSeen: sameConnection ? previous.firstSeen : now,
        firstUploadAt: connection.upload > 0 ? (sameConnection ? previous.firstUploadAt ?? now : now) : undefined,
        lastSeen: now, active: true,
      });
      if (state.rows.size > MAX_CONNECTIONS) {
        state.rows.delete(state.rows.keys().next().value!);
        state.truncatedAt = now;
      }
    }
  }

  query(backendId: number, minutes: number, search = '', offset = 0, now = Date.now(), service?: DiagnosticServiceId): DiagnosticConnectionsPage {
    const state = this.backends.get(backendId);
    if (!state) return { connections: [], total: 0, sampledAt: null, observingSince: null, truncated: false };
    const term = search.trim().toLowerCase();
    const matches: DiagnosticConnection[] = [];
    for (const [id, row] of state.rows) {
      if (row.lastSeen < now - RETENTION_MS) { state.rows.delete(id); continue; }
      if (row.lastSeen < now - minutes * 60_000) continue;
      if (service && !matchesDiagnosticService(row, service)) continue;
      if (term && ![row.host, row.destinationIP, row.sourceIP, row.process, row.rule, row.rulePayload, ...row.chains]
        .some(value => value.toLowerCase().includes(term))) continue;
      matches.push(row);
    }
    matches.sort((a, b) => b.lastSeen - a.lastSeen || b.firstSeen - a.firstSeen || a.id.localeCompare(b.id));
    return {
      connections: matches.slice(offset, offset + 100), total: matches.length,
      sampledAt: state.sampledAt, observingSince: state.observingSince,
      truncated: state.truncatedAt > now - minutes * 60_000,
    };
  }

  clear(backendId: number): void { this.backends.delete(backendId); }
}
