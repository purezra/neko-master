import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClickHouseReader } from './clickhouse.reader.js';

describe('ClickHouse comparison growth', () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => {
    vi.stubEnv('CH_ENABLED', '1'); vi.stubEnv('CH_DATABASE', 'neko_master'); vi.stubEnv('STATS_QUERY_SOURCE', 'clickhouse');
    vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
  it.each(['domain', 'source_ip'] as const)('compares the complete %s population with backend and time bounds', async dimension => {
    fetchMock.mockResolvedValue(Response.json({ data: [{ key: 'sample', currentBytes: '50', baselineBytes: '10' }] }));
    const rows = await new ClickHouseReader().getComparisonGrowth(7, dimension,
      { start: '2026-10-18T08:00:00Z', end: '2026-10-18T08:59:59.999Z' },
      { start: '2026-10-17T08:00:00Z', end: '2026-10-17T08:59:59.999Z' });
    expect(rows).toEqual([{ key: 'sample', currentBytes: 50, baselineBytes: 10 }]);
    const sql = String(fetchMock.mock.calls[0][1]?.body);
    expect(sql).toContain('backend_id = 7');
    expect(sql).toContain(`GROUP BY ${dimension}`);
    expect(sql).toContain("minute <= toDateTime('2026-10-18 08:59:59')");
    expect(sql).toContain("minute <= toDateTime('2026-10-17 08:59:59')");
    expect(sql).toContain('ORDER BY (currentBytes - baselineBytes) DESC, key ASC LIMIT 10');
  });
});
