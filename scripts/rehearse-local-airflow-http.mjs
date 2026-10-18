import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { loadAirflowReviewHarness } from "./fixtures/airflowReviewHarness.mjs";
import { runOwnedAirflowPgAcceptance } from "./fixtures/airflowReviewPgAcceptance.mjs";
import { AIRFLOW_FIXTURE_ORIGIN, AIRFLOW_FIXTURE_DAG, AIRFLOW_FIXTURE_DEPENDENCY } from "./fixtures/ownedAirflowWireFixture.mjs";
const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Explicit onPaired continuation, current schema and synthetic connection only.
 * Real app HTTP reaches stale review refusal; no GitHub/AWS dispatch is attempted. */
export async function rehearseLocalAirflowHttp({ databaseUrl, client, appOrigin, token, organizationId, userId, fixture }) {
  const db = new URL(databaseUrl), app = new URL(appOrigin);
  assert.ok(["postgres:", "postgresql:"].includes(db.protocol) && db.hostname === "127.0.0.1" && db.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(db.pathname) && !db.search && !db.hash, "owned_airflow_database_required");
  assert.ok(app.protocol === "http:" && app.hostname === "127.0.0.1" && app.port && app.pathname === "/", "owned_airflow_application_required");
  assert.equal((await client.$queryRawUnsafe("SELECT current_database() AS name"))[0].name, db.pathname.slice(1));
  assert.equal((await client.user.findUnique({ where: { id: userId } })).email, "fixture-customer@example.test");
  assert.equal(await client.tenantBillingPlan.count(), 0); await fixture.waitUntilReady();
  const deadline = Date.now() + 180_000;
  async function request(path, { method = "GET", body, bearer = token } = {}) {
    assert.ok(path.startsWith("/") && !path.startsWith("//") && Date.now() < deadline);
    const url = new URL(path, app); assert.equal(url.origin, app.origin);
    return fetch(url, { method, redirect: "manual", credentials: "omit", headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(Math.min(45_000, deadline - Date.now())) });
  }
  const harness = loadAirflowReviewHarness();
  assert.equal(await harness.restartReviewReadiness(client), "not_installed", "owned_optional_storage_must_start_absent");
  const connected = await request("/api/desktop/airflow/connection", { method: "PUT", body: { baseUrl: AIRFLOW_FIXTURE_ORIGIN, authMode: "token", token: fixture.token } });
  assert.equal(connected.status, 200, "actual_paired_airflow_connection_failed");
  const connection = await client.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider: "airflow" } } });
  assert.ok(connection.encryptedCredential && !connection.encryptedCredential.includes(fixture.token), "airflow_credential_must_be_encrypted");
  const dags = await request("/api/desktop/airflow/dags"); assert.equal(dags.status, 200); assert.equal((await dags.json()).data.dags.length, 2);
  const runs = await request(`/api/desktop/airflow/dags/${AIRFLOW_FIXTURE_DAG}/runs`); assert.equal(runs.status, 200); assert.equal((await runs.json()).data.runs[0].state, "success");
  const environment = await client.environment.create({ data: { organizationId, slug: "synthetic-airflow", name: "Synthetic Airflow restart target", tier: "dev" } });
  await client.deploymentTarget.create({ data: { organizationId, environmentId: environment.id, provider: "aws", roleArn: "arn:aws:iam::123456789012:role/AirflowSyntheticRestart", region: "us-east-1", ecsCluster: "cluster-A", ecsService: "service-A" } });
  const created = await request("/api/desktop/airflow/automations", { method: "POST", body: { name: "Synthetic Airflow destination integrity", dagId: AIRFLOW_FIXTURE_DAG, triggerMode: "dag_completion", requiredDagState: "success", dependencyDagIds: [AIRFLOW_FIXTURE_DEPENDENCY], actionType: "deploy", repositoryFullName: "fixture/repository", sourceRef: "main", environmentId: environment.id, approvalRequired: true, notifyOnSuccess: false, notifyOnFailure: false } });
  assert.equal(created.status, 201, "actual_paired_airflow_rule_creation_failed"); const rule = (await created.json()).data.automation;
  const legacy = await client.airflowAutomationExecution.create({ data: { organizationId, automationId: rule.id, sourceDagId: AIRFLOW_FIXTURE_DAG, sourceDagRunId: "synthetic-historical-no-review", sourceDagState: "success", status: "pending_approval" } });
  const reviewPath = id => `/api/desktop/airflow/executions/${id}/review`;
  const approvePath = id => `/api/desktop/airflow/executions/${id}/approve`;
  assert.equal((await request(reviewPath(legacy.id))).status, 503, "missing_storage_must_fail_closed");
  assert.equal((await request("/api/desktop/airflow/automations")).status, 200, "ordinary_legacy_reads_must_remain_available");
  const tick = async () => { const response = await request("/api/cron/airflow-automation-tick", { bearer: fixture.cronSecret }); assert.equal(response.status, 200); return (await response.json()).data; };
  assert.equal((await tick()).proposals, 0); assert.equal(await client.airflowAutomationExecution.count({ where: { automationId: rule.id } }), 1, "absent_storage_cannot_create_restart_execution");
  const temporary = mkdtempSync(join(tmpdir(), "axiom-airflow-review-pg-"));
  const proposal = readFileSync(join(root, "docs/proposals/airflow-execution-review-v1.sql"), "utf8");
  function sql(text) {
    const file = join(temporary, `${randomUUID()}.sql`); writeFileSync(file, text, { mode: 0o600, flag: "wx" });
    const result = spawnSync(process.execPath, [join(root, "node_modules/prisma/build/index.js"), "db", "execute", "--file", file, "--schema", join(root, "prisma/schema.prisma")], { cwd: root, env: { PATH: process.env.PATH ?? "/usr/bin:/bin", DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl, PRISMA_HIDE_UPDATE_MESSAGE: "true", CHECKPOINT_DISABLE: "1" }, encoding: "utf8", timeout: 30_000, maxBuffer: 128 * 1024 });
    assert.equal(result.status, 0, "owned_airflow_sql_failed");
  }
  async function nextProposal() {
    const runId = fixture.advanceRun(); await tick();
    const execution = await client.airflowAutomationExecution.findUnique({ where: { automationId_sourceDagRunId: { automationId: rule.id, sourceDagRunId: runId } } });
    assert.ok(execution, "actual_scheduler_review_proposal_required"); return execution;
  }
  try {
    sql(proposal.replace(/COMMIT;\s*$/, "ROLLBACK;")); assert.equal(await harness.restartReviewReadiness(client), "not_installed");
    sql(proposal); assert.equal(await harness.restartReviewReadiness(client), "drift", "unmarked_storage_must_not_be_adopted");
    await client.$executeRawUnsafe('INSERT INTO public."AirflowExecutionReviewFeature" ("version","proposalChecksum") VALUES (1,$1)', harness.AIRFLOW_REVIEW_PROPOSAL_CHECKSUM);
    assert.equal(await harness.restartReviewReadiness(client), "ready", "actual_airflow_catalog_must_match_exactly");
    sql('ALTER TABLE public."AirflowExecutionReview" RENAME TO "AirflowExecutionReviewHiddenFixture";');
    assert.equal(await harness.restartReviewReadiness(client), "drift", "partial_optional_storage_must_fail_closed");
    assert.equal((await request(reviewPath(legacy.id))).status, 503); assert.equal((await request("/api/desktop/airflow/automations")).status, 200);
    sql('ALTER TABLE public."AirflowExecutionReviewHiddenFixture" RENAME TO "AirflowExecutionReview";');
    assert.equal(await harness.restartReviewReadiness(client), "ready");
    await Promise.all([tick(), tick()]);
    const executions = await client.airflowAutomationExecution.findMany({ where: { automationId: rule.id, id: { not: legacy.id } }, include: { automation: true } }); assert.equal(executions.length, 1);
    const execution = executions[0], review = await harness.readRestartReview(client, organizationId, execution.id); assert.ok(review);
    assert.equal(Number((await client.$queryRawUnsafe('SELECT count(*)::integer AS count FROM public."AirflowExecutionReview"'))[0].count), 1);
    assert.equal((await tick()).proposals, 0, "same_source_run_must_not_create_second_review");
    const read = await request(reviewPath(execution.id)); assert.equal(read.status, 200); assert.equal(read.headers.get("cache-control"), "no-store"); const dto = (await read.json()).data;
    assert.equal(dto.digest, review.digest); assert.equal(dto.target.ecsService, "service-A"); assert.equal(dto.requestedOperation, "service_restart");
    assert.ok(!JSON.stringify(dto).includes(fixture.token) && !JSON.stringify(dto).includes("encryptedCredential"));
    assert.equal((await request(reviewPath(execution.id), { bearer: null })).status, 401);
    const apiKey = harness.mintApiKey("test");
    const storedKey = await client.apiKey.create({ data: { organizationId, name: "Synthetic Airflow paired-only refusal", prefix: apiKey.prefix, keyHash: apiKey.keyHash, env: "test", scopes: ["pipeline:read", "pipeline:trigger"], createdBy: "fixture-customer@example.test" } });
    assert.equal((await request(reviewPath(execution.id), { bearer: apiKey.plaintext })).status, 401, "stored_api_key_cannot_read_paired_review");
    assert.equal((await request(approvePath(execution.id), { method: "POST", body: { expectedReviewDigest: review.digest }, bearer: apiKey.plaintext })).status, 401, "stored_api_key_cannot_approve_restart");
    assert.equal((await client.apiKey.findUnique({ where: { id: storedKey.id } })).useCount, 0);
    assert.equal((await request(reviewPath("foreign-execution"))).status, 404);
    assert.equal((await request(reviewPath(legacy.id))).status, 409); assert.equal((await request(approvePath(legacy.id), { method: "POST", body: { expectedReviewDigest: review.digest } })).status, 409);
    assert.equal((await request(approvePath(execution.id), { method: "POST", body: {} })).status, 409);
    assert.equal((await request(approvePath(execution.id), { method: "POST", body: { expectedReviewDigest: "b".repeat(64) } })).status, 409);
    await assert.rejects(harness.insertRestartReview(client, { ...review, organizationId: "foreign-fixture" }));
    await assert.rejects(client.$executeRawUnsafe('UPDATE public."AirflowExecutionReview" SET digest=$1 WHERE "executionId"=$2', "b".repeat(64), execution.id));
    await assert.rejects(client.$executeRawUnsafe('DELETE FROM public."AirflowExecutionReview" WHERE "executionId"=$1', execution.id));
    await client.deploymentTarget.update({ where: { environmentId: environment.id }, data: { ecsService: "service-replaced" } });
    const stale = await request(approvePath(execution.id), { method: "POST", body: { expectedReviewDigest: review.digest } }); assert.equal(stale.status, 409); assert.equal((await stale.json()).error, "airflow_restart_review_stale");
    const unchanged = await client.airflowAutomationExecution.findUnique({ where: { id: execution.id } }); assert.equal(unchanged.attempt, 0); assert.equal(unchanged.status, "pending_approval"); assert.equal(await client.deploymentExecution.count(), 0);
    await client.deploymentTarget.update({ where: { environmentId: environment.id }, data: { ecsService: "service-A" } });
    assert.equal((await request(approvePath(execution.id), { method: "POST", body: { expectedReviewDigest: review.digest } })).status, 409, "restored_fields_with_new_revision_must_still_refuse");
    assert.equal((await request(`/api/desktop/airflow/executions/${legacy.id}/reject`, { method: "POST", body: {} })).status, 200, "legacy_missing_review_must_remain_rejectable");
    sql(`CREATE FUNCTION public.axiom_fixture_refuse_airflow_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic_sidecar_failure'; END $$; CREATE TRIGGER axiom_fixture_refuse_airflow_insert BEFORE INSERT ON public."AirflowExecutionReview" FOR EACH ROW EXECUTE FUNCTION public.axiom_fixture_refuse_airflow_insert();`);
    const failedRun = fixture.advanceRun(); await tick(); assert.equal(await client.airflowAutomationExecution.count({ where: { automationId: rule.id, sourceDagRunId: failedRun } }), 0, "sidecar_failure_must_roll_back_parent_execution");
    sql('DROP TRIGGER axiom_fixture_refuse_airflow_insert ON public."AirflowExecutionReview"; DROP FUNCTION public.axiom_fixture_refuse_airflow_insert();');
    const pg = await runOwnedAirflowPgAcceptance({ databaseUrl, client, harness, nextProposal, organizationId, userId, environmentId: environment.id });
    await client.$executeRawUnsafe('DELETE FROM public."AirflowExecutionReviewFeature" WHERE version=1'); assert.equal(await harness.restartReviewReadiness(client), "drift");
    assert.equal((await request(reviewPath(execution.id))).status, 503); assert.equal(await client.tenantBillingPlan.count(), 0);
    return { proposal: "review_only_installed_in_owned_fixture", exactCatalog: "ready", proposalRollback: "passed", absentPartialUnmarkedRemovedMarker: "fail_closed", actualPairedConnection: "encrypted", source: "synthetic_Airflow3_HTTP_GET_contract", scheduler: "single_execution_and_immutable_review", forcedSidecarFailure: "parent_rolled_back", pairedReview: "exact_destination_and_digest", validStoredApiKey: "paired_read_and_approval_refused", historicalReview: "blocked_and_rejectable", wrongMissingDigest: "409_before_claim", targetAndRevisionChange: "409_before_claim_or_allowance", immutableUpdateDelete: "refused", pg, wire: fixture.report(), transport: "actual_owned_Next_HTTP", persistence: "owned_disposable_PostgreSQL", providerWrites: 0, notVerified: ["real_Airflow_or_timetable", "exact_cross_DAG_partition_correlation", "GitHub_policy_and_dispatch_HTTP", "AWS_restart_or_health", "native_packaged_UI", "production_storage_installation", "billing_entitlement"] };
  } finally { rmSync(temporary, { recursive: true, force: true }); }
}
