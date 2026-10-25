import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { DomainUsageRow, EntityUsageRow } from '@neko-master/shared';
import type { StatsDatabase } from '../db/db.js';
import { createTestBackend, createTestDatabase } from '../../__tests__/helpers.js';
import { createApp } from '../app/app.js';
import { realtimeStore } from '../realtime/realtime.store.js';

describe('overview usage details', () => {
  let app: FastifyInstance, db: StatsDatabase, cleanup: () => void, backendId: number;
  const start = '2026-10-24T16:00:00Z';
  const base = { domain: 'sample.test', ip: '203.0.113.1', chain: 'Node_% > Group', chains: ['Node_%', 'Group'],
    rule: 'Match', rulePayload: '', sourceIP: '192.168.1.2', upload: 10, download: 90, timestampMs: Date.parse(start) + 1000 };
  beforeEach(async () => {
    ({ db, cleanup } = createTestDatabase()); backendId = createTestBackend(db);
    app = await createApp({ port: 0, db, realtimeStore, logger: false, autoListen: false });
    db.saveIPGeolocation(base.ip, { country: 'US', country_name: 'United States', city: '', asn: '', as_name: '', as_domain: '', continent: 'North America', continent_name: 'North America' });
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await app.close(); realtimeStore.clearBackend(backendId); cleanup(); });
  const url = (path: string, values: Record<string, string> = {}, hours = 12) => `/api/stats/${path}?${new URLSearchParams({ backendId: String(backendId), start,
    end: new Date(Date.parse(start) + hours * 3600000 - 1).toISOString(), ...values })}`;

  it.each([2, 12])('attributes an exact domain across devices and chains using %ih buckets', async hours => {
    const other = createTestBackend(db, 'other');
    db.batchUpdateTrafficStats(backendId, [base, { ...base, sourceIP: '192.168.1.3', chains: ['DIRECT'], upload: 0, download: 300 },
      { ...base, domain: 'sub.sample.test', upload: 999 }, { ...base, timestampMs: Date.parse(start) + hours * 3600000, upload: 999 }]);
    db.batchUpdateTrafficStats(other, [{ ...base, upload: 999 }]);
    db.repos.device.saveProfile(backendId, { sourceIP: base.sourceIP, displayName: 'Laptop', groupName: '' });
    const response = await app.inject(url('domains/usage', { domain: base.domain }, hours));
    expect(response.statusCode).toBe(200);
    const rows = response.json<DomainUsageRow[]>();
    expect(rows).toHaveLength(2);
    expect(rows.find(row => row.sourceIP === base.sourceIP)).toMatchObject({ displayName: 'Laptop', totalUpload: 10, totalDownload: 90 });
    expect(rows.reduce((sum, row) => sum + row.totalUpload + row.totalDownload, 0)).toBe(400);
  });

  it.each(['proxy', 'country'] as const)('returns true top 3 %s associations and keeps all usage in totals', async dimension => {
    db.batchUpdateTrafficStats(backendId, Array.from({ length: 5 }, (_, index) => ({ ...base, sourceIP: `192.168.1.${index + 1}`,
      domain: `domain${index}.test`, upload: 0, download: (index + 1) * 100 })));
    db.batchUpdateTrafficStats(backendId, [{ ...base, chains: ['Node_X', 'Group'], ip: '203.0.113.9', download: 999 }]);
    const value = dimension === 'proxy' ? 'Node_%' : 'US';
    const response = await app.inject(url('usage', { dimension, value }));
    expect(response.statusCode).toBe(200);
    const rows = response.json<EntityUsageRow[]>();
    expect(rows.find(row => row.kind === 'total')).toMatchObject({ totalDownload: 1500, totalConnections: 5 });
    const devices = rows.filter(row => row.kind === 'device');
    const domains = rows.filter(row => row.kind === 'domain');
    expect(devices.map(row => row.key)).toEqual(['192.168.1.5', '192.168.1.4', '192.168.1.3']);
    expect(domains.map(row => row.key)).toEqual(['domain4.test', 'domain3.test', 'domain2.test']);
    expect(devices.reduce((sum, row) => sum + row.totalDownload, 0)).toBe(1200);
    const connections = (await app.inject(url('usage', { dimension, value, metric: 'connections' }))).json<EntityUsageRow[]>();
    expect(connections.filter(row => row.kind === 'device').map(row => row.key)).toEqual(['192.168.1.1', '192.168.1.2', '192.168.1.3']);
  });

  it('bounds domain combinations while retaining all traffic in overflow', async () => {
    db.batchUpdateTrafficStats(backendId, Array.from({ length: 505 }, (_, index) => ({ ...base, sourceIP: `device${index}`, chains: [`Node${index}`] })));
    const rows = (await app.inject(url('domains/usage', { domain: base.domain }))).json<DomainUsageRow[]>();
    expect(rows).toHaveLength(501);
    expect(rows.find(row => row.sourceIP === null)).toMatchObject({ chain: null, totalUpload: 50, totalDownload: 450 });
    expect(rows.reduce((sum, row) => sum + row.totalDownload, 0)).toBe(505 * 90);
  });

  it('handles empty, unknown, invalid range, invalid dimension and missing backend', async () => {
    expect((await app.inject(url('domains/usage', { domain: base.domain }))).json()).toEqual([]);
    db.batchUpdateTrafficStats(backendId, [{ ...base, sourceIP: '', domain: '', ip: '203.0.113.9' }]);
    const unknown = (await app.inject(url('usage', { dimension: 'country', value: 'UNKNOWN' }))).json<EntityUsageRow[]>();
    expect(unknown.find(row => row.kind === 'device')).toMatchObject({ key: '', totalDownload: 90 });
    expect((await app.inject(url('usage', { dimension: 'domain', value: base.domain }))).statusCode).toBe(400);
    expect((await app.inject(url('domains/usage', { domain: base.domain, start: 'invalid' }))).statusCode).toBe(400);
    expect((await app.inject(url('domains/usage', { domain: base.domain, start: '', end: '' }))).statusCode).toBe(400);
    expect((await app.inject(url('domains/usage', { domain: base.domain, backendId: '9999' }))).statusCode).toBe(404);
  });

  it('routes through ClickHouse, labels device profiles and preserves strict fallback', async () => {
    const reader = (app.statsService as any).clickHouseReader;
    vi.spyOn(reader, 'shouldUse').mockReturnValue(true);
    vi.spyOn(reader, 'shouldUseForRange').mockReturnValue(true);
    vi.spyOn(reader, 'getDomainUsage').mockResolvedValue([{ sourceIP: base.sourceIP, chain: 'Node > Group', totalUpload: 5, totalDownload: 15, totalConnections: 1 }]);
    vi.spyOn(reader, 'getEntityUsage').mockResolvedValue([{ kind: 'device', key: base.sourceIP, totalUpload: 5, totalDownload: 15, totalConnections: 1 }]);
    db.repos.device.saveProfile(backendId, { sourceIP: base.sourceIP, displayName: 'Phone', groupName: '' });
    expect((await app.inject(url('domains/usage', { domain: base.domain }))).json()[0].displayName).toBe('Phone');
    expect((await app.inject(url('usage', { dimension: 'country', value: 'US' }))).json()[0].displayName).toBe('Phone');
    reader.getDomainUsage.mockResolvedValue(null); reader.getEntityUsage.mockResolvedValue(null);
    (app.statsService as any).strictStats = true;
    expect((await app.inject(url('domains/usage', { domain: base.domain }))).statusCode).toBe(500);
    expect((await app.inject(url('usage', { dimension: 'proxy', value: 'Node' }))).statusCode).toBe(500);
  });
});
