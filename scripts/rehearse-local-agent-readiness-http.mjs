import assert from "node:assert/strict";

/** Actual disabled-state protocol, without enabling an Agent, provider or plan. */
export async function rehearseLocalAgentReadinessHttp({ databaseUrl, client, deviceRequest, token, organizationId, userId }) {
  const target = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol) && target.hostname === "127.0.0.1" && target.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(target.pathname) && !target.search && !target.hash, "isolated_agent_readiness_database_required");
  const [binding] = await client.$queryRawUnsafe("SELECT current_database() AS database");
  assert.equal(binding.database, target.pathname.slice(1), "owned_agent_readiness_database_binding_required");
  const owner = await client.user.findUnique({ where: { id: userId } });
  assert.equal(owner?.email, "fixture-customer@example.test", "synthetic_agent_readiness_owner_required");
  const membership = await client.orgMembership.findFirst({ where: { organizationId, userId, role: "owner", acceptedAt: { not: null } } });
  assert.ok(membership, "synthetic_agent_readiness_workspace_required");
  assert.equal(await client.workspaceAgentIdentity.count(), 0, "agent_must_remain_unprovisioned");
  assert.equal(await client.organizationAIProviderPolicy.count(), 0, "model_policy_must_remain_unprovisioned");

  assert.equal((await deviceRequest("/api/desktop/usage-summary")).status, 401, "billing_snapshot_requires_paired_bearer");
  const usageResponse = await deviceRequest("/api/desktop/usage-summary", { token });
  assert.equal(usageResponse.status, 200, "actual_billing_snapshot_read_failed");
  assert.equal(usageResponse.headers.get("cache-control"), "no-store", "billing_snapshot_must_not_be_cached");
  const usage = (await usageResponse.json()).data;
  assert.deepEqual([usage.aiInvocationCount, usage.aiInputTokens, usage.aiOutputTokens, usage.aiCostCents], [0, 0, 0, 0], "readiness_fixture_must_not_infer_or_charge");
  assert.equal(usage.billingSnapshot.version, 1, "actual_billing_snapshot_version_required");
  assert.equal(usage.billingSnapshot.plan.available, true, "empty_plan_storage_is_known_not_unavailable");
  assert.equal(usage.billingSnapshot.plan.status, "no_plan", "identity_flow_must_not_establish_subscription");
  assert.equal(usage.billingSnapshot.plan.hasCustomer, false, "identity_flow_must_not_create_stripe_customer");
  assert.equal(usage.billingSnapshot.canManageBilling, true, "current_owner_billing_role_required");
  assert.equal(typeof usage.billingSnapshot.allowance.available, "boolean", "actual_credit_authority_read_required");
  assert.equal("stripeCustomerId" in usage.billingSnapshot.plan, false, "billing_snapshot_must_not_expose_payment_identity");
  // Only the guarded disposable fixture membership changes; no production actor.
  await client.orgMembership.update({ where: { id: membership.id }, data: { role: "read_only" } });
  try {
    const restricted = await deviceRequest("/api/desktop/usage-summary", { token });
    assert.equal(restricted.status, 200, "read_only_member_can_observe_own_usage");
    assert.equal((await restricted.json()).data.billingSnapshot.canManageBilling, false, "billing_snapshot_must_refresh_current_role");
  } finally {
    await client.orgMembership.update({ where: { id: membership.id }, data: { role: "owner" } });
  }

  assert.equal((await deviceRequest("/api/desktop/ai-providers")).status, 401, "model_catalog_requires_paired_bearer");
  const response = await deviceRequest("/api/desktop/ai-providers", { token });
  assert.equal(response.status, 200, "actual_model_policy_read_failed");
  const models = (await response.json()).data;
  assert.deepEqual(models.policy, { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] }, "unprovisioned_ai_policy_must_be_disabled");
  assert.deepEqual(models.providers, [], "provider_fixture_must_not_enable_service_models");

  const created = await deviceRequest("/api/desktop/agent/conversations", { token, body: {} });
  assert.equal(created.status, 201, "actual_disabled_agent_conversation_create_failed");
  const conversationId = (await created.json()).data.id;
  const path = `/api/desktop/agent/conversations/${conversationId}`;
  assert.equal((await deviceRequest(path)).status, 401, "agent_history_requires_paired_bearer");
  const sent = await deviceRequest(`${path}/messages`, { token, body: { message: "Explain this workspace without enabling AI.", workspaceContext: { mode: "chat", operationMode: "inspect" } } });
  assert.equal(sent.status, 200, "actual_disabled_agent_request_failed");
  const outcome = (await sent.json()).data;
  assert.equal(outcome.reply, "The workspace Agent is disabled by organization policy. An owner can enable it in Axiom Control.", "disabled_agent_must_explain_governance");
  assert.equal(outcome.proposal, null, "disabled_agent_must_not_propose");
  assert.equal(outcome.usage, null, "disabled_agent_must_not_claim_model_usage");
  const reopened = await deviceRequest(path, { token });
  assert.equal(reopened.status, 200, "actual_disabled_agent_reopen_failed");
  const persisted = (await reopened.json()).data;
  assert.deepEqual(persisted.turns.map(({ role, content }) => ({ role, content })), [
    { role: "user", content: "Explain this workspace without enabling AI." },
    { role: "assistant", content: outcome.reply },
  ], "disabled_agent_turns_must_be_durable");
  assert.deepEqual(persisted.actions, [], "disabled_agent_must_not_execute_tools");
  await client.agentConversation.update({ where: { id: conversationId }, data: { organizationId: "ws_agent_readiness_foreign_fixture" } });
  assert.equal((await deviceRequest(path, { token })).status, 404, "foreign_agent_history_must_be_denied");
  assert.equal((await deviceRequest(`${path}/messages`, { token, body: { message: "Denied foreign request" } })).status, 404, "foreign_agent_send_must_be_denied");
  assert.equal(await client.agentConversationTurn.count({ where: { conversationId } }), 2, "foreign_request_must_not_persist_turn");
  for (const name of ["workspaceAgentIdentity", "organizationAIProviderPolicy", "agentActionProposal", "aIInvocation", "aIUsageReservation", "usageEvent", "deploymentExecution", "tenantBillingPlan"]) {
    assert.equal(await client[name].count(), 0, "disabled_agent_must_not_enable_dispatch_or_charge");
  }
  return { verified: ["paired_billing_snapshot_no_customer_or_subscription", "fresh_read_only_role_cannot_manage_billing", "paired_disabled_model_policy", "disabled_agent_explanation_without_inference", "persisted_user_and_governance_reply", "foreign_history_and_send_denied", "no_identity_provider_tool_usage_dispatch_or_billing_side_effect"], transport: "real_local_next_http", persistence: "owned_disposable_postgresql", notVerified: ["react_or_browser_interaction", "successful_inference_or_tool_execution", "native_vault_or_packaged_app", "provider_or_paid_entitlement_or_production"] };
}
