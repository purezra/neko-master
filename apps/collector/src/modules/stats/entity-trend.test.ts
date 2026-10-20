import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { StatsDatabase } from '../db/db.js';
import { createTestBackend, createTestDatabase } from '../../__tests__/helpers.js';
import { createApp } from '../app/app.js';
import { realtimeStore } from '../realtime/realtime.store.js';

describe('entity daily traffic trends', () => {
  let app: FastifyInstance, db: StatsDatabase, cleanup: () => void, backendId: number;
  const start = Date.parse('2026-10-11T08:00:00Z');
  const day = 86400000;
  const base = { domain: 'sample.test', ip: '203.0.113.1', chain: 'Node_% > Group', chains: ['Node_%', 'Group'], rule: 'Match', rulePayload: '', sourceIP: '192.168.1.2', upload: 10, download: 30 };
  beforeEach(async () => {
    ({ db, cleanup } = createTestDatabase());
    backendId = createTestBackend(db);
    app = await createApp({ port: 0, db, realtimeStore, logger: false, autoListen: false });
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await app.close(); realtimeStore.clearBackend(backendId); cleanup(); });
  const url = (dimension: string, value: string, days = 7) => `/api/stats/trend/entity-daily?${new URLSearchParams({ backendId: String(backendId), dimension, value, start: new Date(start).toISOString(), end: new Date(start + days * day).toISOString() })}`;

  it.each([2, 7, 30])('returns exactly %i points, fills gaps and isolates entity/backend and exclusive boundaries', async days => {
    const other = createTestBackend(db, 'other');
    db.batchUpdateTrafficStats(backendId, [
      { ...base, timestampMs: start - 1000 },
      { ...base, timestampMs: start + 1000 },
      { ...base, timestampMs: start + day - 1000 },
      { ...base, timestampMs: start + day },
      { ...base, timestampMs: start + days * day },
      { ...base, domain: 'other.test', timestampMs: start, upload: 999 },
    ]);
    db.batchUpdateTrafficStats(other, [{ ...base, timestampMs: start, upload: 999 }]);
    const response = await app.inject(url('domain', base.domain, days));
    expect(response.statusCode).toBe(200);
    const points = response.json().points;
    expect(points).toHaveLength(days);
    expect(points[0]).toMatchObject({ upload: 20, download: 60 });
    expect(points[1]).toMatchObject({ upload: 10, download: 30 });
    if (days > 2) expect(points[2]).toMatchObject({ upload: 0, download: 0 });
    expect(points.reduce((sum: number, p: { upload: number }) => sum + p.upload, 0)).toBe(30);
  });

  it('uses first-hop proxy totals and treats wildcard characters literally', async () => {
    db.batchUpdateTrafficStats(backendId, [
      { ...base, timestampMs: start },
      { ...base, chain: 'Node_% > Other group', chains: ['Node_%', 'Other group'], timestampMs: start },
      { ...base, chain: 'Other > Node_%', chains: ['Other', 'Node_%'], timestampMs: start, upload: 999 },
      { ...base, chain: 'Node_X > Group', chains: ['Node_X', 'Group'], timestampMs: start, upload: 999 },
    ]);
    expect((await app.inject(url('proxy', 'Node_%'))).json().points[0]).toMatchObject({ upload: 20, download: 60 });
  });

  it('reads hourly country facts with the same daily boundaries', async () => {
    db.updateCountryStats(backendId, 'SG', 'Singapore', 'Asia', 5, 25, start + 1000);
    db.updateCountryStats(backendId, 'US', 'United States', 'North America', 999, 999, start + 1000);
    const body = (await app.inject(url('country', 'SG'))).json();
    expect(body.points).toHaveLength(7);
    expect(body.points[0]).toMatchObject({ upload: 5, download: 25 });
    expect(body.points[1]).toMatchObject({ upload: 0, download: 0 });
  });

  it('splits devices, zero-fills gaps and preserves totals when grouping overflow and unknown devices', async () => {
    const other = createTestBackend(db, 'other devices');
    const updates = Array.from({ length: 12 }, (_, i) => ({ ...base, sourceIP: `192.168.1.${i + 1}`, upload: i + 1, timestampMs: start }));
    db.batchUpdateTrafficStats(backendId, [...updates,
      { ...base, sourceIP: '', upload: 50, timestampMs: start + day },
      { ...base, sourceIP: 'outside', upload: 9999, timestampMs: start + 7 * day },
    ]);
    db.batchUpdateTrafficStats(other, [{ ...base, upload: 9999, timestampMs: start }]);
    db.repos.device.saveProfile(backendId, { sourceIP: '192.168.1.12', displayName: 'Laptop', groupName: '' });
    const body = (await app.inject(`${url('domain', base.domain)}&includeDevices=true`)).json();
    expect(body.devices).toHaveLength(11);
    expect(body.devices.find((d: { sourceIP: string }) => d.sourceIP === '192.168.1.12').displayName).toBe('Laptop');
    expect(body.devices.some((d: { sourceIP: string }) => d.sourceIP === '')).toBe(true);
    expect(body.devices.some((d: { sourceIP: string | null }) => d.sourceIP === null)).toBe(true);
    for (let bucket = 0; bucket < 7; bucket++) {
      for (const metric of ['upload', 'download']) {
        expect(body.devices.reduce((sum: number, d: { points: Record<string, number>[] }) => sum + d.points[bucket][metric], 0)).toBe(body.points[bucket][metric]);
      }
    }
    expect((await app.inject(url('domain', base.domain))).json()).not.toHaveProperty('devices');
  });

  it('matches proxy devices literally and derives country devices from IP geolocation', async () => {
    db.batchUpdateTrafficStats(backendId, [{ ...base, timestampMs: start },
      { ...base, ip: '203.0.113.2', chains: ['Node_X', 'Group'], upload: 999, timestampMs: start }]);
    db.saveIPGeolocation(base.ip, { country: 'SG', country_name: 'Singapore', city: '', asn: '', as_name: '', as_domain: '', continent: 'Asia', continent_name: 'Asia' });
    const proxy = (await app.inject(`${url('proxy', 'Node_%')}&includeDevices=true`)).json();
    expect(proxy.devices[0].points[0]).toMatchObject({ upload: 10, download: 30 });
    const country = (await app.inject(`${url('country', 'SG')}&includeDevices=true`)).json();
    expect(country.devices).toHaveLength(1);
    expect(country.devices[0].points[0]).toMatchObject({ upload: 10, download: 30 });
  });

  it('routes device series through ClickHouse and obeys strict fallback', async () => {
    const reader = (app.statsService as any).clickHouseReader;
    vi.spyOn(reader, 'shouldUse').mockReturnValue(true);
    vi.spyOn(reader, 'shouldUseForRange').mockReturnValue(true);
    vi.spyOn(reader, 'getEntityDailyTotals').mockResolvedValue([{ bucket: 0, upload: 12, download: 34 }]);
    const details = vi.spyOn(reader, 'getEntityDeviceDailyTotals').mockResolvedValue([{ bucket: 0, sourceIP: base.sourceIP, upload: 12, download: 34 }]);
    expect((await app.inject(`${url('domain', base.domain)}&includeDevices=true`)).json().devices[0].points[0]).toMatchObject({ upload: 12, download: 34 });
    details.mockResolvedValue(null);
    expect((await app.inject(`${url('domain', base.domain)}&includeDevices=true`)).json().devices).toEqual([]);
    (app.statsService as any).strictStats = true;
    expect((await app.inject(`${url('domain', base.domain)}&includeDevices=true`)).statusCode).toBe(500);
  });

  it('rejects invalid dimensions, values, ranges and showcase access', async () => {
    for (const request of [url('invalid', 'x'), url('domain', ''), url('domain', 'x', 1), url('domain', 'x', 367), url('domain', 'x').replace('2026-10-11T08', '2026-10-11T08%3A30')]) {
      expect((await app.inject(request)).statusCode).toBe(400);
    }
    expect((await app.inject(url('domain', 'x').replace(`backendId=${backendId}`, 'backendId=999999'))).statusCode).toBe(404);
    vi.stubEnv('SHOWCASE_SITE_MODE', 'true');
    expect((await app.inject(url('domain', 'x'))).statusCode).toBe(403);
  });

  it('routes ClickHouse reads and falls back only when allowed', async () => {
    const reader = (app.statsService as unknown as { clickHouseReader: { shouldUse: () => boolean; shouldUseForRange: () => boolean; getEntityDailyTotals: () => unknown } }).clickHouseReader;
    vi.spyOn(reader, 'shouldUse').mockReturnValue(true);
    vi.spyOn(reader, 'shouldUseForRange').mockReturnValue(true);
    const query = vi.spyOn(reader, 'getEntityDailyTotals').mockResolvedValue([{ bucket: 1, upload: 12, download: 34 }]);
    expect((await app.inject(url('domain', base.domain))).json().points[1]).toMatchObject({ upload: 12, download: 34 });
    query.mockResolvedValue(null);
    expect((await app.inject(url('domain', base.domain))).json().points[1]).toMatchObject({ upload: 0, download: 0 });
    (app.statsService as unknown as { strictStats: boolean }).strictStats = true;
    expect((await app.inject(url('domain', base.domain))).statusCode).toBe(500);
  });
});
