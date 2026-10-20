import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClickHouseReader } from './clickhouse.reader.js';

describe('ClickHouse entity daily totals', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubEnv('CH_ENABLED', '1'); vi.stubEnv('CH_DATABASE', 'neko_master'); vi.stubEnv('STATS_QUERY_SOURCE', 'clickhouse');
    vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each(['domain', 'proxy', 'country'] as const)('filters %s with isolated bounds and normalizes numbers', async dimension => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ bucket: '2', upload: '12', download: '34' }] }));
    const rows = await new ClickHouseReader().getEntityDailyTotals(7, dimension, "Node_%'quoted", '2026-10-11T08:00:00Z', '2026-10-18T08:00:00Z');
    expect(rows).toEqual([{ bucket: 2, upload: 12, download: 34 }]);
    const sql = String(fetchMock.mock.calls[0][1]?.body);
    expect(sql).toContain('backend_id = 7');
    expect(sql).toContain("minute >= toDateTime('2026-10-11 08:00:00')");
    expect(sql).toContain("minute < toDateTime('2026-10-18 08:00:00')");
    expect(sql).toContain(dimension === 'country' ? '.country_buffer' : '.traffic_detail_buffer');
    expect(sql).toContain('GROUP BY bucket ORDER BY bucket');
    if (dimension === 'proxy') expect(sql).toContain("trimBoth(arrayElement(splitByString(' > ', chain), 1))");
    expect(sql).not.toContain('LIKE');
  });

  it.each(['domain', 'proxy', 'country'] as const)('splits %s devices and preserves the overflow group', async dimension => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ bucket: '2', sourceIP: null, upload: '12', download: '34' }, { bucket: '0', sourceIP: '192.168.1.2', upload: '4', download: '6' }] }));
    const rows = await new ClickHouseReader().getEntityDeviceDailyTotals(7, dimension, dimension === 'country' ? 'SG' : "Node_%'quoted", '2026-10-11T08:00:00Z', '2026-10-18T08:00:00Z', ['203.0.113.1']);
    expect(rows?.[0]).toEqual({ bucket: 2, sourceIP: null, upload: 12, download: 34 });
    const sql = String(fetchMock.mock.calls[0][1]?.body);
    expect(sql).toContain('backend_id = 7');
    expect(sql).toContain("minute < toDateTime('2026-10-18 08:00:00')");
    expect(sql).toContain('LIMIT 10');
    expect(sql).toContain('GROUP BY bucket, sourceIP');
    if (dimension === 'country') expect(sql).toContain("ip IN ('203.0.113.1')");
    if (dimension === 'proxy') expect(sql).toContain("Node_%''quoted");
  });

  it('reads paginated joint device facts with deterministic ordering', async () => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ sourceIP: '192.168.1.2', domain: 'sample.test', ip: '203.0.113.1', rule: 'Group', chain: 'Node > Group', totalUpload: '12', totalDownload: '34', totalConnections: '2', lastSeen: '2026-10-11 08:00:00' }] }));
    const rows = await new ClickHouseReader().getDeviceTrafficDetails(7, '2026-10-11T08:00:00Z', '2026-10-18T07:59:59.999Z', 1000, 1001);
    expect(rows?.[0]).toMatchObject({ sourceIP: '192.168.1.2', totalUpload: 12, totalDownload: 34, totalConnections: 2 });
    const sql = String(fetchMock.mock.calls[0][1]?.body);
    expect(sql).toContain('GROUP BY source_ip, domain, ip, rule, chain');
    expect(sql).toContain('ORDER BY sourceIP ASC, sourceIP, domain, ip, rule, chain, matchedRule, rulePayload LIMIT 1001 OFFSET 1000');
    expect(sql).toContain("minute <= toDateTime('2026-10-18 07:59:59')");
  });
});
