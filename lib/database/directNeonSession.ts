import { Client, type PoolConfig, type QueryConfig } from "pg";
import type { PostgresConnectionOptions } from "./postgresConnectionPolicy.ts";

function unavailable(): never { throw new Error("postgres_session_initialization_unavailable"); }

/** Only a recognized direct Neon endpoint uses session initialization. Pooler
 * endpoints and unknown providers retain the original startup policy. */
function isDirectNeonHost(host: string): boolean {
  const labels = host.split(".");
  return /^ep-[a-z0-9]+(?:-[a-z0-9]+)*\.(?:c-[0-9]+\.)?[a-z0-9-]+\.(?:aws|azure)\.neon\.tech$/.test(host)
    && !labels[0].endsWith("-pooler");
}

class DirectNeonClient extends Client {
  // pg 8 exposes this virtual method at runtime, but @types/pg omits it.
  // Preserve every upstream startup field except unsupported protocol options.
  getStartupConf(): Record<string, unknown> {
    const upstream: unknown = Reflect.get(Client.prototype, "getStartupConf");
    if (typeof upstream !== "function") unavailable();
    const startup: unknown = Reflect.apply(upstream, this, []);
    if (startup === null || typeof startup !== "object" || Array.isArray(startup)
      || Object.getPrototypeOf(startup) !== Object.prototype) unavailable();
    const data: Record<string, unknown> = { ...startup };
    delete data.options;
    return data;
  }
}

/** Prisma receives configuration and owns the pool. The installed pg-pool
 * awaits onConnect before handoff, and destroys a client if this hook fails.
 * Session search_path is appropriate only for the direct connection above;
 * this makes no transaction-pooler session guarantee. */
export function directNeonSessionOptions(options: PostgresConnectionOptions): PoolConfig {
  if (!isDirectNeonHost(options.host)) return options;
  return {
    ...options,
    Client: DirectNeonClient,
    async onConnect(client) {
      // pg reads per-query query_timeout; its declaration only lists the
      // client-level counterpart. Keep the runtime option explicitly typed.
      const initialization: QueryConfig & { query_timeout: number } = {
        text: "SELECT pg_catalog.set_config('search_path', 'public', false) AS search_path",
        query_timeout: Math.min(5000, options.connectionTimeoutMillis),
      };
      const result = await client.query(initialization);
      if (result.rowCount !== 1 || result.rows.length !== 1
        || result.rows[0]?.search_path !== "public"
        || Object.keys(result.rows[0]).length !== 1) unavailable();
    },
  };
}
