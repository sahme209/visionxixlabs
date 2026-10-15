import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { databaseHostingMetadata } from "./auth-recovery-database-metadata.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** No mutations: inspect the database selected by the operator's DATABASE_URL.
 * Never call authOptions/currentContext: both may bootstrap memberships.
 * Does not output email addresses, password hashes, tokens, or connection URLs.
 */
export async function inspectAuthRecovery(client, options = {}) {
  const email = options.founderEmail?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("founder_email_required");
  }
  const localMigrations = readdirSync(join(root, "prisma/migrations"))
    .filter((name) => /^\d+_/.test(name)).sort().map((name) => ({
      name,
      checksum: createHash("sha256").update(readFileSync(join(root, "prisma/migrations", name, "migration.sql"))).digest("hex"),
    }));
  const workspaceId = `ws_${createHash("sha256").update(email).digest("hex").slice(0, 16)}`;
  return client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SET TRANSACTION READ ONLY");
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '5s'");
    await tx.$executeRawUnsafe("SET LOCAL search_path TO public");
    const [mode] = await tx.$queryRaw`SELECT current_setting('transaction_read_only') AS mode`;
    if (mode.mode !== "on") throw new Error("read_only_transaction_required");
    const relations = await tx.$queryRaw`
      SELECT tablename AS name FROM pg_catalog.pg_tables
      WHERE schemaname = 'public' AND tablename IN ('_prisma_migrations', 'User', 'OrgMembership', 'EmailVerificationToken', 'TenantBillingPlan', 'AddOnPurchase', 'Organization', 'WorkspaceAgentIdentity')`;
    const tables = new Set(relations.map((row) => row.name));
    const history = tables.has("_prisma_migrations") ? await tx.$queryRaw`
      SELECT migration_name AS name, checksum, finished_at IS NOT NULL AS finished,
             rolled_back_at IS NOT NULL AS rolled_back FROM "_prisma_migrations"` : [];
    const applied = history.filter((row) => row.finished && !row.rolled_back);
    const appliedNames = new Set(applied.map((row) => row.name));
    const knownNames = new Set(localMigrations.map((row) => row.name));
    const pending = localMigrations.filter((row) => !appliedNames.has(row.name)).map((row) => row.name);
    const migrationProblems = [
      ...(!tables.has("_prisma_migrations") ? ["migration_history_missing"] : []),
      ...history.filter((row) => !row.finished && !row.rolled_back).map((row) => `unfinished:${row.name}`),
      ...applied.filter((row) => !knownNames.has(row.name)).map((row) => `unknown_applied:${row.name}`),
      ...localMigrations.filter((local) => applied.some((row) => row.name === local.name && row.checksum !== local.checksum)).map((row) => `checksum_mismatch:${row.name}`),
    ];
    if (pending.includes("20261013172000_add_workspace_agent_identity") && !tables.has("Organization")) {
      migrationProblems.push("missing_relation:20261013172000_add_workspace_agent_identity:Organization");
    }
    const columns = await tx.$queryRaw`
      SELECT column_name AS name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'User'`;
    const verificationColumnPresent = columns.some((row) => row.name === "emailVerifiedAt");
    // Explicit projection works even before emailVerifiedAt is added. Never
    // fetch the whole User row through Prisma's generated model on old schemas.
    const users = tables.has("User") ? await tx.$queryRaw`
      SELECT "id", "email" = ${email} AS normalized,
             "passwordHash" IS NOT NULL AS password_present,
             (to_jsonb(u)->>'emailVerifiedAt') IS NOT NULL AS email_verified
      FROM "User" u WHERE lower(btrim("email")) = ${email} LIMIT 3` : [];
    const founder = users.length === 1 ? users[0] : null;
    const memberships = founder && tables.has("OrgMembership") ? await tx.$queryRaw`
      SELECT "organizationId", "role"::text AS role, "acceptedAt" IS NOT NULL AS accepted
      FROM "OrgMembership" WHERE "userId" = ${founder.id} ORDER BY "organizationId"` : [];
    const personalMembership = memberships.find((row) => row.organizationId === workspaceId);
    const billing = tables.has("TenantBillingPlan") ? await tx.$queryRaw`
      SELECT "tier", "status" FROM "TenantBillingPlan" WHERE "organizationId" = ${workspaceId}` : [];
    // Later migrations add financial uniqueness constraints. Check duplicates
    // before anyone approves migrate deploy, which applies ALL pending files.
    const billingDuplicateGroups = tables.has("AddOnPurchase") ? await tx.$queryRaw`
      SELECT 'checkout_session' AS kind, count(*)::int AS groups FROM (
        SELECT "stripeCheckoutSessionId" FROM "AddOnPurchase"
        WHERE "stripeCheckoutSessionId" IS NOT NULL GROUP BY "stripeCheckoutSessionId" HAVING count(*) > 1
      ) checkout_duplicates
      UNION ALL
      SELECT 'payment_intent' AS kind, count(*)::int AS groups FROM (
        SELECT "stripePaymentIntentId" FROM "AddOnPurchase"
        WHERE "stripePaymentIntentId" IS NOT NULL GROUP BY "stripePaymentIntentId" HAVING count(*) > 1
      ) payment_duplicates` : null;
    const adminConfigAvailable = typeof options.adminEmails === "string";
    return {
      readOnly: true,
      database: databaseHostingMetadata(options.databaseUrl),
      migrations: { pending, problems: migrationProblems },
      schema: { verificationColumnPresent, verificationTokenTablePresent: tables.has("EmailVerificationToken") },
      founder: {
        match: users.length === 0 ? "missing" : users.length > 1 ? "ambiguous" : "unique",
        canonicalUserId: founder?.id ?? null,
        normalizedEmail: founder?.normalized ?? null,
        passwordPresent: founder?.password_present ?? null,
        emailVerified: founder?.email_verified ?? null,
        derivedPersonalWorkspaceId: workspaceId,
        memberships,
        personalMembership: personalMembership ?? null,
        platformAdmin: adminConfigAvailable
          ? options.adminEmails.split(",").some((item) => item.trim().toLowerCase() === email)
          : "configuration_unavailable",
      },
      billing: { personalWorkspacePlan: billing[0] ?? null, duplicateGroups: billingDuplicateGroups },
      // This report is evidence for a human review, never authorization to
      // migrate, backfill verification, grant roles, or enable billing.
      productionApproval: "not_requested",
    };
  }, { isolationLevel: "RepeatableRead", maxWait: 5000, timeout: 30000 });
}

