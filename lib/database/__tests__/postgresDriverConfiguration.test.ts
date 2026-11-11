import { afterEach, expect, it, vi } from 'vitest';
import { Client } from 'pg';
import { Socket } from 'node:net';
import { postgresConnectionOptions } from '../postgresConnectionPolicy';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it('actual driver preserves explicit identity, empty password and TLS despite ambient PG settings', () => {
  for (const key of ['PGHOST','PGUSER','PGDATABASE','PGPASSWORD','PGOPTIONS','PGSSLMODE']) vi.stubEnv(key, 'ambient-invalid');
  const network = vi.spyOn(Socket.prototype, 'connect').mockImplementation(() => { throw new Error('network_forbidden'); });
  const config = postgresConnectionOptions('postgresql://fixture@db.example/owned_fixture?sslmode=require&connection_limit=3');
  const client = new Client(config);
  const parameters: unknown = Reflect.get(client, 'connectionParameters');
  expect(parameters).toMatchObject({ host: 'db.example', port: 5432, user: 'fixture', database: 'owned_fixture', options: '-c search_path=public', ssl: { rejectUnauthorized: true }, application_name: 'axiom', client_encoding: 'UTF8' });
  const password: unknown = Reflect.get(client, 'password');
  expect(typeof password).toBe('function');
  if (typeof password !== 'function') throw new Error('password_callback_missing');
  expect(password()).toBe('');
  expect(network).not.toHaveBeenCalled();
});
