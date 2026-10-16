import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { makeSavedTerraformPlanFixture, validateSavedPlanFixtureTarget } from "./fixtures/savedTerraformPlanFixture.mjs";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Parent-owned current-schema/auth/pairing continuation. Never accepts an
 * existing customer DB, invokes apply, dispatches, or seeds billing access. */
export async function rehearseLocalSavedTerraformHttp({ databaseUrl, client, deviceRequest, token, organizationId, userId, executablePath, encryptionSecret }) {
  const target = new URL(validateSavedPlanFixtureTarget(databaseUrl));
  const [database] = await client.$queryRawUnsafe("SELECT current_database() AS name");
  assert.equal(database.name, target.pathname.slice(1), "owned_saved_plan_database_binding_required");
  assert.equal((await client.user.findUnique({ where: { id: userId } }))?.email, "fixture-customer@example.test", "synthetic_saved_plan_identity_required");
  assert.equal(await client.tenantBillingPlan.count(), 0, "saved_plan_fixture_must_not_seed_entitlement");
  assert.equal((await client.$queryRawUnsafe(`SELECT to_regclass('public."TerraformSavedPlanArtifact"') IS NULL AS absent`))[0].absent, true, "empty_saved_plan_storage_required_never_reset");
  const requestId = `saved-plan-${randomUUID()}`;
  const row = await client.tauriDeploymentRequest.create({ data: { id: requestId, organizationId, requesterUserId: userId, title: "Synthetic local Terraform evidence — no cloud authority", correlationId: randomUUID(), intakeJson: {}, version: 1 } });
  await client.tauriDeploymentRequestVersion.create({ data: { organizationId, deploymentRequestId: row.id, version: 1, intakeJson: {}, contentHash: createHash("sha256").update("synthetic-local-intake").digest("hex"), createdByUserId: userId } });
  const path = `/api/desktop/deployments/${requestId}/terraform-plans`;
  assert.equal((await deviceRequest(path)).status, 401, "saved_plan_requires_paired_identity");
  assert.equal((await deviceRequest(path, { token })).status, 503, "saved_plan_missing_storage_must_fail_closed");
  const fixture = await makeSavedTerraformPlanFixture({ executablePath, encryptionSecret, organizationId, requestId });
  const temporary = mkdtempSync(join(tmpdir(), "axiom-saved-plan-pg-"));
  const proposal = readFileSync(join(root, "docs/proposals/terraform-saved-plan-storage-v1.sql"), "utf8");
  const executeSql = sql => {
    const file = join(temporary, `${randomUUID()}.sql`); writeFileSync(file, sql, { mode: 0o600, flag: "wx" });
    return spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "db", "execute", "--file", file, "--schema", join(root, "prisma/schema.prisma")],
      { cwd: root, env: { PATH: process.env.PATH ?? "/usr/bin:/bin", DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: "true", CHECKPOINT_DISABLE: "1" }, encoding: "utf8", timeout: 30_000, maxBuffer: 128 * 1024 });
  };
  try {
    assert.equal(executeSql(proposal.replace(/COMMIT;\s*$/, "ROLLBACK;")).status, 0, "saved_plan_proposal_rollback_failed");
    assert.equal((await client.$queryRawUnsafe(`SELECT to_regclass('public."TerraformSavedPlanArtifact"') IS NULL AS absent`))[0].absent, true);
    assert.equal(executeSql(proposal).status, 0, "saved_plan_proposal_fixture_install_failed");
    assert.equal(await fixture.harness.readSavedPlanStorageReadiness(client), "drift", "unmarked_tables_must_not_be_adopted");
    await client.$executeRawUnsafe('INSERT INTO public."TerraformSavedPlanFeature" ("version","proposalChecksum") VALUES (1,$1)', fixture.harness.SAVED_PLAN_PROPOSAL_CHECKSUM);
    assert.equal(await fixture.harness.readSavedPlanStorageReadiness(client), "ready", "saved_plan_exact_catalog_not_ready");
    await fixture.harness.insertSavedPlanRecord(client, fixture.row);
    await assert.rejects(fixture.harness.insertSavedPlanRecord(client, { ...fixture.row, id: randomUUID(), organizationId: "foreign-fixture" }));
    await assert.rejects(fixture.harness.insertSavedPlanRecord(client, fixture.row));
    await assert.rejects(client.$executeRawUnsafe('UPDATE public."TerraformSavedPlanArtifact" SET "binaryDigest"=$1 WHERE "id"=$2', "b".repeat(64), fixture.row.id));
    await assert.rejects(client.$executeRawUnsafe('DELETE FROM public."TerraformSavedPlanArtifact" WHERE "id"=$1', fixture.row.id));
    const listed = await deviceRequest(path, { token }); assert.equal(listed.status, 200, "paired_saved_plan_list_failed");
    const list = await listed.json();
    assert.equal(list.data.plans.length, 1); assert.equal(list.data.plans[0].id, fixture.row.id);
    assert.equal(list.data.plans[0].inspection, "metadata_only"); assert.equal(list.data.executionEnabled, false);
    assert.ok(!JSON.stringify(list).match(/encrypted|summary|planned_values|configurationDigest/));
    const detailPath = `${path}/${fixture.row.id}`;
    const detail = await deviceRequest(detailPath, { token }); assert.equal(detail.status, 200, "paired_saved_plan_detail_failed");
    const body = await detail.json(), observed = body.data.plans[0];
    assert.equal(observed.binaryDigest, fixture.row.binaryDigest); assert.equal(observed.summary.counts.create, 1);
    assert.equal(observed.inspection, "artifact_bytes_checked"); assert.equal(observed.approval, "unavailable"); assert.equal(observed.currentTarget, "unavailable");
    assert.ok(!JSON.stringify(body).match(/synthetic-owned-saved-plan|encrypted|planned_values|stateLineage/));
    assert.equal((await deviceRequest(`/api/desktop/deployments/foreign-request/terraform-plans/${fixture.row.id}`, { token })).status, 404);
    await client.tauriDeploymentRequest.update({ where: { id: requestId }, data: { version: 2 } });
    assert.equal((await deviceRequest(detailPath, { token })).status, 409, "stale_request_binding_must_fail");
    await client.$executeRawUnsafe('DELETE FROM public."TerraformSavedPlanFeature" WHERE "version"=1');
    assert.equal(await fixture.harness.readSavedPlanStorageReadiness(client), "drift");
    assert.equal((await deviceRequest(path, { token })).status, 503, "drift_must_not_return_artifact_evidence");
    assert.equal(await client.tenantBillingPlan.count(), 0);
    return { ...fixture.report, proposal: "review_only_installed_in_owned_fixture", proposalRollback: "passed", exactCatalog: "ready", unmarkedAndRemovedMarker: "drift", immutableUpdateDelete: "rejected", mixedTenantInsert: "rejected", duplicateInsert: "rejected", pairedList: "metadata_only", pairedDetail: "exact_binary_show_summary", staleRequestVersion: "rejected", missingStorageAndDrift: "503", unauthenticated: "401", foreignRequest: "404", approval: "unavailable", executionEnabled: false, transport: "real_local_next_http", persistence: "owned_disposable_postgresql", notVerified: ["customer_backend_state_or_locks", "live_provider", "current_target_credentials_or_approval", "cloud_apply_recovery", "native_packaged_UI"] };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
