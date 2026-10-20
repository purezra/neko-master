import type Database from 'better-sqlite3';
import { INDEXES, SCHEMA } from './schema.js';

/** Rebuild the composite keys atomically so two raw rules never share counters. */
export function migrateMatchedRuleFacts(db: Database.Database): void {
  db.transaction(() => {
    for (const [table, time, ddl] of [
      ['minute_dim_stats', 'minute', SCHEMA.MINUTE_DIM_STATS],
      ['hourly_dim_stats', 'hour', SCHEMA.HOURLY_DIM_STATS],
    ] as const) {
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
      if (columns.some(column => column.name === 'matched_rule')) continue;
      const replacement = `${table}_matched_rule_migration`;
      db.exec(ddl.replace(table, replacement));
      const legacyColumns = `backend_id, ${time}, domain, ip, source_ip, chain, rule, upload, download, connections`;
      db.exec(`INSERT INTO ${replacement} (${legacyColumns}) SELECT ${legacyColumns} FROM ${table}`);
      db.exec(`DROP TABLE ${table}`);
      db.exec(`ALTER TABLE ${replacement} RENAME TO ${table}`);
      for (const index of INDEXES) {
        if (index.includes(` ON ${table}(`)) db.exec(index);
      }
    }
  })();
}