// Public repositories must not publish private account IDs, roles, or plans
// in Actions logs. The detailed report remains available only in secure runtimes.
export function publicRecoverySummary(report) {
  return {
    readOnly: report.readOnly,
    database: report.database,
    migrations: report.migrations,
    schema: report.schema,
    accountCheck: report.founder.match === "unique" && report.founder.normalizedEmail &&
      report.founder.personalMembership?.accepted ? "passed" : "needs_private_review",
    platformAdminCheck: report.founder.platformAdmin === "configuration_unavailable"
      ? "configuration_unavailable" : "inspected_privately",
    billingDuplicates: report.billing.duplicateGroups === null ? "not_inspected"
      : report.billing.duplicateGroups.some((row) => row.groups > 0) ? "found" : "none_found",
    productionApproval: "not_requested",
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("database_connection_unavailable");
  const client = new PrismaClient();
  try {
    const report = await inspectAuthRecovery(client, {
      founderEmail: process.env.AUTH_PREFLIGHT_FOUNDER_EMAIL,
      databaseUrl: process.env.DATABASE_URL,
      adminEmails: process.env.ADMIN_EMAILS,
    });
    console.log(JSON.stringify(process.argv.includes("--public-summary") ? publicRecoverySummary(report) : report, null, 2));
    if (report.migrations.pending.length || report.migrations.problems.length ||
        !report.schema.verificationColumnPresent || !report.schema.verificationTokenTablePresent ||
        report.founder.match !== "unique" || !report.founder.normalizedEmail ||
        !report.founder.personalMembership?.accepted ||
        report.billing.duplicateGroups?.some((row) => row.groups > 0)) process.exitCode = 2;
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    // Database exceptions can embed SQL/connection details. Print only known
    // local diagnostics or Prisma's non-secret machine-readable error code.
    const allowed = ["founder_email_required", "database_connection_unavailable", "read_only_transaction_required"];
    console.error(JSON.stringify({ error: allowed.includes(error.message) ? error.message : "preflight_failed", code: /^P\d{4}$/.test(error.code ?? "") ? error.code : undefined }));
    process.exitCode = 1;
  });
}
