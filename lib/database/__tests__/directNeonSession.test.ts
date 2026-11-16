import { afterEach, expect, it, vi } from "vitest";
import { Client, Pool, type ClientBase } from "pg";
import { EventEmitter } from "node:events";
import { directNeonSessionOptions } from "../directNeonSession";
import { postgresConnectionOptions } from "../postgresConnectionPolicy";

const target = "postgresql://fixture@ep-still-unit-123.us-east-2.aws.neon.tech/owned_fixture?sslmode=require&socket_timeout=9";
const config = () => directNeonSessionOptions(postgresConnectionOptions(target));
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
function startup(client: ClientBase): unknown {
  const method: unknown = Reflect.get(client, "getStartupConf");
  if (typeof method !== "function") throw new Error("startup_method_missing");
  return Reflect.apply(method, client, []);
}
it("actual installed pg removes the startup options key despite poisoned ambient PGOPTIONS, retaining all other fields", () => {
  vi.stubEnv("PGOPTIONS", "-c search_path=attacker");
  vi.stubEnv("PGSSLMODE", "no-verify");
  const original = postgresConnectionOptions(target);
  const adapted = directNeonSessionOptions(original);
  expect(adapted).toMatchObject(original);
  const Constructor = adapted.Client;
  if (!Constructor) throw new Error("custom_client_missing");
  const client = new Constructor();
  // Pool supplies the same config to its Client constructor at runtime.
  const configured = Reflect.construct(Constructor, [adapted]) as ClientBase;
  expect(startup(configured)).toEqual({ user: "fixture", database: "owned_fixture", application_name: "axiom", statement_timeout: "9000" });
  expect(startup(configured)).not.toHaveProperty("options");
  expect(startup(client)).not.toHaveProperty("options");
  expect(Reflect.get(configured, "connectionParameters")).toMatchObject({ host: original.host, ssl: { rejectUnauthorized: true }, options: "-c search_path=public" });
  const upstream = startup(new Client(original)) as Record<string, unknown>;
  const { options: removed, ...rest } = upstream;
  expect(removed).toBe("-c search_path=public");
  expect(startup(configured)).toEqual(rest);
});
it.each(["ep-unit-123-pooler.us-east-2.aws.neon.tech", "ep-unit-123-pooler.c-2.us-east-2.aws.neon.tech", "db.example", "ep-unit-123.us-east-2.aws.neon.tech.attacker.invalid", "ep-unit-123.neon.tech", "localhost"])("preserves exact endpoint and local policy while sanitizing remote startup for %s", host => {
  const original = postgresConnectionOptions(`postgresql://fixture@${host}/owned_fixture`);
  const adapted = directNeonSessionOptions(original);
  expect(adapted).toMatchObject(original);
  expect(adapted.host).toBe(host); expect(adapted.ssl).toEqual(original.ssl);
  if (host === "localhost") { expect(adapted).toBe(original); expect(startup(new Client(original))).toHaveProperty("options", "-c search_path=public"); }
  else { expect(adapted.Client).toBeDefined(); expect(startup(Reflect.construct(adapted.Client!, [adapted]))).not.toHaveProperty("options"); expect(adapted.onConnect).toBeUndefined(); }
});
it("refuses if the undeclared installed startup contract disappears or changes shape", () => {
  const Constructor = config().Client!;
  const original: unknown = Reflect.get(Client.prototype, "getStartupConf");
  try {
    for (const replacement of [undefined, () => null, () => [], () => "bad"]) {
      Reflect.set(Client.prototype, "getStartupConf", replacement);
      expect(() => startup(new Constructor())).toThrow("postgres_session_initialization_unavailable");
    }
  } finally { Reflect.set(Client.prototype, "getStartupConf", original); }
});

// Actual installed pg-pool, with only the physical transport replaced. No socket
// or server is created; this verifies its real asynchronous handoff/cleanup.
function fixturePool(result: unknown, reject = false) {
  let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const events: string[] = [];
  class Transport extends EventEmitter {
    _queryable = true;
    _ending = false;
    connect(callback: (error: null) => void) { queueMicrotask(() => callback(null)); }
    async query(query: unknown) {
      events.push("initialize");
      expect(query).toEqual({ text: "SELECT pg_catalog.set_config('search_path', 'public', false) AS search_path", query_timeout: 5000 });
      await gate;
      if (reject) throw new Error("initialization_failed");
      return result;
    }
    end(callback?: () => void) { events.push("destroy"); callback?.(); }
  }
  const pool = new Pool({ ...config(), Client: Transport as unknown as NonNullable<ReturnType<typeof config>["Client"]> });
  pool.on("acquire", () => events.push("application_handoff"));
  return { pool, finish, events };
}
it("actual pg-pool awaits initialization before acquisition and reuses only the initialized session", async () => {
  const { pool, finish, events } = fixturePool({ rowCount: 1, rows: [{ search_path: "public" }] });
  const pending = pool.connect();
  await new Promise(resolve => setImmediate(resolve));
  expect(events).toEqual(["initialize"]);
  finish();
  const client = await pending;
  expect(events).toEqual(["initialize", "application_handoff"]);
  client.release();
  const reused = await pool.connect();
  expect(events).toEqual(["initialize", "application_handoff", "application_handoff"]);
  reused.release();
  await pool.end();
});
it.each([
  [true, undefined], [false, { rowCount: 0, rows: [] }],
  [false, { rowCount: 1, rows: [{ search_path: "attacker" }] }],
  [false, { rowCount: 1, rows: [{ search_path: "public", extra: "bad" }] }],
  [false, { rowCount: 2, rows: [{ search_path: "public" }, { search_path: "public" }] }],
])("failed or malformed initialization is destroyed before handoff (%s/%j)", async (reject, result) => {
  const { pool, finish, events } = fixturePool(result, reject);
  const pending = pool.connect();
  const refusal = expect(pending).rejects.toThrow();
  await new Promise(resolve => setImmediate(resolve));
  finish();
  await refusal;
  expect(events).toEqual(["initialize", "destroy"]);
  await pool.end();
});
it("initialization deadline never exceeds the configured connect deadline", async () => {
  const options = postgresConnectionOptions(target.replace("socket_timeout=9", "connect_timeout=1"));
  const hook = directNeonSessionOptions(options).onConnect!;
  const query = vi.fn().mockResolvedValue({ rowCount: 1, rows: [{ search_path: "public" }] });
  await hook({ query } as unknown as ClientBase);
  expect(query.mock.calls[0][0].query_timeout).toBe(1000);
});

it.each(["ep-unit-123.c-2.us-east-2.aws.neon.tech", "ep-unit-123.eastus2.azure.neon.tech"])("recognizes direct Neon variant %s without changing endpoint", host => {
  const original = postgresConnectionOptions(`postgresql://fixture@${host}/owned_fixture`);
  const adapted = directNeonSessionOptions(original);
  expect(adapted.Client).toBeDefined();
  expect(adapted.host).toBe(host);
  expect(adapted.ssl).toEqual({ rejectUnauthorized: true });
});
