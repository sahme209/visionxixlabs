import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
export const enrollmentMigration = "20261016010000_cloud_account_enrollment";
export const revocationMigration = "20261016020000_cloud_account_credential_revocation";
export function validateAwsEnrollmentRehearsalTarget(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("isolated_aws_enrollment_target_required"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.pathname !== "/axiom_aws_enrollment_rehearsal" || url.search || url.hash) throw new Error("isolated_aws_enrollment_target_required");
  return url.toString();
}

/** Deliberately synthetic, initially empty fixture; never accepts production targets. */
export async function rehearseAwsEnrollment(value) {
  const target = validateAwsEnrollmentRehearsalTarget(value);
  const client = new PrismaClient({ datasources: { db: { url: target } } });
  const temp = mkdtempSync(join(tmpdir(), "axiom-aws-enrollment-"));
  const sql = readFileSync(join(root, "prisma/migrations", enrollmentMigration, "migration.sql"), "utf8");
  const revokeSql = readFileSync(join(root, "prisma/migrations", revocationMigration, "migration.sql"), "utf8");
  function apply(text = sql, success = true, expectedError) {
    const path = join(temp, "fixture.sql");
    writeFileSync(path, text);
    const result = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "db", "execute", "--file", path, "--schema", join(root, "prisma/schema.prisma")], {
      env: { ...process.env, DATABASE_URL: target, PRISMA_HIDE_UPDATE_MESSAGE: "true" }, encoding: "utf8", timeout: 60_000, maxBuffer: 1024 * 1024,
    });
    assert.equal(result.status === 0, success, "unexpected isolated enrollment SQL outcome");
    if (expectedError) assert.ok(`${result.stdout ?? ""}\n${result.stderr ?? ""}`.includes(expectedError), "unexpected fixture drift rejection reason");
  }
  async function absent(name) {
    const [row] = await client.$queryRawUnsafe(`SELECT to_regclass($1) IS NULL AS absent`, `public."${name}"`);
    assert.equal(row.absent, true);
  }
  async function typeAbsent(name) {
    const [row] = await client.$queryRawUnsafe(`SELECT to_regtype($1) IS NULL AS absent`, `public."${name}"`);
    assert.equal(row.absent, true);
  }
  const accountTable = sql.match(/CREATE TABLE IF NOT EXISTS public\."CloudAccount" \([\s\S]*?\n\);/)[0].replace("IF NOT EXISTS ", "");
  try {
    const [initial] = await client.$queryRawUnsafe(`SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','v','m','S')`);
    const [types] = await client.$queryRawUnsafe(`SELECT count(*)::int AS count FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'`);
    assert.equal(initial.count, 0, "refusing populated fixture; no reset is implemented");
    assert.equal(types.count, 0, "refusing pre-existing fixture enums");
    apply(revokeSql, false, "cloud_revocation_credentials_table_required");
    // The absent baseline creates every proposed object, then deliberately rolls
    // back. This is not the historical application baseline or a restore drill.
    apply(sql.replace(/COMMIT;\s*$/, "ROLLBACK;"));
    await absent("CloudAccount");
    await typeAbsent("CloudProvider");
    await typeAbsent("AutopilotMode");

    // Every object dropped below was created by this invocation after the empty
    // target guard. No production/history cleanup or general reset is offered.
    await client.$executeRawUnsafe(`CREATE TYPE "CloudProvider" AS ENUM ('aws', 'azure')`);
    apply(sql, false, "cloud_enrollment_incompatible_CloudProvider");
    await typeAbsent("AutopilotMode");
    await absent("CloudAccount");
    await client.$executeRawUnsafe(`DROP TYPE "CloudProvider"`);
    await client.$executeRawUnsafe(`CREATE TYPE "AutopilotMode" AS ENUM ('disabled', 'autonomous')`);
    apply(sql, false, "cloud_enrollment_incompatible_AutopilotMode");
    await typeAbsent("CloudProvider");
    await absent("CloudAccount");
    await client.$executeRawUnsafe(`DROP TYPE "AutopilotMode"`);

    await client.$executeRawUnsafe(`CREATE TYPE "CloudProvider" AS ENUM ('aws', 'azure', 'gcp')`);
    await client.$executeRawUnsafe(`CREATE TYPE "AutopilotMode" AS ENUM ('observe_only', 'recommend', 'assisted_apply', 'full_guarded')`);
    const noPrimary = accountTable.replace(/,\n  CONSTRAINT "CloudAccount_pkey" PRIMARY KEY \("id"\)/, "");
    await client.$executeRawUnsafe(noPrimary);
    apply(sql, false, "cloud_enrollment_incompatible_CloudAccount_primary_key");
    await absent("CloudAccountCredential");
    await client.$executeRawUnsafe(`DROP TABLE "CloudAccount"`);
    await client.$executeRawUnsafe(accountTable);
    await client.$executeRawUnsafe(`CREATE INDEX "CloudAccount_id_organizationId_key" ON "CloudAccount" ("alias")`);
    apply(sql, false, "cloud_enrollment_incompatible_CloudAccount_unique_index");
    await absent("CloudAccountCredential");
    await client.$executeRawUnsafe(`DROP INDEX "CloudAccount_id_organizationId_key"`);
    await client.$executeRawUnsafe(`INSERT INTO "CloudAccount" ("id","organizationId","provider","externalAccountId","alias","updatedAt") VALUES ('fixture-account','fixture-org','aws','123456789012','Preserve me',now())`);
    apply();
    const [account] = await client.$queryRawUnsafe(`SELECT "alias","autopilotMode"::text AS mode,"enabled" FROM "CloudAccount" WHERE id='fixture-account'`);
    assert.deepEqual(account, { alias: "Preserve me", mode: "observe_only", enabled: true });
    await assert.rejects(client.$executeRawUnsafe(`INSERT INTO "CloudAccountCredential" (id,"organizationId","encryptedConfiguration","validatedAt","updatedAt") VALUES ('fixture-account','other-org','synthetic-ciphertext',now(),now())`));
    await assert.rejects(client.$executeRawUnsafe(`INSERT INTO "CloudAccountCredential" (id,"organizationId","encryptedConfiguration",version,"validatedAt","updatedAt") VALUES ('fixture-account','fixture-org','synthetic-ciphertext',0,now(),now())`));
    await client.$executeRawUnsafe(`INSERT INTO "CloudAccountCredential" (id,"organizationId","encryptedConfiguration","validatedAt","updatedAt") VALUES ('fixture-account','fixture-org','synthetic-ciphertext',now(),now())`);
    assert.equal(await client.$executeRawUnsafe(`UPDATE "CloudAccountCredential" SET version=version+1,"updatedAt"=now() WHERE id='fixture-account' AND "organizationId"='fixture-org' AND version=1`), 1);
    assert.equal(await client.$executeRawUnsafe(`UPDATE "CloudAccountCredential" SET version=version+1,"updatedAt"=now() WHERE id='fixture-account' AND "organizationId"='fixture-org' AND version=1`), 0);
    await assert.rejects(client.$executeRawUnsafe(`INSERT INTO "CloudAccountEnrollmentAttempt" (id,"organizationId","userId","expectedAccountId","roleArn",region,"externalIdDigest","expiresAt","cloudAccountId","updatedAt") VALUES ('wrong-scope','other-org','fixture-user','123456789012','fixture-role','us-east-1',repeat('a',64),now()+interval '5 minutes','fixture-account',now())`));
    await assert.rejects(client.$executeRawUnsafe(`INSERT INTO "CloudAccountEnrollmentAttempt" (id,"organizationId","userId","expectedAccountId","roleArn",region,"externalIdDigest","expiresAt","updatedAt") VALUES ('bad-digest','fixture-org','fixture-user','123456789012','fixture-role','us-east-1','plaintext-external-id',now()+interval '5 minutes',now())`));
    await client.$executeRawUnsafe(`INSERT INTO "CloudAccountEnrollmentAttempt" (id,"organizationId","userId","expectedAccountId","roleArn",region,"externalIdDigest","expiresAt","cloudAccountId","expectedCredentialVersion","expectedAccountUpdatedAt","updatedAt") SELECT 'fixture-attempt','fixture-org','fixture-user','123456789012','fixture-role','us-east-1',repeat('a',64),now()+interval '5 minutes',id,2,"updatedAt",now() FROM "CloudAccount" WHERE id='fixture-account'`);
    const consume = `UPDATE "CloudAccountEnrollmentAttempt" SET "consumedAt"=now(),"updatedAt"=now() WHERE id='fixture-attempt' AND "organizationId"='fixture-org' AND "userId"='fixture-user' AND "externalIdDigest"=repeat('a',64) AND "consumedAt" IS NULL AND "expiresAt">now()`;
    assert.equal(await client.$executeRawUnsafe(consume), 1);
    assert.equal(await client.$executeRawUnsafe(consume), 0);
    // Real SSI predicate test: distinct account keys cannot rely on the
    // existing per-account unique index to arbitrate this last-slot race.
    const racers = [new PrismaClient({ datasources: { db: { url: target } } }), new PrismaClient({ datasources: { db: { url: target } } })];
    let arrivals = 0;
    let releaseBarrier;
    let rejectBarrier;
    const barrier = new Promise((resolve, reject) => { releaseBarrier = resolve; rejectBarrier = reject; });
    const barrierTimeout = setTimeout(() => rejectBarrier(new Error("fixture_serializable_barrier_timeout")), 10_000);
    let lastSlotFailureCode;
    try {
      const outcomes = await Promise.allSettled(racers.map((racer, index) => racer.$transaction(async tx => {
        const [count] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "CloudAccount" WHERE "organizationId"=$1`, "fixture-last-slot-org");
        assert.equal(count.count, 0, "both independent serializable snapshots must observe the one available slot");
        arrivals += 1;
        if (arrivals === 2) releaseBarrier();
        await barrier;
        await tx.$executeRawUnsafe(`INSERT INTO "CloudAccount" (id,"organizationId",provider,"externalAccountId","updatedAt") VALUES ($1,$2,'aws',$3,now())`, `fixture-last-slot-${index}`, "fixture-last-slot-org", `23456789012${index}`);
      }, { isolationLevel: "Serializable", maxWait: 15_000, timeout: 20_000 })));
      assert.equal(outcomes.filter(result => result.status === "fulfilled").length, 1, "exactly one distinct account may commit into the last slot");
      const failures = outcomes.filter(result => result.status === "rejected");
      assert.equal(failures.length, 1);
      const error = failures[0].reason;
      assert.ok(error?.code === "P2034" || error?.meta?.code === "40001", "the losing transaction must fail with a serialization conflict");
      lastSlotFailureCode = error.meta?.code ?? error.code;
      const [finalCount] = await client.$queryRawUnsafe(`SELECT count(*)::int AS count FROM "CloudAccount" WHERE "organizationId"=$1`, "fixture-last-slot-org");
      assert.equal(finalCount.count, 1);
    } finally {
      clearTimeout(barrierTimeout);
      await Promise.all(racers.map(racer => racer.$disconnect()));
    }
    apply(sql, false, "cloud_enrollment_partial_or_already_present");
    const [remaining] = await client.$queryRawUnsafe(`SELECT version FROM "CloudAccountCredential" WHERE id='fixture-account'`);
    assert.equal(remaining.version, 2);
    apply(revokeSql.replace(/COMMIT;\s*$/, "ROLLBACK;"));
    const column = async () => (await client.$queryRawUnsafe(`SELECT data_type, is_nullable, datetime_precision FROM information_schema.columns WHERE table_schema='public' AND table_name='CloudAccountCredential' AND column_name='revokedAt'`));
    assert.equal((await column()).length, 0, "revocation DDL rollback must not retain the column");
    await client.$executeRawUnsafe(`ALTER TABLE "CloudAccountCredential" ADD COLUMN "revokedAt" TEXT`);
    apply(revokeSql, false, "cloud_revocation_column_already_present");
    await client.$executeRawUnsafe(`ALTER TABLE "CloudAccountCredential" DROP COLUMN "revokedAt"`);
    await client.$executeRawUnsafe(`ALTER TABLE "CloudAccountCredential" ALTER COLUMN version TYPE BIGINT`);
    apply(revokeSql, false, "cloud_revocation_incompatible_credentials_shape");
    assert.equal((await column()).length, 0);
    await client.$executeRawUnsafe(`ALTER TABLE "CloudAccountCredential" ALTER COLUMN version TYPE INTEGER`);
    apply(revokeSql);
    assert.deepEqual(await column(), [{ data_type: "timestamp without time zone", is_nullable: "YES", datetime_precision: 3 }]);
    const credential = async () => (await client.$queryRawUnsafe(`SELECT version,"encryptedConfiguration","revokedAt" FROM "CloudAccountCredential" WHERE id='fixture-account'`))[0];
    assert.deepEqual(await credential(), { version: 2, encryptedConfiguration: "synthetic-ciphertext", revokedAt: null });
    apply(`BEGIN; UPDATE "CloudAccountCredential" SET version=version+1,"encryptedConfiguration"='',"revokedAt"=now() WHERE id='fixture-account' AND version=2; DO $$ BEGIN RAISE EXCEPTION 'injected_revocation_failure'; END $$; COMMIT;`, false, "injected_revocation_failure");
    assert.deepEqual(await credential(), { version: 2, encryptedConfiguration: "synthetic-ciphertext", revokedAt: null });
    for (const [id, org, bound] of [["revoke-bound", "fixture-org", "fixture-account"], ["revoke-null", "fixture-org", null], ["revoke-foreign", "foreign-org", null]]) {
      await client.$executeRawUnsafe(`INSERT INTO "CloudAccountEnrollmentAttempt" (id,"organizationId","userId","expectedAccountId","roleArn",region,"externalIdDigest","expiresAt","cloudAccountId","updatedAt") VALUES ($1,$2,'fixture-user','123456789012','fixture-role','us-east-1',repeat('b',64),now()+interval '5 minutes',$3,now())`, id, org, bound);
    }
    await client.$transaction(async tx => {
      assert.equal(await tx.$executeRawUnsafe(`UPDATE "CloudAccountCredential" SET version=version+1,"encryptedConfiguration"='',"revokedAt"=now() WHERE id='fixture-account' AND "organizationId"='fixture-org' AND version=2 AND "revokedAt" IS NULL`), 1);
      assert.equal(await tx.$executeRawUnsafe(`UPDATE "CloudAccountEnrollmentAttempt" SET "expiresAt"=now() WHERE "organizationId"='fixture-org' AND "consumedAt" IS NULL AND "expiresAt">now() AND ("cloudAccountId"='fixture-account' OR "expectedAccountId"='123456789012')`), 2);
    }, { isolationLevel: "Serializable" });
    const revoked = await credential(); assert.equal(revoked.version, 3); assert.equal(revoked.encryptedConfiguration, ""); assert.ok(revoked.revokedAt instanceof Date);
    assert.equal(await client.$executeRawUnsafe(`UPDATE "CloudAccountCredential" SET "encryptedConfiguration"='stale-reconnect' WHERE id='fixture-account' AND version=2 AND "revokedAt" IS NULL`), 0);
    const [foreignAttempt] = await client.$queryRawUnsafe(`SELECT "expiresAt">now() AS active FROM "CloudAccountEnrollmentAttempt" WHERE id='revoke-foreign'`); assert.equal(foreignAttempt.active, true);
    assert.equal(await client.$executeRawUnsafe(`UPDATE "CloudAccountCredential" SET version=version+1,"encryptedConfiguration"='fresh-fixture-only',"revokedAt"=NULL WHERE id='fixture-account' AND version=3`), 1);
    assert.equal((await credential()).version, 4);
    apply(revokeSql, false, "cloud_revocation_column_already_present");
    return { target: "isolated_loopback_empty_fixture", absentBaselineTransaction: "passed_rolled_back", incompatibleEnums: "rejected_unchanged", missingPrimaryKey: "rejected", wrongNamedUniqueIndex: "rejected", existingAccount: "preserved", compositeTenantForeignKeys: "passed", versionCompareAndSwap: "passed", challengeSingleConsumptionPredicate: "passed", repeatedMigration: "rejected_unchanged", serializableLastSlot: { concurrentSnapshots: 2, committed: 1, rejected: 1, failureCode: lastSlotFailureCode, finalAccountCount: 1, distinctExternalAccountIds: true }, production: "untouched", providerCalls: "none", historicalAgentMigration: "not_modified", localRevocation: { separateMigration: revocationMigration, additiveExistingCiphertext: "preserved", wrongShape: "rejected", ddlRollback: "passed", configurationWipeAndVersion: "passed", pendingBoundAndNullSiblingExpiry: "passed", foreignTenantAttempt: "preserved", staleCompletion: "rejected", reconnectVersion: 4, repeatedMigration: "rejected", providerSessionRevocation: "not_attempted" } };
  } finally {
    await client.$disconnect();
    rmSync(temp, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  rehearseAwsEnrollment(process.env.AWS_ENROLLMENT_TEST_DATABASE_URL).then(report => console.log(JSON.stringify(report, null, 2))).catch(() => {
    console.error("Isolated AWS enrollment fixture failed. No production target is accepted.");
    process.exitCode = 1;
  });
}
