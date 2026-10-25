/** Facts SQL is supplied only by repositories; user values must stay parameterized/escaped. */
export function usageBreakdownSQL(facts: string, metric: 'traffic' | 'connections'): string {
  const totals = 'COALESCE(SUM(upload), 0) AS totalUpload, COALESCE(SUM(download), 0) AS totalDownload, COALESCE(SUM(connections), 0) AS totalConnections';
  const order = metric === 'connections' ? 'SUM(connections)' : 'SUM(upload) + SUM(download)';
  return `WITH facts AS (${facts}),
    devices AS (SELECT source_ip AS key, ${totals} FROM facts GROUP BY source_ip ORDER BY ${order} DESC, source_ip LIMIT 3),
    domains AS (SELECT domain AS key, ${totals} FROM facts GROUP BY domain ORDER BY ${order} DESC, domain LIMIT 3)
    SELECT 'total' AS kind, '' AS key, ${totals} FROM facts
    UNION ALL SELECT 'device' AS kind, key, totalUpload, totalDownload, totalConnections FROM devices
    UNION ALL SELECT 'domain' AS kind, key, totalUpload, totalDownload, totalConnections FROM domains`;
}
