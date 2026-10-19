import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { StatsDatabase } from '../db/db.js';
import { createTestBackend, createTestDatabase } from '../../__tests__/helpers.js';
import { createApp } from '../app/app.js';
import { realtimeStore } from '../realtime/realtime.store.js';

describe('device domain comparison', () => {
  let app: FastifyInstance, db: StatsDatabase, cleanup: () => void, backendId: number;
  const sourceIP = '192.168.1.2';
  const currentStart = Date.parse('2026-10-19T08:00:00Z');
  const base = { domain: 'rise.test', ip: '203.0.113.1', chain: 'DIRECT', chains: ['DIRECT'], rule: 'Match', rulePayload: '', sourceIP };
  const url = (extra: Record<string, string> = {}, hours = 24) => `/api/stats/comparison/device-domains?${new URLSearchParams({
    backendId: String(backendId), sourceIP, start: new Date(currentStart).toISOString(), end: new Date(currentStart + hours * 3600000).toISOString(),
    baselineStart: new Date(currentStart - hours * 3600000).toISOString(), baselineEnd: new Date(currentStart).toISOString(), ...extra,
  })}`;
  beforeEach(async () => {
    ({ db, cleanup } = createTestDatabase()); backendId = createTestBackend(db);
    app = await createApp({ port: 0, db, realtimeStore, logger: false, autoListen: false });
  });
  afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await app.close(); realtimeStore.clearBackend(backendId); cleanup(); });
  function seed() {
    const rows = [['rise.test', 100, 40], ['fall.test', 10, 90], ['stopped.test', 0, 60], ['new.test', 30, 0], ['steady.test', 25, 25]] as const;
    db.batchUpdateTrafficStats(backendId, rows.flatMap(([domain, current, baseline]) => [
      { ...base, domain, upload: 0, download: current, timestampMs: currentStart + 1000 },
      { ...base, domain, upload: 0, download: baseline, timestampMs: currentStart - 1000 },
    ]));
  }
  it.each([1, 24])('includes increased, decreased, historical-only and unchanged domains over %i hours', async hours => {
    seed();
    const other = createTestBackend(db, 'other');
    db.batchUpdateTrafficStats(other, [{ ...base, upload: 999, download: 999, timestampMs: currentStart }]);
    db.batchUpdateTrafficStats(backendId, [
      { ...base, sourceIP: '192.168.1.3', upload: 999, download: 999, timestampMs: currentStart },
      { ...base, upload: 999, download: 999, timestampMs: currentStart + hours * 3600000 },
      { ...base, domain: '', upload: 999, download: 999, timestampMs: currentStart },
    ]);
    db.repos.device.saveProfile(backendId, { sourceIP, displayName: 'My PC', groupName: 'Work' });
    const response = await app.inject(url({}, hours));
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ total: 5, currentBytes: 165, baselineBytes: 215, device: { sourceIP, displayName: 'My PC', groupName: 'Work' } });
    expect(response.json().rows).toEqual([
      { key: 'fall.test', currentBytes: 10, baselineBytes: 90 },
      { key: 'rise.test', currentBytes: 100, baselineBytes: 40 },
      { key: 'stopped.test', currentBytes: 0, baselineBytes: 60 },
      { key: 'new.test', currentBytes: 30, baselineBytes: 0 },
      { key: 'steady.test', currentBytes: 25, baselineBytes: 25 },
    ]);
  });
  it.each([['increased', ['rise.test', 'new.test']], ['decreased', ['fall.test', 'stopped.test']], ['new', ['new.test']]] as const)('filters %s without changing device totals', async (filter, keys) => {
    seed(); const response = (await app.inject(url({ filter }))).json();
    expect(response.rows.map((row: { key: string }) => row.key)).toEqual(keys);
    expect(response).toMatchObject({ total: keys.length, currentBytes: 165, baselineBytes: 215 });
  });
  it('paginates the full domain union and keeps stable totals and literal case-insensitive searches', async () => {
    seed();
    const first = (await app.inject(url({ limit: '2' }))).json();
    const second = (await app.inject(url({ limit: '2', offset: '2' }))).json();
    expect(first.total).toBe(5); expect(second.total).toBe(5);
    expect(second.rows.map((row: { key: string }) => row.key)).toEqual(['stopped.test', 'new.test']);
    expect((await app.inject(url({ search: 'RISE' }))).json()).toMatchObject({ total: 1, currentBytes: 165, baselineBytes: 215 });
    db.batchUpdateTrafficStats(backendId, [{ ...base, domain: 'literal%_.test', upload: 1, download: 0, timestampMs: currentStart }]);
    expect((await app.inject(url({ search: '%_' }))).json().rows).toEqual([{ key: 'literal%_.test', currentBytes: 1, baselineBytes: 0 }]);
    expect((await app.inject(url({ search: "' OR 1=1 --" }))).json().total).toBe(0);
  });
  it('returns an empty page for an unobserved device and validates input and showcase limits', async () => {
    expect((await app.inject(url())).json()).toMatchObject({ rows: [], total: 0, currentBytes: 0, baselineBytes: 0 });
    const invalidQueries: Record<string, string>[] = [{ sourceIP: 'bad' }, { filter: 'bad' }, { offset: '-1' }, { limit: '101' }, { start: 'bad' }, { baselineStart: new Date(currentStart).toISOString() }];
    for (const extra of invalidQueries) {
      expect((await app.inject(url(extra))).statusCode).toBe(400);
    }
    expect((await app.inject(url({ backendId: '999999' }))).statusCode).toBe(404);
    vi.stubEnv('SHOWCASE_SITE_MODE', 'true');
    expect((await app.inject(url().replaceAll('2026', '2020'))).statusCode).toBe(400);
  });
  it('uses ClickHouse as one source and falls back together on partial data', async () => {
    seed();
    const reader = (app.statsService as unknown as { clickHouseReader: { shouldUse: () => boolean; shouldUseForRange: () => boolean; getDeviceDomainComparison: () => unknown } }).clickHouseReader;
    vi.spyOn(reader, 'shouldUse').mockReturnValue(true); vi.spyOn(reader, 'shouldUseForRange').mockReturnValue(true);
    const query = vi.spyOn(reader, 'getDeviceDomainComparison').mockResolvedValue({ rows: [], total: 0, currentBytes: 700, baselineBytes: 600 });
    expect((await app.inject(url())).json()).toMatchObject({ currentBytes: 700, baselineBytes: 600 });
    query.mockResolvedValue(null);
    expect((await app.inject(url())).json()).toMatchObject({ currentBytes: 165, baselineBytes: 215, total: 5 });
    (app.statsService as unknown as { strictStats: boolean }).strictStats = true;
    expect((await app.inject(url())).statusCode).toBe(500);
  });
});
