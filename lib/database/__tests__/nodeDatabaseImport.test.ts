import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

it('ordinary Node tooling loads the real source factory without a TS loader or ambient datasource', () => {
  const entry = pathToFileURL(resolve('lib/database/createDatabaseClient.ts')).href;
  const script = `
    import assert from 'node:assert/strict';
    import { Socket } from 'node:net';
    let attempts = 0;
    Socket.prototype.connect = function() { attempts++; throw Error('network_forbidden'); };
    const { createDatabaseClient } = await import(${JSON.stringify(entry)});
    const client = createDatabaseClient(undefined);
    try {
      await assert.rejects(client.$queryRawUnsafe('SELECT 1'), /database_configuration_unavailable/);
      assert.equal(attempts, 0);
    } finally { await client.$disconnect(); }
    console.log('node_database_import_pass');
  `;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: process.cwd(), env: { NODE_ENV: 'test', PGHOST: 'ambient.invalid', PGDATABASE: 'ambient_invalid' },
    encoding: 'utf8', timeout: 10_000, maxBuffer: 65_536,
  });
  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  expect(result.status).toBe(0);
  expect(result.stdout.trim()).toBe('node_database_import_pass');
});
