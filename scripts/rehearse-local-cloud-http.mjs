import assert from "node:assert/strict";
import { createDecipheriv, createHash } from "node:crypto";

// Called only inside the already owned local authentication fixture, while the
// actual paired bearer is active. No validated credential rows are seeded.
export async function rehearseLocalCloudHttp({ databaseUrl, client, deviceRequest, token, organizationId, userId, fixture, encryptionSecret }) {
  const target = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(target.protocol) && target.hostname === "127.0.0.1" && target.port && /^\/axiom_auth_http_[a-f0-9]{12}$/.test(target.pathname) && !target.search && !target.hash, "isolated_cloud_http_target_required");
  const [binding] = await client.$queryRawUnsafe("SELECT current_database() AS database");
  assert.equal(binding.database, target.pathname.slice(1), "owned_cloud_database_binding_required");
  fixture.assertReady();
  assert.equal(await client.cloudAccount.count(), 0, "empty_cloud_fixture_required");
  const owner = await client.user.findUnique({ where: { id: userId } });
  assert.ok(owner?.email === "fixture-customer@example.test", "synthetic_cloud_owner_required");
  const before = fixture.report().guardedRequests;
  assert.equal((await deviceRequest("/api/desktop/cloud/accounts")).status, 401, "cloud_bearer_required");
  const start = await deviceRequest("/api/desktop/cloud/aws/enrollment", { token, body: { expectedAccountId: fixture.accountId, roleArn: fixture.roleArn, region: "us-east-1" } });
  assert.equal(start.status, 200, "actual_cloud_enrollment_start_blocked_no_entitlement_bypass");
  const attempt = (await start.json()).data;
  assert.ok(typeof attempt?.attemptId === "string" && typeof attempt.externalId === "string", "cloud_challenge_required");
  fixture.allowEnrollment(attempt.externalId);
  const completePath = `/api/desktop/cloud/aws/enrollment/${encodeURIComponent(attempt.attemptId)}/complete`;
  const complete = await deviceRequest(completePath, { token, body: { externalId: attempt.externalId } });
  assert.equal(complete.status, 200, "actual_cloud_identity_verification_blocked");
  const connected = (await complete.json()).data.account;
  assert.ok(connected?.connected === true && connected.connectionVersion === 1 && connected.enabled === false && connected.agentScanAvailable === false, "bounded_connection_summary_required");
  const account = await client.cloudAccount.findUniqueOrThrow({ where: { id: connected.id } });
  const credential = await client.cloudAccountCredential.findUniqueOrThrow({ where: { id: connected.id } });
  assert.ok(account.organizationId === organizationId && account.externalAccountId === fixture.accountId && account.enabled === false && account.credentialRef === `cloud-v2:${account.id}`, "canonical_cloud_binding_required");
  assert.ok(credential.organizationId === organizationId && credential.version === 1 && credential.revokedAt === null && credential.encryptedConfiguration.startsWith("v2."), "scoped_encrypted_credential_required");
  const bytes = Buffer.from(credential.encryptedConfiguration.slice(3), "base64url");
  function open(context) {
    const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(encryptionSecret.slice(0, 128)).digest(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28)); decipher.setAAD(Buffer.from(context));
    return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
  }
  const context = `cloud-account-credential-v1:${organizationId}:aws:${account.id}:1`;
  const stored = JSON.parse(open(context));
  assert.ok(stored.roleArn === fixture.roleArn && stored.expectedAccountId === fixture.accountId && stored.externalId === attempt.externalId && stored.region === "us-east-1", "encrypted_configuration_binding_required");
  assert.ok(!Object.keys(stored).some(key => /accessKey|secret|sessionToken/i.test(key)), "temporary_sts_credentials_must_not_be_stored");
  assert.throws(() => open(`${context}-wrong-tenant`)); assert.throws(() => open(context.replace(/:1$/, ":2")));
  const consumed = await client.cloudAccountEnrollmentAttempt.findUniqueOrThrow({ where: { id: attempt.attemptId } });
  assert.ok(consumed.consumedAt && consumed.externalIdDigest !== attempt.externalId, "single_use_hashed_challenge_required");
  const afterComplete = fixture.report().guardedRequests;
  assert.equal((await deviceRequest(completePath, { token, body: { externalId: attempt.externalId } })).status, 409, "cloud_challenge_replay_must_fail");
  assert.equal(fixture.report().guardedRequests, afterComplete, "replayed_challenge_must_not_contact_provider");
  const list = await deviceRequest("/api/desktop/cloud/accounts", { token });
  assert.equal(list.status, 200, "actual_cloud_catalog_failed");
  assert.ok((await list.json()).data.accounts.some(row => row.id === account.id && row.connected), "connected_account_missing_from_catalog");
  const inventoryPath = `/api/desktop/cloud/accounts/${encodeURIComponent(account.id)}/inventory`;
  // Synthetic foreign metadata only: no credential, validated role, or paid state.
  const foreign = await client.cloudAccount.create({ data: { organizationId: "ws_fixture_foreign_metadata", provider: "aws", externalAccountId: "999999999999", enabled: false, regions: [] } });
  try {
    const denied = await deviceRequest(`/api/desktop/cloud/accounts/${encodeURIComponent(foreign.id)}/inventory`, { token });
    assert.equal(denied.status, 404, "existing_foreign_metadata_must_be_unavailable");
    assert.equal(fixture.report().guardedRequests, afterComplete, "foreign_account_must_not_contact_provider");
  } finally {
    const removed = await client.cloudAccount.deleteMany({ where: { id: foreign.id, organizationId: "ws_fixture_foreign_metadata", credentialRef: null, enabled: false } });
    assert.equal(removed.count, 1, "owned_foreign_metadata_cleanup_required");
  }
  const inventory = await deviceRequest(inventoryPath, { token });
  assert.equal(inventory.status, 200, "actual_cloud_inventory_failed");
  const observed = (await inventory.json()).data;
  assert.ok(observed.accountId === fixture.accountId && observed.complete === false && observed.truncated === true && observed.instances.length <= 5 && observed.instances[0].instanceId === "i-fixture", "bounded_inventory_required");
  const afterInventory = fixture.report().guardedRequests;
  const disconnected = await deviceRequest(`/api/desktop/cloud/accounts/${encodeURIComponent(account.id)}/disconnect`, { token, body: { expectedVersion: 1 } });
  assert.equal(disconnected.status, 200, "actual_cloud_disconnect_failed");
  const revoked = await client.cloudAccountCredential.findUniqueOrThrow({ where: { id: account.id } });
  assert.ok(revoked.version === 2 && revoked.revokedAt && revoked.encryptedConfiguration === "", "disconnect_must_invalidate_encrypted_configuration");
  assert.equal((await deviceRequest(inventoryPath, { token })).status, 409, "disconnected_inventory_must_fail");
  assert.equal(fixture.report().guardedRequests, afterInventory, "disconnect_and_revoked_read_must_not_contact_provider");
  assert.equal(await client.tenantBillingPlan.count(), 0, "cloud_fixture_must_not_seed_paid_entitlement");
  assert.equal(await client.deploymentExecution.count(), 0, "cloud_fixture_must_not_dispatch_deployment");
  assert.equal(await client.terraformExecutionJob.count(), 0, "cloud_fixture_must_not_create_terraform_job");
  assert.deepEqual(fixture.report().requests.slice(before), ["AssumeRole", "GetCallerIdentity", "AssumeRole", "GetCallerIdentity", "DescribeInstances"]);
  return { verified: ["real_paired_cloud_challenge", "sdk_verified_identity_protocol_fixture", "canonical_encrypted_versioned_storage", "wrong_context_decryption_denied", "single_use_cloud_challenge", "existing_foreign_metadata_denied_without_provider_io", "bounded_inventory_via_actual_sdk", "disconnect_zeroes_credential_and_increments_version", "revoked_read_has_no_provider_io", "no_paid_entitlement_or_deployment_created"], provider: "owned_loopback_aws_query_fixture_not_real_aws", wire: fixture.report(), notVerified: ["aws_iam_trust_or_permissions", "real_aws_account", "production_login_or_schema", "native_ui", "stripe_checkout_or_paid_policy", "cloud_deployment_or_terraform_apply"] };
}
