import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { StatsDatabase } from '../db/db.js';
import { createTestBackend, createTestDatabase } from '../../__tests__/helpers.js';
import { createApp } from '../app/app.js';
import { realtimeStore } from '../realtime/realtime.store.js';

describe('device traffic detail exports', () => {
  let app: FastifyInstance, db: StatsDatabase, cleanup: () => void, backendId: number;
  const start = Date.parse('2026-10-11T08:00:00Z');
  const base = { domain: 'sample.test', ip: '203.0.113.1', chains: ['Node', 'Group'], chain: 'Node > Group', rule: 'Match', rulePayload: '', sourceIP: '192.168.1.2', upload: 10, download: 30, timestampMs: start };
  beforeEach(async () => {
    ({ db, cleanup } = createTestDatabase()); backendId = createTestBackend(db);
    app = await createApp({ port: 0, db, realtimeStore, logger: false, autoListen: false });
  });
  afterEach(async () => { vi.restoreAllMocks(); await app.close(); realtimeStore.clearBackend(backendId); cleanup(); });
  const url = (hours = 24, offset = 0, limit = 1000) => `/api/stats/devices/traffic-details?${new URLSearchParams({
    backendId: String(backendId), start: new Date(start).toISOString(), end: new Date(start + hours * 3600000 - 1).toISOString(), offset: String(offset), limit: String(limit),
  })}`;

  it.each([1, 24])('keeps device/domain/rule/chain traffic associated for %i hour ranges and paginates without loss', async hours => {
    const other = createTestBackend(db, 'Other');
    db.batchUpdateTrafficStats(backendId, [base, base,
      { ...base, chains: ['Second', 'Other group'], sourceIP: '192.168.1.3', upload: 7 },
      { ...base, domain: '', ip: '203.0.113.2', chains: ['DIRECT'], rule: 'IPCIDR', rulePayload: '203.0.113.0/24' },
      { ...base, upload: 9999, timestampMs: start + hours * 3600000 },
    ]);
    db.batchUpdateTrafficStats(other, [{ ...base, upload: 9999 }]);
    db.repos.device.saveProfile(backendId, { sourceIP: base.sourceIP, displayName: 'Laptop', groupName: 'Home' });
    const first = (await app.inject(url(hours, 0, 2))).json();
    const second = (await app.inject(url(hours, 2, 2))).json();
    expect(first.hasMore).toBe(true); expect(second.hasMore).toBe(false);
    const rows = [...first.rows, ...second.rows];
    expect(rows).toHaveLength(3);
    expect(rows.find(r => r.domain && r.sourceIP === base.sourceIP)).toMatchObject({ totalUpload: 20, totalDownload: 60, rule: 'Group', chain: 'Node > Group', displayName: 'Laptop', groupName: 'Home' });
    expect(rows.find(r => r.sourceIP === '192.168.1.3')).toMatchObject({ totalUpload: 7, rule: 'Other group', chain: 'Second > Other group' });
    expect(rows.find(r => !r.domain)).toMatchObject({ rule: 'IPCIDR(203.0.113.0/24)', ip: '203.0.113.2', chain: 'DIRECT' });
  });

  it('validates ranges and pagination', async () => {
    for (const request of [url().replace('limit=1000', 'limit=1001'), url().replace('offset=0', 'offset=-1'), url().replace('start=2026', 'start=bad2026'), '/api/stats/devices/traffic-details']) {
      expect((await app.inject(request)).statusCode).toBe(400);
    }
    expect((await app.inject(url().replace(`backendId=${backendId}`, 'backendId=999999'))).statusCode).toBe(404);
  });

  it('isolates unknown-source traffic and removes raw rules when clearing a backend', async () => {
    const other = createTestBackend(db, 'Other');
    db.batchUpdateTrafficStats(backendId, [base, { ...base, sourceIP: '' }]);
    db.batchUpdateTrafficStats(other, [base]);
    expect((await app.inject(`${url()}&sourceIP=`)).json().rows).toHaveLength(1);
    expect((await app.inject(`${url()}&sourceIP=`)).json().rows[0].sourceIP).toBe('');
    db.deleteBackendData(backendId);
    expect((await app.inject(url())).json().rows).toEqual([]);
    expect((await app.inject(url().replace(`backendId=${backendId}`, `backendId=${other}`))).json().rows[0]).toMatchObject({ matchedRule: 'Match' });
  });

  it.each([1, 24])('retains distinct matched rules and filters profiles, raw payloads and policy groups for %i hours', async hours => {
    db.batchUpdateTrafficStats(backendId, [
      { ...base, rule: 'RuleSet', rulePayload: 'ai', upload: 4 },
      { ...base, rule: 'RuleSet', rulePayload: 'work', upload: 8 },
      { ...base, sourceIP: '192.168.1.3', upload: 16 },
    ]);
    db.repos.device.saveProfile(backendId, { sourceIP: base.sourceIP, displayName: 'Laptop', groupName: 'Home' });
    const all = (await app.inject(url(hours))).json().rows;
    expect(all).toHaveLength(3);
    expect(all.filter((r: { rule: string }) => r.rule === 'Group')).toHaveLength(3);
    const filtered = (await app.inject(`${url(hours)}&groupName=Home&rule=work&domain=sample&policyGroup=Group`)).json().rows;
    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({ matchedRule: 'RuleSet', rulePayload: 'work', totalUpload: 8 });
    expect((await app.inject(`${url(hours)}&groupName=missing`)).json().rows).toEqual([]);
    expect((await app.inject(`${url(hours)}&ungrouped=true`)).json().rows).toHaveLength(1);
    const sorted = (await app.inject(`${url(hours)}&sortBy=totalUpload&sortOrder=desc`)).json().rows;
    expect(sorted.map((row: { totalUpload: number }) => row.totalUpload)).toEqual([16, 8, 4]);
    expect((await app.inject(`${url(hours)}&rule=%25`)).json().rows).toEqual([]);
  });

  it('uses ClickHouse details and only falls back when allowed', async () => {
    const reader = (app.statsService as any).clickHouseReader;
    vi.spyOn(reader, 'shouldUse').mockReturnValue(true);
    vi.spyOn(reader, 'shouldUseForRange').mockReturnValue(true);
    const query = vi.spyOn(reader, 'getDeviceTrafficDetails').mockResolvedValue([{ sourceIP: base.sourceIP, totalUpload: 12 }]);
    expect((await app.inject(url())).json().rows[0]).toMatchObject({ totalUpload: 12 });
    query.mockResolvedValue(null);
    expect((await app.inject(url())).json().rows).toEqual([]);
    (app.statsService as any).strictStats = true;
    expect((await app.inject(url())).statusCode).toBe(500);
  });
});
