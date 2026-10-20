import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { getAllSchemaStatements } from './schema.js';
import { migrateMatchedRuleFacts } from './matched-rule-migration.js';

const databases: Database.Database[] = [];
afterEach(() => { databases.forEach(db => db.close()); databases.length = 0; });
function legacyDatabase() {
  const db = new Database(':memory:'); databases.push(db);
  for (const sql of getAllSchemaStatements()) db.exec(sql
    .replace(/ {6}matched_rule TEXT NOT NULL DEFAULT '',\n/g, '')
    .replace(/ {6}rule_payload TEXT NOT NULL DEFAULT '',\n/g, '')
    .replace(/, matched_rule, rule_payload\)/g, ')'));
  db.prepare("INSERT INTO backend_configs (name, url) VALUES ('legacy', 'http://127.0.0.1:9090')").run();
  for (const [table, time] of [['minute_dim_stats', 'minute'], ['hourly_dim_stats', 'hour']]) {
    db.prepare(`INSERT INTO ${table} (backend_id, ${time}, domain, ip, source_ip, chain, rule, upload, download, connections)
      VALUES (1, '2026-10-20T08:00:00', 'sample.test', '203.0.113.1', '192.168.1.2', 'Node > Group', 'Group', 12, 34, 2)`).run();
  }
  return db;
}
describe('matched rule fact migration', () => {
  it('retains old counters as unknown raw rules, restores indexes and can restart safely', () => {
    const db = legacyDatabase();
    migrateMatchedRuleFacts(db); migrateMatchedRuleFacts(db);
    for (const table of ['minute_dim_stats', 'hourly_dim_stats']) {
      expect(db.prepare(`SELECT * FROM ${table}`).get()).toMatchObject({ upload: 12, download: 34, connections: 2, matched_rule: '', rule_payload: '' });
      const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string; pk: number }>;
      expect(columns.find(column => column.name === 'matched_rule')?.pk).toBeGreaterThan(0);
      expect(columns.find(column => column.name === 'rule_payload')?.pk).toBeGreaterThan(0);
      expect((db.prepare(`PRAGMA index_list(${table})`).all()).length).toBeGreaterThan(1);
    }
  });

  it('rolls back both tables when the second rebuild fails', () => {
    const db = legacyDatabase();
    db.exec('CREATE TABLE hourly_dim_stats_matched_rule_migration (unrelated TEXT)');
    expect(() => migrateMatchedRuleFacts(db)).toThrow();
    for (const table of ['minute_dim_stats', 'hourly_dim_stats']) {
      expect(db.prepare(`SELECT upload FROM ${table}`).get()).toEqual({ upload: 12 });
      expect((db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>).some(column => column.name === 'matched_rule')).toBe(false);
    }
  });
});
