import { Client, Pool, type PoolClient, type PoolConfig } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import type { IsolationLevel, SqlDriverAdapter, SqlQuery, Transaction } from "@prisma/driver-adapter-utils";
import pgVersion from "pg/package.json" with { type: "json" };
// Static imports are traced by Next. No runtime filesystem/source-hash reads.
import poolVersion from "../../node_modules/pg-pool/package.json" with { type: "json" };
import adapterVersion from "../../node_modules/@prisma/adapter-pg/package.json" with { type: "json" };

const failure = () => new Error("postgres_public_scope_unavailable");
const SET_PUBLIC = "SET LOCAL search_path TO public";
const SHOW_PUBLIC = "SHOW search_path";
const query = (sql: string): SqlQuery => ({ sql, args: [], argTypes: [] });
type Lease = { client: PoolClient; dirty: boolean; poisoned: boolean; released: boolean; terminal: "COMMIT" | "ROLLBACK" | null; release?: (error?: Error | boolean) => void };
type Guard = { query: (...args: unknown[]) => unknown };
function own(object: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(object, key);
  return descriptor && "value" in descriptor ? descriptor.value : undefined;
}
function text(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const sql = value && typeof value === "object" ? own(value, "text") : undefined;
  return typeof sql === "string" ? sql : undefined;
}
function control(sql: string | undefined): string | null {
  if (["BEGIN", "COMMIT", "ROLLBACK", SET_PUBLIC, SHOW_PUBLIC].includes(sql ?? "")) return sql!;
  return /^SET TRANSACTION ISOLATION LEVEL (ReadUncommitted|ReadCommitted|RepeatableRead|Serializable|READ UNCOMMITTED|READ COMMITTED|REPEATABLE READ|SERIALIZABLE)$/.test(sql ?? "") ? sql! : null;
}

/** The owned pool's lease boundary. pg-pool emits acquire BEFORE overwriting
 * release; the first query synchronously captures the newly installed release. */
function guardLeases(pool: Pool, deadline: number) {
  const leases = new WeakMap<PoolClient, Lease>();
  const guards = new WeakMap<PoolClient, Guard>();
  const active = new Set<Lease>();
  let incompatible = false;
  function release(lease: Lease, error?: Error | boolean) {
    if (lease.released) return;
    lease.released = true;
    active.delete(lease);
    if (!lease.release) {
      const descriptor = Object.getOwnPropertyDescriptor(lease.client, "release");
      if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "function" || !descriptor.writable || !descriptor.configurable) throw failure();
      lease.release = error => Reflect.apply(descriptor.value, lease.client, [error]);
    }
    lease.release(error || lease.dirty || lease.poisoned ? failure() : undefined);
  }
  // A pending checkout can time out before connect completes: pg-pool then
  // releases without issuing any query, so the lazy release guard never runs.
  const retire = (client: PoolClient) => {
    const lease = leases.get(client);
    if (lease) { lease.released = true; active.delete(lease); }
  };
  pool.on("release", (_error, client) => retire(client));
  pool.on("remove", retire);
  pool.on("acquire", client => {
    const lease: Lease = { client, dirty: true, poisoned: false, released: false, terminal: null };
    leases.set(client, lease);
    active.add(lease);
    if (guards.has(client)) return;
    const original = client.query;
    const guarded = function (this: PoolClient, ...args: unknown[]): unknown {
      const current = leases.get(this);
      if (!current || current.released || this !== client) return Promise.reject(failure());
      if (!current.release) {
        const descriptor = Object.getOwnPropertyDescriptor(this, "release");
        if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "function" || !descriptor.writable || !descriptor.configurable) return Promise.reject(failure());
        const originalRelease: (...args: unknown[]) => unknown = descriptor.value;
        current.release = error => Reflect.apply(originalRelease, this, [error]);
        Object.defineProperty(this, "release", { configurable: true, writable: true, value: (error?: Error | boolean) => release(current, error) });
      }
      if (incompatible || current.terminal || current.poisoned) return Promise.reject(failure());
      const sql = control(text(args[0]));
      if (!sql) return Reflect.apply(original, this, args);
      const callback = typeof args.at(-1) === "function" ? args.at(-1) as (error: unknown, result?: unknown) => void : undefined;
      const parameters = callback ? args.slice(0, -1) : [...args];
      const first = parameters[0];
      parameters[0] = typeof first === "string" ? { text: first, query_timeout: deadline } : { ...(first as object), query_timeout: deadline };
      const run = (done: (error: unknown, result?: unknown) => void) => {
        let finished = false;
        const finish = (error: unknown, result?: unknown) => {
          if (finished) return;
          finished = true;
          clearTimeout(timer);
          if (leases.get(this) !== current || current.released) { done(error ?? failure()); return; }
          const expected = sql === SHOW_PUBLIC ? "SHOW" : sql === SET_PUBLIC || sql.startsWith("SET TRANSACTION") ? "SET" : sql;
          if (!error && (!result || typeof result !== "object" || own(result, "command") !== expected)) error = failure();
          if (error) {
            current.poisoned = true;
            try { release(current, failure()); } catch { /* Original error wins. */ }
            done(error); return;
          }
          if (sql === "COMMIT" || sql === "ROLLBACK") { current.terminal = sql; current.dirty = false; }
          done(null, result);
        };
        const timer = setTimeout(() => finish(failure()), deadline);
        try { Reflect.apply(original, this, [...parameters, finish]); }
        catch (error) { finish(error); }
      };
      if (callback) { run(callback); return undefined; }
      return new Promise((resolve, reject) => run((error, result) => error ? reject(error) : resolve(result)));
    };
    guards.set(client, { query: guarded });
    Object.defineProperty(client, "query", { configurable: true, writable: true, value: guarded });
  });
  return {
    assertActive(lease: Lease) {
      if (incompatible || leases.get(lease.client) !== lease || lease.released) throw failure();
    },
    assertCompatible() { if (incompatible) throw failure(); },
    incompatible() {
      incompatible = true;
      for (const lease of active) { try { release(lease, failure()); } catch {} }
    },
    transaction(tx: Transaction): Lease {
      // Version-bound PrismaPg PgQueryable protected data field. Never invoke
      // a getter or expose a physical client through the application adapter.
      const client = own(tx, "client");
      if (!(client instanceof Client)) throw failure();
      const lease = leases.get(client as PoolClient);
      if (!lease || !lease.release || lease.released || client.query !== guards.get(client as PoolClient)?.query) throw failure();
      const options = own(tx, "options");
      if (!options || typeof options !== "object" || own(options, "usePhantomQuery") !== false) throw failure();
      return lease;
    },
    discard(lease: Lease) { lease.poisoned = true; release(lease, failure()); },
  };
}

