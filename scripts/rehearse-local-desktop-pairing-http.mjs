import assert from "node:assert/strict";

/** Local HTTP protocol acceptance only: never a native/browser/provider claim.
 * webRequest is the parent harness's loopback-only authenticated cookie jar.
 * Device requests deliberately have no cookie jar and retain bearer only in memory.
 */
export async function rehearseLocalDesktopPairingHttp({ appOrigin, webRequest, challenge, deviceFingerprint, expectedWorkspace, email, onPaired = /** @type {Function | undefined} */ (undefined) }) {
  const origin = new URL(appOrigin);
  assert.ok(origin.protocol === "http:" && origin.hostname === "127.0.0.1" && origin.port && origin.pathname === "/" && !origin.username && !origin.password && !origin.search && !origin.hash, "pairing_loopback_origin_required");
  assert.ok(/^pair_[A-Za-z0-9_-]{43}$/.test(challenge), "synthetic_pairing_challenge_required");
  assert.ok(typeof deviceFingerprint === "string" && deviceFingerprint.length >= 16, "pairing_device_binding_required");
  assert.ok(/^ws_[a-f0-9]{16}$/.test(expectedWorkspace) && email === "fixture-customer@example.test", "synthetic_pairing_identity_required");
  assert.equal(typeof webRequest, "function", "bounded_web_request_required");
  const deadline = Date.now() + 120_000;
  async function deviceRequest(path, { body, token } = {}) {
    assert.ok(Date.now() < deadline, "pairing_http_deadline");
    return fetch(new URL(path, origin), { method: body ? "POST" : "GET", redirect: "manual", credentials: "omit",
      headers: { ...(body ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(Math.min(45_000, deadline - Date.now())) });
  }
  const poll = (body) => deviceRequest("/api/desktop/pair/status", { body });
  assert.equal((await poll({ challenge, deviceFingerprint })).status, 202, "unapproved_pairing_must_remain_pending");
  assert.equal((await poll({ challenge, deviceFingerprint: `${deviceFingerprint}-wrong` })).status, 403, "wrong_device_pairing_must_fail");
  assert.equal((await poll({ challenge })).status, 426, "unbound_pairing_must_require_update");
  const consent = await webRequest(`/api/desktop/pair/approve?challenge=${encodeURIComponent(challenge)}`);
  assert.equal(consent.status, 200, "authenticated_consent_metadata_required");
  const metadata = await consent.json();
  assert.equal(metadata.workspace?.email, email, "consent_identity_mismatch");
  assert.equal(metadata.request?.status, "pending", "consent_pending_challenge_required");
  const approve = await webRequest("/api/desktop/pair/approve", { method: "POST", headers: { "content-type": "application/json", origin: origin.origin }, body: JSON.stringify({ challenge }) });
  assert.equal(approve.status, 200, "authenticated_pairing_approval_failed");
  assert.equal((await approve.json()).status, "approved", "pairing_approval_not_confirmed");
  const consumed = await poll({ challenge, deviceFingerprint });
  assert.equal(consumed.status, 200, "approved_pairing_consume_failed");
  const paired = await consumed.json();
  assert.equal(paired.status, "approved", "approved_pairing_status_required");
  assert.ok(typeof paired.token === "string" && paired.token.startsWith("axm.desk.") && paired.session?.id && paired.session.status === "active", "active_pairing_bearer_required");
  assert.equal((await poll({ challenge, deviceFingerprint })).status, 409, "pairing_replay_must_fail");
  const accessResponse = await deviceRequest("/api/desktop/access", { token: paired.token });
  assert.equal(accessResponse.status, 200, "paired_identity_introspection_failed");
  const access = (await accessResponse.json()).data;
  assert.equal(access?.identity?.kind, "desktop_session", "paired_identity_kind_required");
  assert.equal(access.identity.organizationId, expectedWorkspace, "paired_workspace_mismatch");
  assert.equal(access.identity.email, email, "paired_email_mismatch");
  assert.equal(access.identity.role, "owner", "paired_current_membership_required");
  assert.ok(typeof access.access?.allowed === "boolean" && typeof access.access?.code === "string", "commercial_observation_required");
  const sessionsResponse = await webRequest("/api/desktop/session");
  assert.equal(sessionsResponse.status, 200, "owner_pairing_list_failed");
  const sessions = (await sessionsResponse.json()).data?.sessions;
  assert.ok(Array.isArray(sessions) && sessions.some((session) => session.id === paired.session.id && session.status === "active"), "owner_pairing_listing_missing");
  const cloudLifecycle = onPaired ? await onPaired({ token: paired.token, sessionId: paired.session.id, deviceRequest }) : undefined;
  const revoke = await webRequest(`/api/desktop/session?id=${encodeURIComponent(paired.session.id)}`, { method: "DELETE", headers: { origin: origin.origin } });
  assert.equal(revoke.status, 200, "owner_pairing_revocation_failed");
  assert.equal((await deviceRequest("/api/desktop/access", { token: paired.token })).status, 401, "revoked_pairing_must_fail");
  return { ...(cloudLifecycle ? { cloudLifecycle } : {}), verified: ["authenticated_consent_metadata", "device_bound_pending_poll", "wrong_device_denied", "legacy_unbound_poll_denied", "web_session_pairing_approval", "cookie_free_pairing_consume", "single_use_pairing_replay_denied", "paired_identity_current_workspace_membership", "owner_pairing_listing", "owner_revocation_invalidates_bearer"],
    commercialAccessObservation: { allowed: access.access.allowed, code: access.access.code, billingStatus: access.access.billingStatus, enforcement: "not_verified_policy_decision_required" },
    notVerified: ["native_browser_or_vault", "production_pairing", "billing_enforcement", "cloud_or_deployment_authority", "provider_execution"] };
}
