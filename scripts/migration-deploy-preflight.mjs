import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const manualRecovery = new Set(["20261013172000_add_workspace_agent_identity"]);
// User-approved convergence revision (2026-11-08): the agent migration file now only ensures its table
// exists (idempotent, no enabling, no tool grant). After its failed ledger row is marked rolled back,
// deploy may re-run exactly this revision; any other text still requires manual recovery.
const approvedConvergence = new Map([
  ["20261013172000_add_workspace_agent_identity", "fa3703cc048fe9f0f7c1285e44e01280725a2a39dd2a39e5411c52edbaca6ec4"],
]);

// This is a refusal gate, not a migration planner or permission to deploy.
// Historical ledger entries are never rewritten here. The original Agent migration text (pinned at
// scripts/fixtures/agent-identity-migration.production-original.sql) combined table creation with an
// unapproved broad tool grant; only the approved non-granting revision may be re-run after rollback.
export function migrationDeployProblems(local, history, historyPresent) {
  const active = history.filter(row => row.finished && !row.rolledBack);
  const known = new Map(local.map(row => [row.name, row.checksum]));
  const completed = new Set(active.map(row => row.name));
  for (const row of local) {
    const rolledBack = history.some(h => h.name === row.name && h.rolledBack) && !history.some(h => h.name === row.name && !h.finished && !h.rolledBack);
    if (rolledBack && approvedConvergence.get(row.name) === row.checksum) completed.add(row.name);
  }
  return [...new Set([
    ...(!historyPresent ? ["migration_history_missing"] : []),
    ...history.filter(row => !row.finished && !row.rolledBack).map(row => `unfinished:${row.name}`),
    ...active.filter(row => !known.has(row.name)).map(row => `unknown_applied:${row.name}`),
    ...active.filter(row => known.has(row.name) && known.get(row.name) !== row.checksum).map(row => `checksum_mismatch:${row.name}`),
    ...local.filter(row => manualRecovery.has(row.name) && !completed.has(row.name)).map(row => `manual_recovery_required:${row.name}`),
  ])];
}

export async function inspectMigrationDeploy(client, local) {
  return client.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
    const [mode] = await tx.$queryRaw`SELECT current_setting('transaction_read_only') AS mode`;
    if (mode?.mode !== "on") throw new Error("read_only_transaction_required");
    const [relation] = await tx.$queryRaw`SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present`;
    const history = relation?.present ? await tx.$queryRaw`
      SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished,
             rolled_back_at IS NOT NULL AS "rolledBack" FROM public."_prisma_migrations"` : [];
    const problems = migrationDeployProblems(local, history, relation?.present === true);
    return { readOnly: true, problems, deployAllowed: problems.length === 0 };
  }, { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 15000 });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("database_connection_unavailable");
  // This repository's accepted production recovery targets public. Refuse
  // alternate schemas rather than validating one ledger then deploying another.
  const schema = new URL(process.env.DATABASE_URL).searchParams.get("schema");
  if (schema && schema !== "public") throw new Error("unsupported_migration_schema");
  const local = readdirSync(join(root, "prisma/migrations"))
    .filter(name => /^\d{14}_[a-z0-9_]+$/.test(name)).sort().map(name => ({
      name, checksum: createHash("sha256").update(readFileSync(join(root, "prisma/migrations", name, "migration.sql"))).digest("hex"),
    }));
  if (!local.length) throw new Error("migration_sources_missing");
  const client = new PrismaClient();
  try {
    const report = await inspectMigrationDeploy(client, local);
    console.log(JSON.stringify(report));
    if (!report.deployAllowed) process.exitCode = 2;
  } finally { await client.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    const safe = ["database_connection_unavailable", "unsupported_migration_schema", "migration_sources_missing", "read_only_transaction_required"];
    console.error(JSON.stringify({ error: safe.includes(error?.message) ? error.message : "migration_preflight_failed" }));
    process.exitCode = 1;
  });
}
