import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, createTestBackend } from '../../__tests__/helpers.js';
import type { StatsDatabase } from '../../modules/db/db.js';

describe('TimeseriesRepository daily trend buckets', () => {
  let db: StatsDatabase;
  let cleanup: () => void;
  let backendId: number;
  const start = '2026-10-07T00:00:00Z';
  const end = '2026-10-10T00:00:00Z';

  beforeEach(() => {
    ({ db, cleanup } = createTestDatabase());
    backendId = createTestBackend(db);
  });

  afterEach(() => {
    cleanup();
  });

  function writeTraffic(hour: string, upload = 10, download = 20, targetBackendId = backendId): void {
    db.batchUpdateTrafficStats(targetBackendId, [{
      domain: 'example.com',
      ip: '1.2.3.4',
      chain: 'DIRECT',
      chains: ['DIRECT'],
      rule: 'Match',
      rulePayload: '',
      upload,
      download,
      timestampMs: Date.parse(`${hour}Z`),
    }]);
  }

  function queryTrend(bucketMinutes = 1440, tzOffsetMinutes?: number) {
    return db.repos.timeseries.getTrafficTrendAggregated(
      backendId, 4320, bucketMinutes, start, end, tzOffsetMinutes,
    );
  }

  it.each([
    [480, '2026-10-08T16:00:00'],
    [330, '2026-10-08T18:30:00'],
    [-300, '2026-10-08T05:00:00'],
    [-210, '2026-10-08T03:30:00'],
  ])('returns the UTC start of the local day for offset %i', (offset, time) => {
    writeTraffic('2026-10-08T20:00:00');

    expect(queryTrend(1440, offset)).toEqual([{ time, upload: 10, download: 20 }]);
  });

  it('preserves the UTC bucket and serialized output when the offset is omitted or zero', () => {
    writeTraffic('2026-10-08T20:00:00');
    const expected = [{ time: '2026-10-08T00:00:00', upload: 10, download: 20 }];

    expect(queryTrend()).toEqual(expected);
    expect(JSON.stringify(queryTrend(1440, 0))).toBe(JSON.stringify(expected));
  });

  it('splits at local midnight, sums each day, and isolates backends', () => {
    writeTraffic('2026-10-08T15:00:00', 1, 2);
    writeTraffic('2026-10-08T16:00:00', 3, 4);
    writeTraffic('2026-10-08T20:00:00', 5, 6);
    const otherBackendId = createTestBackend(db, 'other-backend');
    writeTraffic('2026-10-08T20:00:00', 100, 200, otherBackendId);

    expect(queryTrend(1440, 480)).toEqual([
      { time: '2026-10-07T16:00:00', upload: 1, download: 2 },
      { time: '2026-10-08T16:00:00', upload: 8, download: 10 },
    ]);
  });

  it('uses daily boundaries for buckets larger than one day', () => {
    writeTraffic('2026-10-08T20:00:00');

    expect(queryTrend(2880, 480)).toEqual([
      { time: '2026-10-08T16:00:00', upload: 10, download: 20 },
    ]);
  });

  it.each([1, 5, 60, 120, 1439])('ignores offsets for %i-minute buckets', (bucketMinutes) => {
    writeTraffic('2026-10-08T20:00:00');
    const withoutOffset = queryTrend(bucketMinutes);

    expect(withoutOffset).toHaveLength(1);
    expect(JSON.stringify(queryTrend(bucketMinutes, 480))).toBe(JSON.stringify(withoutOffset));
    expect(JSON.stringify(queryTrend(bucketMinutes, -210))).toBe(JSON.stringify(withoutOffset));
  });

  // The ClickHouse daily-trend reader buckets minute rows with
  // intDiv(unix(minute) - start, 86400). Hour-aligned bounds must make the
  // hourly SQLite path produce the identical buckets and totals.
  it('keeps domain daily buckets aligned with a minute-grain scan', () => {
    const rangeStart = '2026-10-07T00:00:00Z';
    const rangeEnd = '2026-10-10T00:00:00Z';
    writeTraffic('2026-10-06T23:59:00', 1000, 1000); // before the window
    writeTraffic('2026-10-07T00:00:00', 1, 2);       // first included minute
    writeTraffic('2026-10-09T23:59:00', 3, 4);       // last included minute
    writeTraffic('2026-10-10T00:00:00', 2000, 2000); // exactly at the exclusive end

    const hourly = db.repos.timeseries.getEntityDailyTotals(backendId, 'domain', 'example.com', rangeStart, rangeEnd);
    // Same bucket formula and bounds as clickhouse.reader.getEntityDailyTotals.
    const minuteGrain = (db as unknown as { db: import('better-sqlite3').Database }).db.prepare(`SELECT CAST((strftime('%s', minute) - ?) / 86400 AS INTEGER) AS bucket,
      SUM(upload) AS upload, SUM(download) AS download FROM minute_dim_stats
      WHERE backend_id = ? AND minute >= ? AND minute < ? AND domain = ? GROUP BY bucket ORDER BY bucket`)
      .all(Date.parse(rangeStart) / 1000, backendId, rangeStart.slice(0, 16), rangeEnd.slice(0, 16), 'example.com');

    expect(hourly).toEqual(minuteGrain);
    expect(hourly.reduce((sum, point) => sum + point.upload, 0)).toBe(4);
    expect(hourly.reduce((sum, point) => sum + point.download, 0)).toBe(6);
  });
});
