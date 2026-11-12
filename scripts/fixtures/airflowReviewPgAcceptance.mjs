import assert from "node:assert/strict";
import { createDatabaseClient } from "../../lib/database/createDatabaseClient.ts";

/** Actual checked-in final-fence IO in two independently connected PG clients.
 * Provider dispatch/policy/billing remain outside this fixture's authority. */
export async function runOwnedAirflowPgAcceptance({ databaseUrl, client, harness, nextProposal, organizationId, userId, environmentId }) {
  const second = createDatabaseClient(databaseUrl);
  const receipts = [];
  async function claim(execution) {
    assert.equal((await client.airflowAutomationExecution.updateMany({ where: { id: execution.id, status: "pending_approval", attempt: 0 }, data: { status: "running", attempt: 1, decidedByUserId: userId } })).count, 1);
    const review = await harness.readRestartReview(client, organizationId, execution.id); assert.ok(review);
    return review;
  }
  async function syntheticHold(executionId, suffix = "") {
    return client.deploymentExecution.create({ data: { organizationId, environmentId, idempotencyKey: `airflow-execution:${executionId}${suffix}`, repositoryFullName: "fixture/repository", sourceRef: "main", sourceKind: "branch", sourceCommitSha: "a".repeat(40), source: "agent", triggeredByUserId: userId, status: "reserved" } });
  }
  async function conflictingFence(change) {
    const execution = await nextProposal(), review = await claim(execution), hold = await syntheticHold(execution.id);
    let release, changed, started, pid;
    const changedSignal = new Promise(resolve => { changed = resolve; });
    const startedSignal = new Promise(resolve => { started = resolve; });
    const continueChange = new Promise(resolve => { release = resolve; });
    const writer = second.$transaction(async tx => { await change(tx); changed(); await continueChange; }, { timeout: 15_000 });
    // Attach rejection observers before the other transaction can finish.
    const writerOutcome = writer.then(() => ({ ok: true }), error => ({ error }));
    let fencedOutcome;
    try {
      await Promise.race([changedSignal, writerOutcome.then(outcome => { if (outcome.error) throw outcome.error; })]);
      const fenced = client.$transaction(async tx => {
        pid = Number((await tx.$queryRawUnsafe("SELECT pg_backend_pid() AS pid"))[0].pid); started();
        await harness.fenceRestartDispatch(tx, review, 1, userId, { deploymentExecutionId: hold.id });
      }, { isolationLevel: "Serializable", timeout: 15_000 });
      fencedOutcome = fenced.then(() => ({ ok: true }), error => ({ error }));
      await Promise.race([startedSignal, fencedOutcome.then(outcome => { if (outcome.error) throw outcome.error; })]);
      let blocked = false;
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const observed = await second.$queryRawUnsafe("SELECT wait_event_type='Lock' AS blocked FROM pg_stat_activity WHERE pid=$1", pid);
        if (observed[0]?.blocked) { blocked = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.ok(blocked, "actual_final_fence_must_wait_on_conflicting_authority_row");
    } finally { release(); }
    assert.ok((await writerOutcome).ok, "owned_conflicting_writer_failed");
    const outcome = await fencedOutcome; assert.ok(outcome.error, "changed_authority_must_refuse_final_fence");
    const stored = await client.airflowAutomationExecution.findUnique({ where: { id: execution.id } });
    assert.equal(stored.status, "running"); assert.equal(stored.resultJson?.phase, undefined, "refused_transaction_must_not_save_dispatch_intent");
    assert.equal(await harness.releaseDeploymentDispatch(client, organizationId, hold.id), true, "only_new_confirmed_pre_dispatch_hold_is_released");
    assert.equal(await client.deploymentExecution.count({ where: { id: hold.id } }), 0);
    return execution;
  }
  try {
    const unknown = await syntheticHold("synthetic-prior-unknown-hold");
    await conflictingFence(tx => tx.deploymentTarget.update({ where: { environmentId }, data: { ecsService: "service-B" } }));
    await conflictingFence(tx => tx.orgMembership.update({ where: { userId_organizationId: { userId, organizationId } }, data: { role: "operator" } }));
    await client.orgMembership.update({ where: { userId_organizationId: { userId, organizationId } }, data: { role: "owner" } });
    assert.equal((await client.deploymentExecution.findUnique({ where: { id: unknown.id } })).status, "reserved", "prior_unknown_hold_must_remain");
    const execution = await nextProposal(), review = await claim(execution), hold = await syntheticHold(execution.id);
    await client.$transaction(tx => harness.fenceRestartDispatch(tx, review, 1, userId, { deploymentExecutionId: hold.id }), { isolationLevel: "Serializable" });
    const intent = (await client.airflowAutomationExecution.findUnique({ where: { id: execution.id } })).resultJson;
    assert.equal(intent.phase, "dispatching"); assert.equal(intent.reviewDigest, review.digest); assert.equal(intent.deploymentExecutionId, hold.id);
    // Observation recorder only: never invoke a provider adapter or fabricate a receipt.
    receipts.push({ target: review.payload.target, digest: review.digest });
    assert.equal(receipts.length, 1); assert.equal(await client.tenantBillingPlan.count(), 0);
    return { targetConflict: "actual_row_lock_wait_then_refusal", membershipConflict: "actual_row_lock_wait_then_refusal", refusedIntent: "transaction_rolled_back", newPreDispatchHolds: "confirmed_release", priorUnknownHold: "retained", matchedFence: "durable_review_digest_and_exact_target", source: "actual_checked_in_IO_two_PG_clients", providerCalls: 0, quotaEntitlement: "not_seeded_or_attested", orchestration: "recording_executor_tests_separate" };
  } finally { await second.$disconnect(); }
}
