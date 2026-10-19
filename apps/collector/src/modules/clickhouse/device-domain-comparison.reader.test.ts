import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClickHouseReader } from './clickhouse.reader.js';

describe('ClickHouse device domain comparisons', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubEnv('CH_ENABLED', '1'); vi.stubEnv('CH_DATABASE', 'neko_master'); vi.stubEnv('STATS_QUERY_SOURCE', 'auto');
    vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  const current = { start: '2026-10-19T08:00:00Z', end: '2026-10-19T08:59:59.999Z' };
  const baseline = { start: '2026-10-18T08:00:00Z', end: '2026-10-18T08:59:59.999Z' };
  const options = { offset: 20, limit: 20, search: '%_', filter: 'decreased' as const };
  it('normalizes totals, keeps declined rows and restricts both queries to the device', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ total: '31', currentBytes: '80', baselineBytes: '100' }] }))
      .mockResolvedValueOnce(Response.json({ data: [{ key: 'stopped.test', currentBytes: '0', baselineBytes: '30' }] }));
    expect(await new ClickHouseReader().getDeviceDomainComparison(7, '192.168.1.2', current, baseline, options)).toEqual({ total: 31, currentBytes: 80, baselineBytes: 100, rows: [{ key: 'stopped.test', currentBytes: 0, baselineBytes: 30 }] });
    for (const call of fetchMock.mock.calls) {
      const sql = String(call[1]?.body);
      expect(sql).toContain("source_ip = '192.168.1.2'"); expect(sql).toContain('backend_id = 7');
      expect(sql).toContain('currentBytes < baselineBytes'); expect(sql).toContain("positionCaseInsensitiveUTF8(key, '%_')");
      expect(sql).toContain("minute <= toDateTime('2026-10-19 08:59:59')");
    }
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('abs(toFloat64(currentBytes) - toFloat64(baselineBytes))');
    expect(String(fetchMock.mock.calls[1][1]?.body)).toContain('LIMIT 20 OFFSET 20');
  });
  it('returns null if either half of the page is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ data: [{ total: '0', currentBytes: '0', baselineBytes: '0' }] }))
      .mockResolvedValueOnce(new Response('unavailable', { status: 500 }));
    expect(await new ClickHouseReader().getDeviceDomainComparison(7, '192.168.1.2', current, baseline, options)).toBeNull();
  });
});
