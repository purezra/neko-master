import type { ComparisonRange, TrafficComparisonRow, DeviceDomainComparisonOptions, DeviceDomainComparisonPage } from '@neko-master/shared';
import { BaseRepository } from './base.repository.js';

export class ComparisonRepository extends BaseRepository {
  getDeviceDomains(backendId: number, sourceIP: string, current: ComparisonRange, baseline: ComparisonRange, options: DeviceDomainComparisonOptions): DeviceDomainComparisonPage {
    const periods = [current, baseline].map(range => this.resolveFactTable(range.start, range.end));
    const parts = periods.map((period, index) => `SELECT domain AS key,
      ${index === 0 ? 'SUM(upload + download)' : '0'} AS currentBytes,
      ${index === 1 ? 'SUM(upload + download)' : '0'} AS baselineBytes
      FROM ${period.table} WHERE backend_id = @backendId AND source_ip = @sourceIP
      AND ${period.timeCol} >= @start${index} AND ${period.timeCol} <= @end${index} AND domain != '' GROUP BY domain`);
    const cte = `WITH compared AS (SELECT key, SUM(currentBytes) AS currentBytes, SUM(baselineBytes) AS baselineBytes
      FROM (${parts.join(' UNION ALL ')}) GROUP BY key HAVING SUM(currentBytes) + SUM(baselineBytes) > 0)`;
    const filter = { all: '1=1', increased: 'currentBytes > baselineBytes', decreased: 'currentBytes < baselineBytes', new: 'currentBytes > 0 AND baselineBytes = 0' }[options.filter];
    const predicate = `(${filter}) AND INSTR(LOWER(key), LOWER(@search)) > 0`;
    const params = { backendId, sourceIP, start0: periods[0].startKey, end0: periods[0].endKey,
      start1: periods[1].startKey, end1: periods[1].endKey, search: options.search, limit: options.limit, offset: options.offset };
    const summary = this.db.prepare(`${cte} SELECT COALESCE(SUM(currentBytes), 0) AS currentBytes,
      COALESCE(SUM(baselineBytes), 0) AS baselineBytes, COALESCE(SUM(CASE WHEN ${predicate} THEN 1 ELSE 0 END), 0) AS total FROM compared`).get(params) as Omit<DeviceDomainComparisonPage, 'rows'>;
    const rows = this.db.prepare(`${cte} SELECT key, currentBytes, baselineBytes FROM compared WHERE ${predicate}
      ORDER BY ABS(currentBytes - baselineBytes) DESC, key ASC LIMIT @limit OFFSET @offset`).all(params) as TrafficComparisonRow[];
    return { ...summary, rows };
  }

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
