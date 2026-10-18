import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { StatsDatabase } from '../db/db.js';
import { createTestBackend, createTestDatabase } from '../../__tests__/helpers.js';
import { createApp } from '../app/app.js';
import { realtimeStore } from '../realtime/realtime.store.js';

describe('device profiles and traffic comparison', () => {
  let app: FastifyInstance;
  let db: StatsDatabase;
  let cleanup: () => void;
  let backendId: number;
  beforeEach(async () => {
    ({ db, cleanup } = createTestDatabase());
    backendId = createTestBackend(db);
    app = await createApp({ port: 0, db, realtimeStore, logger: false, autoListen: false });
  });
  afterEach(async () => { vi.unstubAllEnvs(); await app.close(); realtimeStore.clearBackend(backendId); cleanup(); });

  const profile = { sourceIP: '192.168.1.2', displayName: 'My desktop', groupName: 'Work' };
  const base = { domain: 'example.test', ip: '203.0.113.1', chain: 'DIRECT', chains: ['DIRECT'], rule: 'Match', rulePayload: '', sourceIP: profile.sourceIP };

  it('saves, reads, clears and isolates metadata by backend', async () => {
    const other = createTestBackend(db, 'other');
    const save = await app.inject({ method: 'PUT', url: `/api/stats/devices/profiles?backendId=${backendId}`, payload: { ...profile, displayName: ' My desktop ' } });
    expect(save.statusCode).toBe(200);
    expect(save.json()).toEqual(profile);
    expect((await app.inject(`/api/stats/devices/profiles?backendId=${backendId}`)).json()).toEqual([profile]);
    expect((await app.inject(`/api/stats/devices/profiles?backendId=${other}`)).json()).toEqual([]);
    db.batchUpdateTrafficStats(backendId, [{ ...base, upload: 1, download: 2 }]);
    expect((await app.inject(`/api/stats/devices?backendId=${backendId}`)).json()[0]).toMatchObject(profile);
    db.deleteBackendData(backendId);
    expect(db.repos.device.getProfiles(backendId)).toEqual([profile]);
    db.deleteBackend(backendId);
    expect(db.repos.device.getProfiles(backendId)).toEqual([]);
  });

  it('removes an empty profile instead of retaining stale names', async () => {
    db.repos.device.saveProfile(backendId, profile);
    const response = await app.inject({ method: 'PUT', url: `/api/stats/devices/profiles?backendId=${backendId}`, payload: { ...profile, displayName: '', groupName: '' } });
    expect(response.statusCode).toBe(200);
    expect(db.repos.device.getProfiles(backendId)).toEqual([]);
  });

  it.each([
    { ...profile, sourceIP: 'not-an-ip' },
    { ...profile, displayName: 'a'.repeat(81) },
    { ...profile, groupName: 'a'.repeat(41) },
  ])('rejects invalid profile data', async payload => {
    expect((await app.inject({ method: 'PUT', url: `/api/stats/devices/profiles?backendId=${backendId}`, payload })).statusCode).toBe(400);
  });

  it('blocks metadata writes in showcase mode', async () => {
    vi.stubEnv('SHOWCASE_SITE_MODE', 'true');
    expect((await app.inject({ method: 'PUT', url: `/api/stats/devices/profiles?backendId=${backendId}`, payload: profile })).statusCode).toBe(403);
  });

  it.each([1, 24])('compares %i-hour periods without mixing adjacent buckets or backends', async hours => {
    const end = Date.parse('2026-10-18T08:00:00Z');
    const span = hours * 3600000;
    const boundary = end - span;
    db.repos.device.saveProfile(backendId, profile);
    db.batchUpdateTrafficStats(backendId, [
      { ...base, upload: 1, download: 9, timestampMs: boundary - 1000 },
      { ...base, upload: 1, download: 49, timestampMs: boundary + 1000 },
      { ...base, upload: 9999, download: 9999, timestampMs: end },
    ]);
    const other = createTestBackend(db, 'other');
    db.batchUpdateTrafficStats(other, [{ ...base, upload: 9999, download: 9999, timestampMs: boundary + 1000 }]);
    const query = new URLSearchParams({ backendId: String(backendId), start: new Date(boundary).toISOString(), end: new Date(end).toISOString(), baselineStart: new Date(boundary - span).toISOString(), baselineEnd: new Date(boundary).toISOString() });
    const response = await app.inject(`/api/stats/comparison?${query}`);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.current.totalDownload).toBe(49);
    expect(body.baseline.totalDownload).toBe(9);
    expect(body.domains).toEqual([{ key: base.domain, currentBytes: 50, baselineBytes: 10 }]);
    expect(body.devices[0]).toMatchObject({ key: profile.sourceIP, currentBytes: 50, baselineBytes: 10, displayName: profile.displayName, groupName: profile.groupName });
  });

  it('ranks changes over all domains, including ones absent from a previous Top N', async () => {
    const updates = Array.from({ length: 20 }, (_, index) => ({ ...base, domain: `steady-${index}.test`, upload: 0, download: 100000, timestampMs: Date.parse('2026-10-17T08:30:00Z') }));
    db.batchUpdateTrafficStats(backendId, [...updates, ...updates.map(update => ({ ...update, timestampMs: Date.parse('2026-10-18T08:30:00Z') })), { ...base, domain: 'new-small.test', upload: 2, download: 3, timestampMs: Date.parse('2026-10-18T08:30:00Z') }]);
    const result = await app.statsService.getTrafficComparisonWithRouting(backendId, { start: '2026-10-18T08:00:00Z', end: '2026-10-18T09:00:00Z' }, { start: '2026-10-17T08:00:00Z', end: '2026-10-17T09:00:00Z' });
    expect(result.domains).toEqual([{ key: 'new-small.test', currentBytes: 5, baselineBytes: 0 }]);
  });

  it('rejects invalid or misleading comparison ranges', async () => {
    for (const suffix of [
      '',
      '&start=bad&end=bad&baselineStart=bad&baselineEnd=bad',
      '&start=2026-10-18T08:00:00Z&end=2026-10-18T10:00:00Z&baselineStart=2026-10-17T08:00:00Z&baselineEnd=2026-10-17T09:00:00Z',
      '&start=2026-10-18T08:00:00Z&end=2026-10-18T10:00:00Z&baselineStart=2026-10-18T09:00:00Z&baselineEnd=2026-10-18T11:00:00Z',
    ]) expect((await app.inject(`/api/stats/comparison?backendId=${backendId}${suffix}`)).statusCode).toBe(400);
  });

  it('enriches ClickHouse device reads with SQLite configuration', async () => {
    db.repos.device.saveProfile(backendId, profile);
    Object.assign(app.statsService, { clickHouseReader: {
      shouldUseForRange: () => true,
      getDeviceStats: async () => [{ sourceIP: profile.sourceIP, totalUpload: 1, totalDownload: 2, totalConnections: 1, lastSeen: '2026-10-17T08:00:00Z' }],
    } });
    const result = await app.statsService.getDeviceStatsWithRouting(backendId, { active: true, start: '2026-10-17T08:00:00Z', end: '2026-10-17T09:00:00Z', persistedOnly: true }, 50);
    expect(result[0]).toMatchObject(profile);
  });

  it('falls back as one comparison when ClickHouse returns only partial results', async () => {
    db.batchUpdateTrafficStats(backendId, [{ ...base, upload: 1, download: 2, timestampMs: Date.parse('2026-10-18T08:30:00Z') }]);
    Object.assign(app.statsService, { clickHouseReader: {
      shouldUseForRange: () => true,
      getSummary: async () => ({ totalUpload: 999, totalDownload: 999, totalConnections: 999, uniqueDomains: 999, uniqueIPs: 999 }),
      getComparisonGrowth: async () => null,
    } });
    const result = await app.statsService.getTrafficComparisonWithRouting(backendId, { start: '2026-10-18T08:00:00Z', end: '2026-10-18T09:00:00Z' }, { start: '2026-10-17T08:00:00Z', end: '2026-10-17T09:00:00Z' });
    expect(result.current.totalDownload).toBe(2);
    expect(result.domains[0].currentBytes).toBe(3);
  });
});
