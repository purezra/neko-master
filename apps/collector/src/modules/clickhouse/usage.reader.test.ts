import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClickHouseReader } from './clickhouse.reader.js';

describe('ClickHouse usage details', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubEnv('CH_ENABLED', '1'); vi.stubEnv('CH_DATABASE', 'neko_master'); vi.stubEnv('STATS_QUERY_SOURCE', 'clickhouse');
    vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each([2, 12])('matches inclusive SQLite buckets over %i hours and escapes exact domains', async hours => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ sourceIP: '192.168.1.2', chain: 'Node > Group', totalUpload: '10', totalDownload: '90', totalConnections: '1' }] }));
    const start = '2026-10-24T16:15:01Z';
    const end = new Date(Date.parse(start) + hours * 3600000).toISOString();
    const rows = await new ClickHouseReader().getDomainUsage(7, "sample'_%test", start, end);
    expect(rows?.[0]).toMatchObject({ totalUpload: 10, totalDownload: 90, totalConnections: 1 });
    const sql = String(fetchMock.mock.calls[0][1]?.body);
    expect(sql).toContain('backend_id = 7');
    expect(sql).toContain("domain = 'sample''_%test'");
    expect(sql).toContain(hours === 2 ? "minute >= toDateTime('2026-10-24 16:15:00')" : "minute >= toDateTime('2026-10-24 16:00:00')");
    expect(sql).toContain(hours === 2 ? "minute < toDateTime('2026-10-24 18:16:00')" : "minute < toDateTime('2026-10-25 05:00:00')");
    expect(sql).toContain('rank <= 500');
    expect(sql).not.toContain('LIKE');
  });
  it('queries top 3 for each group while retaining a separate full denominator', async () => {
    fetchMock.mockImplementation(async () => Response.json({ data: [{ kind: 'total', key: '', totalUpload: '12', totalDownload: '34', totalConnections: '2' }] }));
    const reader = new ClickHouseReader();
    expect(await reader.getEntityUsage(7, 'proxy', 'Node_%', '2026-10-24T16:00:00Z', '2026-10-25T04:00:00Z', 'connections')).toEqual([{ kind: 'total', key: '', totalUpload: 12, totalDownload: 34, totalConnections: 2 }]);
    let sql = String(fetchMock.mock.calls[0][1]?.body);
    expect(sql).toContain("trimBoth(arrayElement(splitByString(' > ', chain), 1)) = 'Node_%'");
    expect(sql.match(/LIMIT 3/g)).toHaveLength(2);
    expect(sql).toContain('ORDER BY SUM(connections) DESC');
    await reader.getEntityUsage(7, 'country', 'UNKNOWN', '2026-10-24T16:00:00Z', '2026-10-25T04:00:00Z', 'traffic', ['203.0.113.1']);
    sql = String(fetchMock.mock.calls[1][1]?.body);
    expect(sql).toContain("ip NOT IN ('203.0.113.1')");
  });
});
