// Actual application factory + generated Prisma client; test CA supplied only
// before Node startup. No module, driver, pool, TLS or auth transport mocks.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const root = process.argv[2];
const owned = process.argv[3];
const port = process.argv[4];
const requireRoot = createRequire(path.join(root, 'package.json'));
const ts = requireRoot('typescript');
require.extensions['.ts'] = (module, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  });
  module._compile(out.outputText, filename);
};
const { createDatabaseClient } = requireRoot('./lib/database/createDatabaseClient.ts');
const password = fs.readFileSync(path.join(owned, 'password'), 'utf8').trim();
const prefix = `postgresql://axiom_local_fixture:${encodeURIComponent(password)}@127.0.0.1:${port}/postgres`;
const target = name => `${prefix}?sslmode=verify-full&channel_binding=require&connection_limit=1&connect_timeout=5&pool_timeout=5&socket_timeout=5&application_name=${name}`;
const read = `SELECT current_user::text AS owner, current_database()::text AS database,
  pg_backend_pid() AS pid, current_setting('data_directory')::text AS directory,
  current_setting('search_path')::text AS search_path,
  (SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()) AS tls`;
const live = new Set();
function client(name) { const db = createDatabaseClient(target(name)); live.add(db); return db; }
async function dispose(db) { await db.$disconnect(); live.delete(db); }
async function main() {
  assert.equal(process.env.NODE_EXTRA_CA_CERTS, path.join(owned, 'ca.crt'));
  assert.equal(process.env.DATABASE_URL, undefined);
  const a = client('axiom_pg17_owned_a');
  const first = (await a.$queryRawUnsafe(read))[0];
  assert.equal(first.owner, 'axiom_local_fixture'); assert.equal(first.database, 'postgres');
  assert.equal(fs.realpathSync(first.directory), fs.realpathSync(path.join(owned, 'data')));
  assert.equal(first.tls, true); assert.equal(first.search_path, 'public');
  const again = (await a.$queryRawUnsafe(read))[0];
  assert.equal(again.pid, first.pid, 'one-connection pool must reuse physical client');
  await a.$transaction(async tx => { const row = (await tx.$queryRawUnsafe(read))[0]; assert.equal(row.pid, first.pid); assert.equal(row.tls, true); });
  await dispose(a);
  const b = client('axiom_pg17_owned_b');
  const old = await b.$queryRawUnsafe("SELECT pid FROM pg_stat_activity WHERE application_name = 'axiom_pg17_owned_a'");
  assert.equal(old.length, 0, 'Prisma disconnect must dispose its owned physical pool');
  const second = (await b.$queryRawUnsafe(read))[0]; assert.equal(second.tls, true); assert.notEqual(second.pid, first.pid);
  await dispose(b);
  const c = client('axiom_pg17_owned_c');
  const previous = await c.$queryRawUnsafe("SELECT pid FROM pg_stat_activity WHERE application_name IN ('axiom_pg17_owned_a','axiom_pg17_owned_b')");
  assert.equal(previous.length, 0);
  await dispose(c);
  const result = { accepted: true, actualPostgres: true, actualPrismaFactory: true,
    actualNegotiatedTls: true, strictRequireAccepted: true, sessionPublicPath: true,
    repeatedAcquireAndTransaction: true, poolDisposalObserved: true, productionAccess: false };
  fs.writeFileSync(path.join(owned, 'CLIENT-RESULT.json'), JSON.stringify(result), { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(result));
}
main().catch(() => { console.error('owned_pg17_prisma_integration_failed'); process.exitCode = 1; })
  .finally(async () => { for (const db of live) { try { await db.$disconnect(); } catch { process.exitCode = 1; } } });
