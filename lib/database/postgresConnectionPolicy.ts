/** Pure Prisma 7 driver configuration. Never reads process.env, opens files,
 * resolves DNS or connects. Invalid inputs yield a fixed, value-free error. */
export interface PostgresConnectionOptions {
  host: string; port: number; user: string; database: string; password: () => string;
  ssl: false | { rejectUnauthorized: true }; max: number; connectionTimeoutMillis: number;
  idleTimeoutMillis: number; options: string; application_name: string; client_encoding: string;
  enableChannelBinding: boolean; query_timeout?: number; statement_timeout?: number;
  connectionString?: never;
}
function unavailable(): never { throw new Error("postgres_connection_configuration_unavailable"); }
export function postgresConnectionOptions(target: string): PostgresConnectionOptions {
  if (typeof target !== "string" || !target || target.length > 8192 || target.trim() !== target || /[\u0000-\u0020\u007f]/.test(target)) unavailable();
  let url: URL;
  try { url = new URL(target); } catch { unavailable(); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length <= 1 || url.hash) unavailable();
  const allowed = new Set(["host", "schema", "sslmode", "sslaccept", "channel_binding", "connection_limit", "connect_timeout", "pool_timeout", "socket_timeout", "max_idle_connection_lifetime", "pgbouncer", "application_name"]);
  for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) unavailable();
  if (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") unavailable();
  if (url.searchParams.has("sslaccept") && url.searchParams.get("sslaccept") !== "strict") unavailable();
  const binding = url.searchParams.get("channel_binding");
  // pg offers opportunistic channel binding, not a strict require mode. Refuse
  // unsupported requirements rather than silently degrading their meaning.
  if (binding && !["prefer", "disable"].includes(binding)) unavailable();
  const pgbouncer = url.searchParams.get("pgbouncer");
  if (pgbouncer && !["true", "false"].includes(pgbouncer)) unavailable();
  function positive(name: string, fallback: number, milliseconds = false): number {
    const raw = url.searchParams.get(name); if (raw === null) return fallback;
    if (!/^[1-9][0-9]*$/.test(raw)) unavailable();
    const value = Number(raw) * (milliseconds ? 1000 : 1);
    if (!Number.isSafeInteger(value) || value > 2147483647) unavailable();
    return value;
  }
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) unavailable();
  let host = url.hostname.replace(/^\[|\]$/g, "");
  const socket = url.searchParams.get("host");
  if (socket !== null) {
    if (!["localhost", "127.0.0.1", "::1"].includes(host) || !socket.startsWith("/") || /[\u0000-\u001f\u007f]/.test(socket) || Buffer.byteLength(socket + "/.s.PGSQL." + port) >= 104) unavailable();
    host = socket;
  }
  const local = socket !== null || ["localhost", "127.0.0.1", "::1"].includes(host);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode && !["disable", "require", "verify-full"].includes(sslmode) || !local && sslmode === "disable") unavailable();
  const tls = sslmode === "require" || sslmode === "verify-full" || !local;
  let user: string, password: string, database: string;
  try { user = decodeURIComponent(url.username); password = decodeURIComponent(url.password); database = decodeURIComponent(url.pathname.slice(1)); } catch { unavailable(); }
  if (!user || !database || /[\u0000]/.test(user + password + database)) unavailable();
  const queryTimeout = url.searchParams.has("socket_timeout") ? positive("socket_timeout", 0, true) : undefined;
  const application = url.searchParams.get("application_name") ?? "axiom";
  if (!application || application.length > 64 || /[\u0000-\u001f\u007f]/.test(application)) unavailable();
  return {
    host, port, user, database, password: () => password,
    ssl: tls ? { rejectUnauthorized: true } : false,
    max: positive("connection_limit", 10),
    connectionTimeoutMillis: Math.min(positive("connect_timeout", 5000, true), positive("pool_timeout", 10000, true)),
    idleTimeoutMillis: positive("max_idle_connection_lifetime", 300000, true),
    options: "-c search_path=public", application_name: application, client_encoding: "UTF8",
    enableChannelBinding: tls && binding !== "disable", query_timeout: queryTimeout, statement_timeout: queryTimeout,
  };
}
