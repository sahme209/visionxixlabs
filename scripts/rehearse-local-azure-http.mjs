import assert from "node:assert/strict";
import { createDecipheriv, createHash } from "node:crypto";

/** Actual paired-route → service → canonical DB → actual SDK wire acceptance; owned fixture only. */
export async function rehearseLocalAzureHttp({ databaseUrl, client, deviceRequest, token, organizationId, userId, fixture }) {
  const target = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol) && target.hostname === "127.0.0.1" && target.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(target.pathname) && !target.search && !target.hash, "owned_azure_database_target_required");
  const [binding] = await client.$queryRawUnsafe("SELECT current_database() AS database");
  assert.equal(binding.database, target.pathname.slice(1));
  assert.equal((await client.user.findUniqueOrThrow({ where: { id: userId } })).email, "fixture-customer@example.test");
  fixture.assertReady();
  assert.equal(await client.cloudAccount.count({ where: { organizationId, provider: "azure" } }), 0);
  const before = { leads: await client.lead.count(), terraform: await client.terraformExecutionJob.count(), billing: await client.tenantBillingPlan.count(), deployments: await client.deploymentExecution.count() };
  const input = { tenantId: fixture.tenantId, subscriptionId: fixture.subscriptionId, clientId: fixture.clientId, clientSecret: fixture.clientSecret, expectedVersion: null };
  const base = "/api/desktop/cloud/azure";
  const readJson = async (response, status, message) => { assert.equal(response.status, status, message); const body = await response.json(); assert.ok(!JSON.stringify(body).includes(fixture.clientSecret) && !JSON.stringify(body).includes("owned-azure-fixture-never-valid-token"), "secret_or_token_must_not_be_public"); return body; };
  await readJson(await deviceRequest(`${base}/accounts`), 401, "paired_bearer_required");
  const connected = (await readJson(await deviceRequest(`${base}/enrollment`, { token, body: input }), 200, "actual_azure_enrollment_failed_no_entitlement_bypass")).data.account;
  assert.ok(connected.provider === "azure" && connected.subscriptionId === fixture.subscriptionId && connected.connected && connected.connectionVersion === 1 && connected.enabled === false && connected.agentScanAvailable === false);
  const account = await client.cloudAccount.findUniqueOrThrow({ where: { id: connected.id } });
  const credential = await client.cloudAccountCredential.findUniqueOrThrow({ where: { id: connected.id } });
  assert.ok(account.organizationId === organizationId && account.provider === "azure" && account.externalAccountId === fixture.subscriptionId && account.credentialRef === `cloud-v2:${account.id}` && account.enabled === false && account.autopilotMode === "observe_only");
  assert.ok(credential.organizationId === organizationId && credential.version === 1 && credential.revokedAt === null && credential.encryptedConfiguration.startsWith("v2."));
  const bytes = Buffer.from(credential.encryptedConfiguration.slice(3), "base64url");
  const open = context => { const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(fixture.encryptionSecret.slice(0, 128)).digest(), bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28)); decipher.setAAD(Buffer.from(context)); return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString(); };
  const context = `cloud-account-credential-v1:${organizationId}:azure:${account.id}:1`;
  assert.deepEqual(JSON.parse(open(context)), { tenantId: fixture.tenantId, subscriptionId: fixture.subscriptionId, clientId: fixture.clientId, clientSecret: fixture.clientSecret });
  assert.throws(() => open(context.replace(organizationId, "foreign-workspace"))); assert.throws(() => open(context.replace(":azure:", ":aws:"))); assert.throws(() => open(context.replace(/:1$/, ":2")));
  const list = (await readJson(await deviceRequest(`${base}/accounts`, { token }), 200, "canonical_azure_catalog_failed")).data.accounts;
  assert.ok(list.some(row => row.id === account.id && row.connected && row.connectionVersion === 1));
  const inventoryPath = `${base}/accounts/${account.id}/inventory`, disconnectPath = `${base}/accounts/${account.id}/disconnect`;
  const observed = (await readJson(await deviceRequest(inventoryPath, { token }), 200, "actual_sdk_first_page_failed")).data;
  assert.ok(observed.accountId === account.id && observed.connectionVersion === 1 && observed.complete === false && observed.limit === 100 && observed.scope === "first_resource_groups_page" && observed.resourceGroups.length === 1 && observed.resourceGroups[0].name === "owned-azure-group");
  const foreign = await client.cloudAccount.create({ data: { organizationId: "ws_owned_foreign_azure", provider: "azure", externalAccountId: fixture.clientId, enabled: false } });
  try { const count = fixture.report().guardedRequests; await readJson(await deviceRequest(`${base}/accounts/${foreign.id}/inventory`, { token }), 404, "foreign_azure_metadata_must_be_invisible"); assert.equal(fixture.report().guardedRequests, count); } finally { await client.cloudAccount.delete({ where: { id: foreign.id } }); }
  for (const [mode, status] of [["denied", 403], ["redirect", 503], ["oversize", 503], ["compressed", 503]]) {
    fixture.setMode(mode); try { const denied = await readJson(await deviceRequest(inventoryPath, { token }), status, `${mode}_must_not_be_empty_success`); assert.equal(denied.ok, false); } finally { fixture.setMode("success"); }
  }
  // Current membership is rechecked after the actual delayed SDK read, not merely at route entry.
  const membershipKey = { userId_organizationId: { userId, organizationId } };
  const membership = await client.orgMembership.findUniqueOrThrow({ where: membershipKey });
  const groupCount = fixture.report().requests.filter(value => value === "ResourceGroupsFirstPage").length;
  fixture.setMode("held");
  const delayedAuthorityRead = deviceRequest(inventoryPath, { token });
  try {
    await fixture.waitForOperation("ResourceGroupsFirstPage", groupCount + 1);
    await client.orgMembership.update({ where: membershipKey, data: { acceptedAt: null } }); fixture.release();
    await readJson(await delayedAuthorityRead, 403, "late_inventory_after_membership_removal_must_fail");
  } finally { fixture.release(); await client.orgMembership.update({ where: membershipKey, data: { acceptedAt: membership.acceptedAt } }); }
  const pendingCount = fixture.report().requests.filter(value => value === "ResourceGroupsFirstPage").length;
  fixture.setMode("held"); const delayedRevokedRead = deviceRequest(inventoryPath, { token });
  await fixture.waitForOperation("ResourceGroupsFirstPage", pendingCount + 1);
  const disconnected = (await readJson(await deviceRequest(disconnectPath, { token, body: { expectedVersion: 1 } }), 200, "zeroizing_azure_disconnect_failed")).data.account;
  assert.ok(!disconnected.connected && disconnected.connectionVersion === 2);
  fixture.release(); await readJson(await delayedRevokedRead, 409, "late_inventory_after_disconnect_must_fail");
  const revoked = await client.cloudAccountCredential.findUniqueOrThrow({ where: { id: account.id } });
  assert.ok(revoked.encryptedConfiguration === "" && revoked.version === 2 && revoked.revokedAt);
  const beforeRevoked = fixture.report().guardedRequests;
  await readJson(await deviceRequest(inventoryPath, { token }), 409, "revoked_read_must_fail");
  await readJson(await deviceRequest(`${base}/enrollment`, { token, body: { ...input, expectedVersion: 1 } }), 409, "stale_reconnect_must_fail");
  assert.equal(fixture.report().guardedRequests, beforeRevoked, "revoked_or_stale_connection_must_not_call_provider");
  const reconnected = (await readJson(await deviceRequest(`${base}/enrollment`, { token, body: { ...input, expectedVersion: 2 } }), 200, "fresh_azure_reconnect_failed")).data.account;
  assert.ok(reconnected.id === account.id && reconnected.connected && reconnected.connectionVersion === 3);
  fixture.setMode("wrong_identity"); try { await readJson(await deviceRequest(`${base}/enrollment`, { token, body: { ...input, expectedVersion: 3 } }), 400, "wrong_subscription_identity_must_not_replace"); } finally { fixture.setMode("success"); }
  assert.equal((await client.cloudAccountCredential.findUniqueOrThrow({ where: { id: account.id } })).version, 3);
  await readJson(await deviceRequest(disconnectPath, { token, body: { expectedVersion: 1 } }), 409, "stale_disconnect_must_not_revoke_reconnect");
  const quotaWire = fixture.report().guardedRequests;
  const quota = await readJson(await deviceRequest(`${base}/enrollment`, { token, body: { ...input, subscriptionId: fixture.clientId } }), 403, "canonical_cloud_account_allowance_must_block_second_account");
  assert.equal(quota.error, "cloud_account_limit_reached"); assert.equal(fixture.report().guardedRequests, quotaWire);
  await readJson(await deviceRequest(disconnectPath, { token, body: { expectedVersion: 3 } }), 200, "final_credential_zeroization_failed");
  assert.equal((await client.cloudAccountCredential.findUniqueOrThrow({ where: { id: account.id } })).encryptedConfiguration, "");
  assert.deepEqual({ leads: await client.lead.count(), terraform: await client.terraformExecutionJob.count(), billing: await client.tenantBillingPlan.count(), deployments: await client.deploymentExecution.count() }, before, "azure_flow_must_not_invent_paid_or_workflow_state");
  return { verified: ["actual_pairing_bearer_azure_routes", "actual_msal_and_arm_sdk_wire", "canonical_azure_scoped_aead", "foreign_existing_metadata_denied_without_io", "first_page_only_complete_false", "denied_redirect_oversize_compression_fail_closed", "current_authority_rechecked_after_io", "late_inventory_rejected_after_disconnect", "zeroized_versioned_disconnect", "fresh_reconnect_cas", "wrong_identity_retains_connection", "quota_denied_before_provider", "no_lead_or_billing_grants"], wire: fixture.report(), notVerified: ["real_azure_iam", "production_deployment_or_schema", "native_ui_vault_or_installer", "permission_role_assignments", "provider_mutations_or_billing"] };
}
