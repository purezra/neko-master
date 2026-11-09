import { describe, expect, it } from 'vitest';
import type { Connection } from '@neko-master/shared';
import { RecentConnections } from './recent-connections.js';

function connection(id = 'one', overrides: Partial<Connection> = {}): Connection {
  return { id, start: '2026-11-09T00:00:00Z', upload: 0, download: 0,
    metadata: { host: 'x.com', destinationIP: '1.2.3.4', sourceIP: '192.168.1.2' } as Connection['metadata'],
    chains: ['HK / 01', 'Twitter', 'Proxy'], providerChains: [], rule: 'RuleSet', rulePayload: 'twitter', ...overrides };
}

describe('RecentConnections', () => {
  it('retains zero-byte and ended connections, including old connections observed inside the window', () => {
    const store = new RecentConnections();
    store.observe(1, [connection()], 1_000_000);
    store.observe(1, [], 1_000_001);
    expect(store.query(1, 1, '', 0, 1_000_002).connections).toMatchObject([{ host: 'x.com', active: false, upload: 0, download: 0 }]);
    expect(store.query(1, 1, '', 0, 1_060_001).total).toBe(0);
    expect(store.query(1, 5, '', 0, 1_060_001).total).toBe(1);
    expect(store.query(1, 5, '', 0, 1_300_001).total).toBe(0);
  });

  it('updates counters, reactivation and last observation without mutating raw routing chains', () => {
    const store = new RecentConnections();
    const original = connection();
    store.observe(1, [original], 1_000_000);
    store.observe(1, [], 1_000_001);
    store.observe(1, [connection('one', { download: 100 })], 1_000_002);
    const result = store.query(1, 1, 'twitter', 0, 1_000_003);
    expect(result.connections[0]).toMatchObject({ firstSeen: 1_000_000, lastSeen: 1_000_002, download: 100, active: true });
    expect(result.connections[0].chains).toEqual(original.chains);
    expect(result.connections[0].chains).not.toBe(original.chains);
    expect(store.query(1, 1, '192.168.1.2', 0, 1_000_003).total).toBe(1);
  });

  it('isolates backend ids and clears observations on deletion or data reset', () => {
    const store = new RecentConnections();
    store.observe(1, [connection()], 1_000_000);
    store.observe(2, [connection('two')], 1_000_000);
    expect(store.query(1, 1, '', 0, 1_000_000).connections[0].id).toBe('one');
    store.clear(1);
    expect(store.query(1, 1, '', 0, 1_000_000).sampledAt).toBeNull();
    expect(store.query(2, 1, '', 0, 1_000_000).total).toBe(1);
  });

  it('bounds memory, exposes eviction and paginates after searching', () => {
    const store = new RecentConnections();
    store.observe(1, Array.from({ length: 10_050 }, (_, index) => connection(`id-${index}`)), 1_000_000);
    const result = store.query(1, 5, '', 0, 1_000_001);
    expect(result).toMatchObject({ total: 10_000, truncated: true });
    expect(result.connections).toHaveLength(100);
    expect(store.query(1, 5, '', 100, 1_000_001).connections.map(row => row.id))
      .not.toEqual(result.connections.map(row => row.id));
  });
});
