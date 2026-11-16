import { expect, it, vi } from "vitest";
import { Client, type ClientBase } from "pg";
import { newDatabaseRuntimeTrace, databaseRuntimeSnapshot, databaseRuntimeErrorClassification } from "../databaseRuntimeTrace";
import { directNeonSessionOptions } from "../directNeonSession";
import { postgresConnectionOptions } from "../postgresConnectionPolicy";
import { createDatabaseClient } from "../createDatabaseClient";

const direct = "postgresql://TRACE_USER:TRACE_PASSWORD@ep-trace-host.us-east-2.aws.neon.tech/TRACE_DATABASE?sslmode=require";
it("distinguishes unknown global reuse and factory unconfigured/direct/pooled routes without target values", async () => {
  expect(databaseRuntimeSnapshot({}).databaseClientRoute).toBe("unknown-client");
  for (const [target, route] of [[undefined, "unconfigured"], [direct, "direct-neon"], [direct.replace('ep-trace-host.', 'ep-trace-host-pooler.'), "pooled-or-other"]] as const) {
    const client = createDatabaseClient(target);
    try {
      const snapshot = databaseRuntimeSnapshot(client);
      expect(snapshot.databaseClientRoute).toBe(route);
      expect(snapshot.tlsVerificationConfigured).toBe(target === undefined ? null : true);
      expect(snapshot.channelBindingRequired).toBe(target === undefined ? null : false);
      expect(databaseRuntimeSnapshot(client)).toEqual(snapshot);
      const output = JSON.stringify(snapshot);
      for (const secret of [direct, "TRACE_USER", "TRACE_PASSWORD", "ep-trace-host", "TRACE_DATABASE"]) expect(output).not.toContain(secret);
      expect(Object.values(snapshot).every(value => value === null || typeof value === "boolean" || typeof value === "string" || typeof value === "number")).toBe(true);
    } finally { await client.$disconnect(); }
  }
});
it("observes actual installed pg startup removal, retaining exact upstream fields", () => {
  const trace = newDatabaseRuntimeTrace(), key = {}; trace.register(key);
  const original = postgresConnectionOptions(direct);
  const config = directNeonSessionOptions(original, trace.observe), Constructor = config.Client!;
  const client = Reflect.construct(Constructor, [config]);
  const actual = Reflect.apply(Reflect.get(client, "getStartupConf"), client, []);
  const upstream = Reflect.apply(Reflect.get(Client.prototype, "getStartupConf"), new Client(original), []) as Record<string, unknown>;
  const { options, ...remaining } = upstream;
  expect(options).toBe("-c search_path=public"); expect(actual).toEqual(remaining);
  expect(databaseRuntimeSnapshot(key)).toMatchObject({ databaseClientRoute: "direct-neon", databaseStartupConfigurationCalls: 1, databaseStartupOptionsRemoved: 1, databaseSessionInitStarted: 0, databaseSessionInitAcknowledged: 0 });
});
it("records asynchronous session ACK only after the existing exact acknowledgment validation", async () => {
  const trace = newDatabaseRuntimeTrace(), key = {}; trace.register(key);
  const hook = directNeonSessionOptions(postgresConnectionOptions(direct), trace.observe).onConnect!;
  let resolve!: (value: unknown) => void;
  const query = vi.fn(() => new Promise(r => { resolve = r; }));
  const pending = hook({ query } as unknown as ClientBase);
  expect(databaseRuntimeSnapshot(key)).toMatchObject({ databaseSessionInitStarted: 1, databaseSessionInitAcknowledged: 0 });
  resolve({ rowCount: 1, rows: [{ search_path: "public" }] }); await pending;
  expect(databaseRuntimeSnapshot(key).databaseSessionInitAcknowledged).toBe(1);
  for (const result of [{ rowCount: 0, rows: [] }, { rowCount: 1, rows: [{ search_path: 'public', extra: true }] }]) {
    await expect(hook({ query: vi.fn().mockResolvedValue(result) } as unknown as ClientBase)).rejects.toThrow('postgres_session_initialization_unavailable');
  }
  await expect(hook({ query: vi.fn().mockRejectedValue(new Error('preserved')) } as unknown as ClientBase)).rejects.toThrow('preserved');
  expect(databaseRuntimeSnapshot(key)).toMatchObject({ databaseSessionInitStarted: 4, databaseSessionInitAcknowledged: 1 });
});
it("caps event counts and ignores unknown runtime events without retaining their values", () => {
  const trace = newDatabaseRuntimeTrace(), key = {}; trace.register(key);
  for (let i = 0; i < 1100; i++) trace.observe("startup-configuration");
  trace.observe('TRACE_PASSWORD' as Parameters<typeof trace.observe>[0]);
  expect(databaseRuntimeSnapshot(key).databaseStartupConfigurationCalls).toBe(1000);
  expect(JSON.stringify(databaseRuntimeSnapshot(key))).not.toContain('TRACE_PASSWORD');
});
it("throwing diagnostic observers cannot affect direct startup or successful/failed initialization", async () => {
  const observer = () => { throw new Error('diagnostic_failure'); };
  const config = directNeonSessionOptions(postgresConnectionOptions(direct), observer);
  const client = Reflect.construct(config.Client!, [config]);
  expect(() => Reflect.apply(Reflect.get(client, 'getStartupConf'), client, [])).not.toThrow();
  await expect(config.onConnect!({ query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ search_path: 'public' }] }) } as unknown as ClientBase)).resolves.toBeUndefined();
  await expect(config.onConnect!({ query: vi.fn().mockRejectedValue(new Error('original_error')) } as unknown as ClientBase)).rejects.toThrow('original_error');
});

