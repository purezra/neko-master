import type { ComparisonRange, TrafficComparisonRow } from '@neko-master/shared';
import { BaseRepository } from './base.repository.js';

export class ComparisonRepository extends BaseRepository {
  getGrowth(backendId: number, dimension: 'domain' | 'source_ip', current: ComparisonRange, baseline: ComparisonRange): TrafficComparisonRow[] {
    const periods = [current, baseline].map(range => this.resolveFactTable(range.start, range.end));
    const queries = periods.map((period, index) => `
      SELECT ${dimension} AS key,
        ${index === 0 ? 'SUM(upload + download)' : '0'} AS currentBytes,
        ${index === 1 ? 'SUM(upload + download)' : '0'} AS baselineBytes
      FROM ${period.table}
      WHERE backend_id = ? AND ${period.timeCol} >= ? AND ${period.timeCol} <= ? AND ${dimension} != ''
      GROUP BY ${dimension}`);
    // Rank the full union, rather than comparing two truncated Top N lists.
    return this.db.prepare(`SELECT key, SUM(currentBytes) AS currentBytes, SUM(baselineBytes) AS baselineBytes
      FROM (${queries.join(' UNION ALL ')}) GROUP BY key
      HAVING SUM(currentBytes) > SUM(baselineBytes)
      ORDER BY (SUM(currentBytes) - SUM(baselineBytes)) DESC, key ASC LIMIT 10`)
      .all(...periods.flatMap(period => [backendId, period.startKey, period.endKey])) as TrafficComparisonRow[];
  }
}
