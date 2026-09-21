import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { readMigrations, renderMigrations, root } from './migrations.mjs';

if (!['127.0.0.1', 'localhost', '::1'].includes(process.env.PGHOST)) {
  throw new Error('Migration tests require explicit loopback PGHOST; only disposable local databases are used');
}
const binary = process.env.PSQL_BIN || 'psql';
const databases = [];
const migrations = readMigrations();
const sql = renderMigrations(migrations);
function run(database, input, fail = false) {
  const result = spawnSync(binary, ['-X', '-v', 'ON_ERROR_STOP=1', '-At'], {
    env: { ...process.env, PGDATABASE: database }, input, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (fail) { assert.notEqual(result.status, 0, 'Expected migration failure'); return result.stderr; }
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}
function database() {
  const name = `studio_migration_test_${randomBytes(6).toString('hex')}`;
  run('postgres', `CREATE DATABASE ${name};`);
  databases.push(name);
  return name;
}
function concurrent(database, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, ['-X', '-v', 'ON_ERROR_STOP=1', '-At'], { env: { ...process.env, PGDATABASE: database } });
    let stderr = '';
    child.stdout.resume(); child.stderr.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(stderr)));
    child.stdin.end(input);
  });
}
const columns = `SELECT string_agg(table_name || ':' || column_name || ':' || data_type || ':' || is_nullable || ':' || COALESCE(column_default,''), E'\n' ORDER BY table_name, ordinal_position) FROM information_schema.columns WHERE table_schema='public';`;
try {
  const fresh = database();
  run(fresh, sql);
  assert.equal(run(fresh, 'SELECT count(*) FROM studio_migrations.versions;'), '3');
  assert.equal(run(fresh, "SELECT count(*) FROM pg_tables WHERE schemaname='public';"), '13');
  run(fresh, "INSERT INTO generations(id, user_id, config) VALUES ('preserved', 'guest', '{\"prompt\":\"keep\"}');");
  const firstLedger = run(fresh, 'SELECT json_agg(v ORDER BY version) FROM studio_migrations.versions v;');
  run(fresh, sql);
  assert.equal(run(fresh, 'SELECT json_agg(v ORDER BY version) FROM studio_migrations.versions v;'), firstLedger);
  assert.equal(run(fresh, "SELECT config->>'prompt' FROM generations WHERE id='preserved';"), 'keep');
  console.log('PASS empty database and idempotent replay');

  const legacy = database();
  run(legacy, readFileSync(path.join(root, 'tests/db/fixtures/legacy-schema.sql'), 'utf8'));
  run(legacy, "INSERT INTO generations(id,user_id,config) VALUES ('legacy','owner','{\"nested\":{\"preserved\":true}}'); ALTER TABLE tool_presets ALTER COLUMN timestamp TYPE INTEGER;");
  run(legacy, sql);
  assert.equal(run(legacy, columns), run(fresh, columns));
  assert.equal(run(legacy, "SELECT config->'nested'->>'preserved' FROM generations WHERE id='legacy';"), 'true');
  console.log('PASS legacy upgrade, column parity and existing JSON preservation');

  const adopted = database();
  run(adopted, readFileSync(path.join(root, 'tests/db/fixtures/legacy-schema.sql'), 'utf8'));
  run(adopted, migrations[1].sql + migrations[2].sql);
  run(adopted, 'DROP POLICY "Allow anonymous access" ON users; CREATE POLICY custom_users ON users USING(false); ALTER TABLE presets DISABLE ROW LEVEL SECURITY;');
  run(adopted, sql);
  assert.equal(run(adopted, "SELECT qual FROM pg_policies WHERE tablename='users';"), 'false');
  assert.equal(run(adopted, "SELECT relrowsecurity FROM pg_class WHERE oid='presets'::regclass;"), 'f');
  assert.equal(run(adopted, columns), run(fresh, columns));
  console.log('PASS adoption of untracked current schema and preservation of custom policies');

  const partial = database();
  run(partial, 'CREATE TABLE users(id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(), display_name VARCHAR(255), avatar_url TEXT, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now());');
  run(partial, sql);
  assert.equal(run(partial, columns), run(fresh, columns));
  console.log('PASS partial baseline initialization');

  const changed = migrations.map(m => ({ ...m }));
  changed[0].checksum = 'changed';
  assert.match(run(fresh, renderMigrations(changed), true), /differs from this checkout/);
  const invalidSql = 'CREATE TABLE should_rollback(id INTEGER); SELECT 1 / 0;';
  const invalid = { version: '0004', name: '0004_failure.sql', sql: invalidSql, checksum: createHash('sha256').update(invalidSql).digest('hex') };
  run(fresh, renderMigrations([...migrations, invalid]), true);
  assert.equal(run(fresh, "SELECT to_regclass('public.should_rollback') IS NULL;"), 't');
  assert.equal(run(fresh, 'SELECT count(*) FROM studio_migrations.versions;'), '3');
  console.log('PASS checksum rejection and transactional rollback');

  const race = database();
  await Promise.all([concurrent(race, sql), concurrent(race, sql)]);
  assert.equal(run(race, 'SELECT count(*) FROM studio_migrations.versions;'), '3');
  run(race, "DELETE FROM studio_migrations.versions WHERE version='0002';");
  assert.match(run(race, sql, true), /history has a gap/);
  run(race, "INSERT INTO studio_migrations.versions(version,name,checksum) VALUES ('9999','future','future');");
  assert.match(run(race, sql, true), /unknown to this checkout/);
  console.log('PASS concurrent runners, missing and unknown versions');

  const oldCanvas = database();
  run(oldCanvas, 'CREATE TABLE infinite_canvas_projects(id TEXT PRIMARY KEY, name TEXT, data JSONB);');
  assert.match(run(oldCanvas, sql, true), /Legacy Canvas layout/);
  assert.equal(run(oldCanvas, "SELECT to_regclass('studio_migrations.versions') IS NULL;"), 't');
  console.log('PASS explicit refusal of unsupported historical layouts');
} finally {
  for (const name of databases) run('postgres', `DROP DATABASE ${name};`);
  console.log(`Removed ${databases.length} disposable test databases`);
}