it("reports configured transport policy only, including strict require and local TLS-disabled", async () => {
  for (const [target, tls, binding] of [[direct + '&channel_binding=require', true, true], ['postgresql://fixture@localhost/fixture', false, false]] as const) {
    const client = createDatabaseClient(target);
    try { expect(databaseRuntimeSnapshot(client)).toMatchObject({ tlsVerificationConfigured: tls, channelBindingRequired: binding }); }
    finally { await client.$disconnect(); }
  }
});
it("identifies an actual unregistered global cached client without inventing its route", async () => {
  const cached = {};
  vi.stubGlobal('prisma', cached); vi.stubEnv('NODE_ENV', 'production');
  try {
    const { prisma } = await import('../../db');
    expect(prisma).toBe(cached);
    expect(databaseRuntimeSnapshot(prisma)).toMatchObject({ databaseClientRoute: 'unknown-client', tlsVerificationConfigured: null, channelBindingRequired: null, databaseStartupConfigurationCalls: 0 });
  } finally { vi.unstubAllGlobals(); vi.unstubAllEnvs(); }
});

it("classifies only known own data without getters, arbitrary codes, cycles or toJSON", () => {
  const marker = 'postgresql://PRIVATE_USER:PRIVATE_PASSWORD@PRIVATE_HOST/private';
  const getter = vi.fn(() => marker), toJSON = vi.fn(() => marker);
  const error: Record<string, unknown> = { code: marker, message: marker, stack: marker, toJSON };
  error.cause = error; Object.defineProperty(error, 'meta', { get: getter });
  expect(databaseRuntimeErrorClassification(error)).toBe('unknown');
  expect(databaseRuntimeErrorClassification(new Proxy({}, { getOwnPropertyDescriptor() { throw new Error(marker); } }))).toBe('unknown');
  expect(databaseRuntimeErrorClassification({ cause: { meta: { driverAdapterError: { code: '08P01' } } } })).toBe('postgres_protocol_08P01');
  expect(databaseRuntimeErrorClassification({ code: 'P2039' })).toBe('prisma_P2039');
  expect(databaseRuntimeErrorClassification({ code: 'ECONNREFUSED' })).toBe('connection_refused');
  expect(databaseRuntimeErrorClassification(new Error('postgres_channel_binding_required_unavailable'))).toBe('channel_binding_required_unavailable');
  expect(databaseRuntimeErrorClassification(new Error('postgres_session_initialization_unavailable'))).toBe('session_initialization_unavailable');
  expect(databaseRuntimeErrorClassification({ message: 'x'.repeat(4096) + 'unsupported startup parameter in options: search_path' })).toBe('unknown');
  expect(getter).not.toHaveBeenCalled(); expect(toJSON).not.toHaveBeenCalled();
});
