import assert from "node:assert/strict";

/** Synthetic durable receipt only: never approve, dispatch, or attach a workflow run. */
export async function rehearseLocalAgentReceiptHttp({ databaseUrl, client, deviceRequest, token, organizationId, userId }) {
  const target = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol) && target.hostname === "127.0.0.1" && target.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(target.pathname) && !target.search && !target.hash, "isolated_receipt_database_required");
  const [binding] = await client.$queryRawUnsafe("SELECT current_database() AS database");
  assert.equal(binding.database, target.pathname.slice(1), "owned_receipt_database_binding_required");
  const owner = await client.user.findUnique({ where: { id: userId } });
  assert.equal(owner?.email, "fixture-customer@example.test", "synthetic_receipt_owner_required");
  assert.equal(await client.tenantBillingPlan.count(), 0, "receipt_must_not_seed_entitlement");
  assert.equal(await client.deploymentExecution.count(), 0, "empty_receipt_execution_fixture_required");
  const execution = await client.deploymentExecution.create({ data: { organizationId, environmentId: "fixture-no-provider-environment", repositoryFullName: "fixture-owner/fixture-repository", source: "agent", triggeredByUserId: userId, status: "tracking_unavailable", workflowRunId: null } });
  const conversation = await client.agentConversation.create({ data: { organizationId, userId, title: "Synthetic persisted receipt, not a deployment" } });
  await client.agentActionProposal.create({ data: { organizationId, conversationId: conversation.id, proposedByUserId: userId, toolName: "trigger_aws_deploy", riskLevel: "high", status: "executed", argsJson: { repositoryFullName: execution.repositoryFullName, environmentId: execution.environmentId }, resultJson: { dispatched: true, execution: { id: execution.id, source: execution.source, repositoryFullName: execution.repositoryFullName, environmentId: execution.environmentId, status: execution.status, workflowRunId: null, conclusion: null, rollbackStatus: execution.rollbackStatus }, legacyEvidence: { path: ".env.production", content: "synthetic-restricted-sentinel" } } } });
  const path = `/api/desktop/agent/conversations/${conversation.id}`;
  assert.equal((await deviceRequest(path)).status, 401, "receipt_requires_paired_bearer");
  const reopened = await deviceRequest(path, { token });
  assert.equal(reopened.status, 200, "persisted_receipt_read_failed");
  const data = (await reopened.json()).data;
  assert.equal(data.id, conversation.id);
  assert.equal(data.actions.length, 1);
  assert.equal(data.actions[0].resultJson.execution.id, execution.id);
  assert.deepEqual(data.actions[0].resultJson.legacyEvidence, { path: ".env.production", evidenceRestricted: true }, "structured_repository_redaction_required");
  assert.ok(!JSON.stringify(data).includes("synthetic-restricted-sentinel"));
  const observed = await deviceRequest(`/api/desktop/environments/deployments/${execution.id}`, { token });
  assert.equal(observed.status, 200, "null_run_receipt_observation_failed");
  const observation = (await observed.json()).data;
  assert.ok(observation.id === execution.id && observation.source === "agent" && observation.environmentId === execution.environmentId && observation.repositoryFullName === execution.repositoryFullName && observation.status === "tracking_unavailable" && observation.workflowRunId === null, "synthetic_observation_binding_required");
  await client.agentConversation.update({ where: { id: conversation.id }, data: { organizationId: "ws_receipt_foreign_fixture" } });
  await client.deploymentExecution.update({ where: { id: execution.id }, data: { organizationId: "ws_receipt_foreign_fixture" } });
  assert.equal((await deviceRequest(path, { token })).status, 404, "foreign_receipt_must_be_denied");
  assert.equal((await deviceRequest(`/api/desktop/environments/deployments/${execution.id}`, { token })).status, 404, "foreign_observation_must_be_denied");
  assert.equal(await client.tenantBillingPlan.count(), 0);
  return { verified: ["paired_persisted_synthetic_receipt_read", "structured_sensitive_evidence_redacted", "canonical_null_run_tracking_unavailable", "receipt_and_observation_tenant_denial", "no_entitlement_seed"], fixture: "synthetic_persisted_receipt_not_dispatch", notVerified: ["real_approval_or_dispatch", "github_aws_provider_execution", "react_http_or_native_ui", "paid_policy_or_production"] };
}
