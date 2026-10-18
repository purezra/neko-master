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
});
