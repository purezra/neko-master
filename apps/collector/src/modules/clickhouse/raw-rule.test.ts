import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClickHouseWriter } from './clickhouse.writer.js';
import { ClickHouseReader } from './clickhouse.reader.js';
import { ensureClickHouseSchema, loadClickHouseConfig } from './clickhouse.config.js';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('ClickHouse raw matched rule parity', () => {
  it('upgrades the destination and buffer and retains raw fields while preserving the policy-group rule', async () => {
    vi.stubEnv('CH_ENABLED', '1'); vi.stubEnv('CH_WRITE_ENABLED', '1');
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () => new Response(''));
    vi.stubGlobal('fetch', fetchMock);
    await ensureClickHouseSchema(loadClickHouseConfig());
    const queries = fetchMock.mock.calls.map(call => new URL(String(call[0])).searchParams.get('query'));
    expect(queries.some(query => query?.includes('ALTER TABLE neko_master.traffic_detail\n'))).toBe(true);
    expect(queries.some(query => query?.includes('ALTER TABLE neko_master.traffic_detail_buffer\n'))).toBe(true);
    await new ClickHouseWriter().writeTrafficBatch(7, [{ domain: 'sample.test', ip: '203.0.113.1', sourceIP: '192.168.1.2',
      chains: ['Node', 'Group'], chain: 'Node > Group', rule: 'RuleSet', rulePayload: 'ai', upload: 12, download: 34, timestampMs: Date.parse('2026-10-20T08:00:00Z') }]);
    const call = fetchMock.mock.calls.find(call => String(call[0]).includes('traffic_detail_buffer') && String(call[1]?.body).includes('matched_rule'));
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ rule: 'Group', matched_rule: 'RuleSet', rule_payload: 'ai', upload: 12, download: 34 });
  });

  it('escapes raw-rule filters literally, restricts selected devices and sorts using a whitelist', async () => {
    vi.stubEnv('CH_ENABLED', '1');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ data: [] })); vi.stubGlobal('fetch', fetchMock);
    await new ClickHouseReader().getDeviceTrafficDetails(7, '2026-10-19T08:00:00Z', '2026-10-20T07:59:59Z', 0, 26,
      { rule: "ai%'quoted", policyGroup: 'Group', includeIPs: ['192.168.1.2'], sortBy: 'totalUpload', sortOrder: 'desc' });
    const sql = String(fetchMock.mock.calls[0][1]?.body);
    expect(sql).toContain("source_ip IN ('192.168.1.2')");
    expect(sql).toContain("'ai%''quoted'"); expect(sql).not.toContain('LIKE');
    expect(sql).toContain('ORDER BY totalUpload DESC');
    expect(sql).toContain('matched_rule, rule_payload');
  });
});
