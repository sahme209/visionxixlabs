/** Pure Prisma 7 driver configuration. Never reads process.env, opens files,
 * resolves DNS or connects. Invalid inputs yield a fixed, value-free error. */
export interface PostgresConnectionOptions {
  host: string; port: number; user: string; database: string; password: () => string;
  ssl: false | { rejectUnauthorized: true }; max: number; connectionTimeoutMillis: number;
  idleTimeoutMillis: number; options: string; application_name: string; client_encoding: string;
  enableChannelBinding: boolean; query_timeout?: number; statement_timeout?: number;
  connectionString?: never;
}
// Opaque, input-free server diagnostic codes. Never attach parser exceptions or
// target fragments. The public error message and every acceptance rule stay fixed.
type ConfigurationRefusal =
  | "PCP_001" | "PCP_002" | "PCP_003" | "PCP_004" | "PCP_005" | "PCP_006"
  | "PCP_007" | "PCP_008" | "PCP_009" | "PCP_010" | "PCP_011" | "PCP_012"
  | "PCP_013" | "PCP_014"
  | "PCP_020" | "PCP_021" | "PCP_022" | "PCP_023" | "PCP_024" | "PCP_025"
  | "PCP_026" | "PCP_027" | "PCP_028" | "PCP_029";
function unavailable(cause: ConfigurationRefusal): never {
  throw new Error("postgres_connection_configuration_unavailable", { cause });
}
export function postgresConnectionOptions(target: string): PostgresConnectionOptions {
  if (typeof target !== "string" || !target || target.length > 8192 || target.trim() !== target || /[\u0000-\u0020\u007f]/.test(target)) unavailable("PCP_001");
  let url: URL;
  try { url = new URL(target); } catch { unavailable("PCP_002"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || !url.username || url.pathname.length <= 1 || url.hash) unavailable("PCP_003");
  const allowed = new Set(["host", "schema", "sslmode", "sslaccept", "channel_binding", "connection_limit", "connect_timeout", "pool_timeout", "socket_timeout", "max_idle_connection_lifetime", "pgbouncer", "application_name"]);
  for (const key of url.searchParams.keys()) if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) unavailable("PCP_004");
  if (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") unavailable("PCP_005");
  if (url.searchParams.has("sslaccept") && url.searchParams.get("sslaccept") !== "strict") unavailable("PCP_006");
  const binding = url.searchParams.get("channel_binding");
  // pg offers opportunistic channel binding, not a strict require mode. Refuse
  // unsupported requirements rather than silently degrading their meaning.
  if (binding && !["prefer", "disable"].includes(binding)) unavailable("PCP_007");
  const pgbouncer = url.searchParams.get("pgbouncer");
  if (pgbouncer && !["true", "false"].includes(pgbouncer)) unavailable("PCP_008");
  function positive(name: string, fallback: number, diagnostic: readonly [ConfigurationRefusal, ConfigurationRefusal], milliseconds = false): number {
    const raw = url.searchParams.get(name); if (raw === null) return fallback;
    if (!/^[1-9][0-9]*$/.test(raw)) unavailable(diagnostic[0]);
    const value = Number(raw) * (milliseconds ? 1000 : 1);
    if (!Number.isSafeInteger(value) || value > 2147483647) unavailable(diagnostic[1]);
    return value;
  }
  const port = url.port ? Number(url.port) : 5432;
  if (!Number.isInteger(port) || port < 1 || port > 65535) unavailable("PCP_009");
  let host = url.hostname.replace(/^\[|\]$/g, "");
  const socket = url.searchParams.get("host");
  if (socket !== null) {
    if (!["localhost", "127.0.0.1", "::1"].includes(host) || !socket.startsWith("/") || /[\u0000-\u001f\u007f]/.test(socket) || Buffer.byteLength(socket + "/.s.PGSQL." + port) >= 104) unavailable("PCP_010");
    host = socket;
  }
  const local = socket !== null || ["localhost", "127.0.0.1", "::1"].includes(host);
  const sslmode = url.searchParams.get("sslmode");
  if (sslmode && !["disable", "require", "verify-full"].includes(sslmode) || !local && sslmode === "disable") unavailable("PCP_011");
  const tls = sslmode === "require" || sslmode === "verify-full" || !local;
  let user: string, password: string, database: string;
  try { user = decodeURIComponent(url.username); password = decodeURIComponent(url.password); database = decodeURIComponent(url.pathname.slice(1)); } catch { unavailable("PCP_012"); }
  if (!user || !database || /[\u0000]/.test(user + password + database)) unavailable("PCP_013");
  const queryTimeout = url.searchParams.has("socket_timeout") ? positive("socket_timeout", 0, ["PCP_026", "PCP_027"], true) : undefined;
  const application = url.searchParams.get("application_name") ?? "axiom";
  if (!application || application.length > 64 || /[\u0000-\u001f\u007f]/.test(application)) unavailable("PCP_014");
  return {
    host, port, user, database, password: () => password,
    ssl: tls ? { rejectUnauthorized: true } : false,
    max: positive("connection_limit", 10, ["PCP_020", "PCP_021"]),
    connectionTimeoutMillis: Math.min(positive("connect_timeout", 5000, ["PCP_022", "PCP_023"], true), positive("pool_timeout", 10000, ["PCP_024", "PCP_025"], true)),
    idleTimeoutMillis: positive("max_idle_connection_lifetime", 300000, ["PCP_028", "PCP_029"], true),
    options: "-c search_path=public", application_name: application, client_encoding: "UTF8",
    enableChannelBinding: tls && binding !== "disable", query_timeout: queryTimeout, statement_timeout: queryTimeout,
  };
}
