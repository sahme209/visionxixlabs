import "server-only";

// Exact endpoint previously resolved through the provider API for Axiom main.
// This module never returns the endpoint, database name, URL or credentials.
const HOST = "ep-small-mountain-ailw0kvt.c-4.us-east-1.aws.neon.tech";
const POOLED_HOST = "ep-small-mountain-ailw0kvt-pooler.c-4.us-east-1.aws.neon.tech";
const DATABASE = "neondb";
const QUERY_KEYS = new Set(["sslmode", "channel_binding", "pgbouncer", "connection_limit", "pool_timeout", "connect_timeout", "statement_cache_size", "schema"]);
type Environment = Record<string, string | undefined>;
export function configuredAgentRecoveryTarget(env: Environment): boolean {
  if (env.VERCEL_ENV !== "production" || env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME !== undefined && env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME !== "false") return false;
  const value = env.DATABASE_URL;
  if (!value || value.length > 16_384) return false;
  try {
    const url = new URL(value);
    if (!["postgres:", "postgresql:"].includes(url.protocol) || ![HOST, POOLED_HOST].includes(url.hostname.toLowerCase())
      || url.port && url.port !== "5432" || url.hash || decodeURIComponent(url.pathname) !== `/${DATABASE}`) return false;
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length || keys.some(key => !QUERY_KEYS.has(key))) return false;
    if (!["require", "verify-full"].includes(url.searchParams.get("sslmode") ?? "")) return false;
    if (url.searchParams.has("schema") && url.searchParams.get("schema") !== "public") return false;
    return true;
  } catch { return false; }
}
interface ProbeTransaction {
  $executeRawUnsafe(query: string): Promise<unknown>;
  $queryRawUnsafe<T>(query: string): Promise<T>;
}
export interface AgentRecoveryRepository {
  $transaction<T>(operation: (tx: ProbeTransaction) => Promise<T>, options: {maxWait: number; timeout: number}): Promise<T>;
}
interface Metadata {
  database_name: unknown;
  read_only: unknown;
  server_version_num: unknown;
  identity_table_present: unknown;
  baseline_user_present: unknown;
  unfinished_attempts: unknown;
  matching_unfinished: unknown;
  finished_attempts: unknown;
}
const METADATA_QUERY = `SELECT current_database() AS database_name,
  current_setting('transaction_read_only') AS read_only,
  current_setting('server_version_num')::int AS server_version_num,
  to_regclass('public."WorkspaceAgentIdentity"') IS NOT NULL AS identity_table_present,
  to_regclass('public."User"') IS NOT NULL AS baseline_user_present,
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS unfinished_attempts,
  count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL AND checksum='761c693202763e71c7ee25f99e194fe010335cf902b5ed37124351a93d42e3f7')::int AS matching_unfinished,
  count(*) FILTER (WHERE finished_at IS NOT NULL)::int AS finished_attempts
  FROM public."_prisma_migrations" WHERE migration_name='20261013172000_add_workspace_agent_identity'`;
const empty = (state: "target_unverified" | "metadata_unverified" | "unavailable", configuredTargetMatch: boolean) => ({
  state, configuredTargetMatch, observedDatabaseMatch: false, engineMajorMatch: false,
  agentIdentityTablePresent: null as boolean | null, schemaOnlyPreconditionsMatch: false,
  repairAuthorized: false as const, recoveryPointVerified: false as const, isolatedRestoreVerified: false as const,
});
/** Metadata only. No customer rows, provider I/O, DDL, identity enablement,
 * migration resolution or repair authority. Auth is enforced by the caller.
 * The fixed target comes from server configuration, never request values. */
export async function inspectAgentStorageRecovery(repo: AgentRecoveryRepository, env: Environment) {
  if (!configuredAgentRecoveryTarget(env)) return empty("target_unverified", false);
  try {
    const rows = await repo.$transaction(async tx => {
      await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
      await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '2s'");
      await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
      return tx.$queryRawUnsafe<Metadata[]>(METADATA_QUERY);
    }, {maxWait: 1000, timeout: 5000});
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    if (!row || row.database_name !== DATABASE || row.read_only !== "on"
      || !Number.isSafeInteger(row.server_version_num) || Math.floor((row.server_version_num as number) / 10_000) !== 17
      || typeof row.identity_table_present !== "boolean" || typeof row.baseline_user_present !== "boolean"
      || ![row.unfinished_attempts, row.matching_unfinished, row.finished_attempts].every(value => Number.isSafeInteger(value) && (value as number) >= 0)) return empty("metadata_unverified", true);
    return {
      state: "verified" as const, configuredTargetMatch: true, observedDatabaseMatch: true, engineMajorMatch: true,
      agentIdentityTablePresent: row.identity_table_present,
      schemaOnlyPreconditionsMatch: row.baseline_user_present && !row.identity_table_present && row.unfinished_attempts === 1 && row.matching_unfinished === 1 && row.finished_attempts === 0,
      repairAuthorized: false as const, recoveryPointVerified: false as const, isolatedRestoreVerified: false as const,
    };
  } catch { return empty("unavailable", true); }
}
