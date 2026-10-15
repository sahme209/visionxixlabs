import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { inspectAuthRecovery, publicRecoverySummary } from "./auth-recovery-preflight.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const agentMigration = "20261013172000_add_workspace_agent_identity";
const authMigration = "20261014120000_add_email_verification";

/** This rehearsal must never select a production or shared database. */
export function validateRehearsalTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("isolated_rehearsal_target_required"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.pathname !== "/axiom_auth_recovery_rehearsal" || url.search || url.hash) {
    throw new Error("isolated_rehearsal_target_required");
  }
  return url.toString();
}

export async function rehearseAuthRecovery(connectionString) {
  const target = validateRehearsalTarget(connectionString);
  const client = new PrismaClient({ datasources: { db: { url: target } } });
  const temp = mkdtempSync(join(tmpdir(), "axiom-auth-rehearsal-"));
  const schema = join(temp, "prisma/schema.prisma");
  const fixtureEmail = "fixture-founder@example.test";
  const workspace = `ws_${createHash("sha256").update(fixtureEmail).digest("hex").slice(0, 16)}`;
  const artifact = readFileSync(join(root, "ops/recovery/20261015_auth_schema_only.sql"), "utf8");
  function cli(args, expectedSuccess = true) {
    const result = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), ...args, "--schema", schema], {
      env: { ...process.env, DATABASE_URL: target, PRISMA_HIDE_UPDATE_MESSAGE: "true" },
      encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024,
    });
    const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    assert.equal(result.status === 0, expectedSuccess, "unexpected isolated Prisma command outcome");
    return output;
  }
  async function snapshot(sql) { return JSON.stringify(await client.$queryRawUnsafe(sql)); }
  async function executeArtifact(text, success = true) {
    const path = join(temp, "recovery.sql");
    writeFileSync(path, text);
    return cli(["db", "execute", "--file", path], success);
  }
  try {
    const [initial] = await client.$queryRawUnsafe("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname = 'public'");
    assert.equal(initial.count, 0, "rehearsal requires a new empty disposable database; refusing to reset it");
    mkdirSync(join(temp, "prisma"));
    cpSync(join(root, "prisma/schema.prisma"), schema);
    cpSync(join(root, "prisma/migrations"), join(temp, "prisma/migrations"), { recursive: true });
    const failure = cli(["migrate", "deploy"], false);
    assert.match(failure, /P3018/);
    assert.match(failure, /Organization/);
    const [baseline] = await client.$queryRawUnsafe(`SELECT count(*) FILTER (WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL)::int AS finished,
      count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL)::int AS failed FROM "_prisma_migrations"`);
    assert.equal(baseline.finished, 99);
    assert.equal(baseline.failed, 1);
    const failedSnapshotSql = `SELECT to_jsonb(m) AS row FROM "_prisma_migrations" m WHERE migration_name = '${agentMigration}' ORDER BY id`;
    const failedBefore = await snapshot(failedSnapshotSql);
    const ledgerSql = 'SELECT to_jsonb(m) AS row FROM "_prisma_migrations" m ORDER BY migration_name, id';
    const ledgerBefore = await snapshot(ledgerSql);
    const [partial] = await client.$queryRawUnsafe(`SELECT to_regclass('public."WorkspaceAgentIdentity"') IS NOT NULL AS present`);
    await client.$executeRawUnsafe(`INSERT INTO "User" ("id", "email", "name", "passwordHash", "updatedAt") VALUES ('fixture-user', $1, 'Existing name', 'fixture-only-hash', now())`, fixtureEmail);
    await client.$executeRawUnsafe(`INSERT INTO "OrgMembership" ("id", "userId", "organizationId", "role", "acceptedAt", "updatedAt") VALUES ('fixture-membership', 'fixture-user', $1, 'read_only', now(), now())`, workspace);
    const userSql = `SELECT to_jsonb(u) AS row FROM "User" u WHERE id = 'fixture-user'`;
    const membershipSql = 'SELECT to_jsonb(m) AS row FROM "OrgMembership" m ORDER BY id';
    const userBefore = await snapshot(userSql);
    const membershipBefore = await snapshot(membershipSql);
    const before = publicRecoverySummary(await inspectAuthRecovery(client, { founderEmail: fixtureEmail, databaseUrl: target }));
    assert.equal(before.database.endpointClassification, "local_or_proxy_underlying_host_unverified");
    assert.equal(before.database.backupStatus, "unverified");
    assert.equal(before.migrations.pending.length, 7);
    assert.equal(before.accountCheck, "passed");
    assert.equal(before.schema.verificationColumnPresent, false);
    // Verify whole-transaction rollback after DDL, before committing anything.
    await executeArtifact(artifact.replace(/COMMIT;\s*$/, "DO $$ BEGIN RAISE EXCEPTION 'fixture_abort'; END $$;\nCOMMIT;"), false);
    assert.equal((await client.$queryRawUnsafe(`SELECT to_regclass('public."EmailVerificationToken"') IS NULL AS absent`))[0].absent, true);
    assert.equal(await snapshot(userSql), userBefore);
    assert.equal(await snapshot(ledgerSql), ledgerBefore);
    await executeArtifact(artifact);
    assert.equal(await snapshot(ledgerSql), ledgerBefore, "schema-only SQL must not edit migration history");
    assert.equal(await snapshot(`SELECT to_jsonb(u) - 'emailVerifiedAt' AS row FROM "User" u WHERE id = 'fixture-user'`), userBefore);
    assert.equal(await snapshot(membershipSql), membershipBefore);
    assert.equal((await client.user.findUnique({ where: { id: "fixture-user" } })).emailVerifiedAt, null);
    await executeArtifact(artifact, false); // No silent rerun on partial/existing schema.
    const authChecksum = createHash("sha256").update(readFileSync(join(root, "prisma/migrations", authMigration, "migration.sql"))).digest("hex");
    cli(["migrate", "resolve", "--applied", authMigration]);
    const [authRow] = await client.$queryRawUnsafe(`SELECT checksum, finished_at IS NOT NULL AS finished FROM "_prisma_migrations" WHERE migration_name = $1`, authMigration);
    assert.equal(authRow.checksum, authChecksum);
    assert.equal(authRow.finished, true);
    assert.equal(await snapshot(failedSnapshotSql), failedBefore, "failed history must remain untouched");
    const after = publicRecoverySummary(await inspectAuthRecovery(client, { founderEmail: fixtureEmail, databaseUrl: target }));
    assert.equal(after.migrations.pending.length, 6);
    assert.equal(after.accountCheck, "passed");
    assert.equal(after.schema.verificationColumnPresent, true);
    assert.equal(after.schema.verificationTokenTablePresent, true);
    assert.ok(after.migrations.problems.includes(`unfinished:${agentMigration}`));
    const stillBlocked = cli(["migrate", "deploy"], false);
    assert.match(stillBlocked, /P3009/);
    assert.equal(await snapshot(failedSnapshotSql), failedBefore);
    return {
      target: "isolated_loopback_empty_database", baselineApplied: baseline.finished,
      originalFailure: "P3018_missing_Organization", partialAgentTablePresent: partial.present,
      authDdlTransactionRollback: "passed", existingIdentityAndMembership: "preserved",
      existingPasswordsAutomaticallyVerified: false, exactAuthChecksumRecorded: true,
      originalFailedHistory: "unchanged", pendingAfterAuthOnly: after.migrations.pending,
      blanketDeployStillBlocked: "P3009", production: "untouched",
    };
  } finally {
    await client.$disconnect();
    rmSync(temp, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rehearseAuthRecovery(process.env.AUTH_RECOVERY_TEST_DATABASE_URL).then(report => console.log(JSON.stringify(report, null, 2))).catch(() => {
    console.error("Isolated auth recovery rehearsal failed. No production target is accepted by this script.");
    process.exitCode = 1;
  });
}