/** Remote alternate path only. Construction occurs inside factory.connect;
 * PrismaPg disposes this one explicitly owned external pool. */
export async function connectRemotePublicScope(config: PoolConfig): Promise<SqlDriverAdapter> {
  if (pgVersion.version !== "8.23.1" || poolVersion.version !== "3.14.0" || adapterVersion.version !== "7.10.1") throw failure();
  const deadline = Math.min(5000, config.connectionTimeoutMillis ?? 5000);
  if (!Number.isSafeInteger(deadline) || deadline <= 0) throw failure();
  const pool = new Pool(config);
  const leases = guardLeases(pool, deadline);
  const driver = new PrismaPg(pool, { schema: "public", disposeExternalPool: true });
  const adapter = await driver.connect();
  if (adapter.underlyingDriver() !== pool) { await pool.end(); throw failure(); }
  async function begin(isolation?: IsolationLevel) {
    leases.assertCompatible();
    const tx = await adapter.startTransaction(isolation);
    let lease: Lease;
    try { lease = leases.transaction(tx); }
    catch (error) { leases.incompatible(); try { await tx.rollback(); } catch {} throw error; }
    try {
      await tx.executeRaw(query(SET_PUBLIC));
      const ack = await tx.queryRaw(query(SHOW_PUBLIC));
      if (ack.columnNames.length !== 1 || ack.columnNames[0] !== "search_path" || ack.columnTypes.length !== 1
        || ack.rows.length !== 1 || ack.rows[0].length !== 1 || ack.rows[0][0] !== "public") throw failure();
      leases.assertActive(lease);
    } catch (error) {
      try { leases.discard(lease); } catch {}
      try { await tx.rollback(); } catch {}
      throw error;
    }
    const wrapped: Transaction = {
      provider: tx.provider, adapterName: tx.adapterName, options: tx.options,
      queryRaw: sql => { leases.assertActive(lease); return tx.queryRaw(sql); },
      executeRaw: sql => { leases.assertActive(lease); return tx.executeRaw(sql); },
      async commit() {
        leases.assertActive(lease);
        if (lease.released || lease.poisoned || lease.terminal !== "COMMIT") {
          try { leases.discard(lease); } catch {}
          try { await tx.rollback(); } catch {}
          throw failure();
        }
        await tx.commit();
      },
      async rollback() { leases.assertActive(lease); await tx.rollback(); },
      createSavepoint: tx.createSavepoint ? name => { leases.assertActive(lease); return tx.createSavepoint!(name); } : undefined,
      rollbackToSavepoint: tx.rollbackToSavepoint ? name => { leases.assertActive(lease); return tx.rollbackToSavepoint!(name); } : undefined,
      releaseSavepoint: tx.releaseSavepoint ? name => { leases.assertActive(lease); return tx.releaseSavepoint!(name); } : undefined,
    };
    return { tx: wrapped, lease };
  }
  async function root<T>(operation: (tx: Transaction) => Promise<T>): Promise<T> {
    const { tx, lease } = await begin();
    try {
      const result = await operation(tx);
      await tx.executeRaw(query("COMMIT"));
      await tx.commit();
      return result;
    } catch (error) {
      if (!lease.released) {
        try { await tx.executeRaw(query("ROLLBACK")); } catch { try { leases.discard(lease); } catch {} }
        try { await tx.rollback(); } catch { try { leases.discard(lease); } catch {} }
      }
      throw error;
    }
  }
  return {
    provider: adapter.provider, adapterName: adapter.adapterName,
    queryRaw: sql => root(tx => tx.queryRaw(sql)), executeRaw: sql => root(tx => tx.executeRaw(sql)),
    startTransaction: async isolation => (await begin(isolation)).tx,
    async executeScript() { throw new Error("postgres_remote_script_unavailable"); },
    getConnectionInfo: adapter.getConnectionInfo.bind(adapter), dispose: adapter.dispose.bind(adapter),
  };
}
