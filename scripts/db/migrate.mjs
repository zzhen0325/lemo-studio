#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { readMigrations, renderMigrations, snapshotPath } from './migrations.mjs';

function psql(sql) {
  if (!process.env.PGDATABASE) throw new Error('Set PGDATABASE and connection settings (PGHOST/PGPORT/PGUSER, PGPASSFILE as needed) explicitly');
  const result = spawnSync(process.env.PSQL_BIN || 'psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
    input: sql, encoding: 'utf8', env: process.env, maxBuffer: 10 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Database migration failed');
  return result.stdout.trim();
}

try {
  const command = process.argv[2];
  const migrations = readMigrations();
  const sql = renderMigrations(migrations);
  switch (command) {
    case 'schema':
      writeFileSync(snapshotPath, sql);
      console.log('Updated supabase-schema.sql from versioned migrations');
      break;
    case 'check':
      if (readFileSync(snapshotPath, 'utf8') !== sql) throw new Error('supabase-schema.sql is stale; run pnpm db:schema');
      console.log(`Schema matches ${migrations.length} migrations`);
      break;
    case 'apply':
      psql(sql);
      console.log(`Database is at migration ${migrations.at(-1).version}`);
      break;
    case 'status': {
      const exists = psql("SELECT to_regclass('studio_migrations.versions') IS NOT NULL;") === 't';
      const rows = exists ? JSON.parse(psql("SELECT COALESCE(json_agg(v ORDER BY version), '[]'::json) FROM studio_migrations.versions v;")) : [];
      let invalid = false;
      for (const migration of migrations) {
        const applied = rows.find(row => row.version === migration.version);
        const state = !applied ? 'pending' : applied.checksum === migration.checksum && applied.name === migration.name ? 'applied' : 'MISMATCH';
        if (state === 'MISMATCH') invalid = true;
        console.log(`${migration.name}: ${state}`);
      }
      for (const row of rows) if (!migrations.some(m => m.version === row.version)) {
        invalid = true;
        console.log(`${row.version}: UNKNOWN`);
      }
      if (invalid) process.exitCode = 1;
      break;
    }
    default:
      throw new Error('Usage: node scripts/db/migrate.mjs apply|status|schema|check');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
