import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server.js";

/** Literal loopback transport, framework-canonical local HTTP metadata only. */
export function localApprovalRequestMetadata(appOrigin) {
  const origin = new URL(appOrigin);
  assert.ok(origin.protocol === "http:" && origin.hostname === "127.0.0.1" && origin.port && origin.pathname === "/" && !origin.search && !origin.hash && !origin.username && !origin.password,
    "isolated_approval_http_origin_required");
  // NextRequest normalizes loopback IP origins to localhost. Model the server's
  // own origin expectation without changing its same-origin security policy.
  const canonical = new NextRequest(new URL("/api/approvals/decide", origin)).nextUrl.origin;
  return { origin: canonical, referer: `${canonical}/dashboard/approvals` };
}

/**
 * Parent-only continuation of the disposable authentication HTTP fixture.
 * The parent owns target creation, empty-schema validation, current-schema
 * installation, real signup/proof/login, authenticated request jar and cleanup.
 * No standalone runner, execution dispatch, provider or billing operation.
 */
export async function rehearseLocalApprovalHttp({ databaseUrl, client, request, appOrigin, userId, organizationId }) {
  const database = new URL(databaseUrl);
  assert.ok(["postgres:", "postgresql:"].includes(database.protocol) && database.hostname === "127.0.0.1" && database.port &&
    /^\/axiom_auth_http_[a-f0-9]{12}$/.test(database.pathname) && !database.search && !database.hash, "isolated_approval_http_target_required");
  const metadata = localApprovalRequestMetadata(appOrigin);
  assert.equal(typeof request, "function", "parent_authenticated_request_required");
  const [binding] = await client.$queryRawUnsafe("SELECT current_database() AS database");
  assert.equal(binding.database, database.pathname.slice(1), "parent_database_binding_mismatch");
  assert.equal(await client.user.count(), 1, "single_synthetic_identity_required");
  const user = await client.user.findUnique({ where: { id: userId } });
  assert.equal(user?.email, "fixture-customer@example.test", "synthetic_identity_required");
  assert.ok(user.emailVerifiedAt, "parent_verified_identity_required");
  assert.equal(organizationId, `ws_${createHash("sha256").update(user.email).digest("hex").slice(0, 16)}`, "synthetic_workspace_required");
  const membership = await client.orgMembership.findFirst({ where: { userId, organizationId } });
  assert.equal(membership?.role, "owner", "parent_owner_membership_required");
  assert.ok(membership.acceptedAt, "parent_accepted_membership_required");
  assert.equal(await client.axiomApprovalItem.count(), 0, "empty_synthetic_approval_fixture_required_never_reset");
  const item = await client.axiomApprovalItem.create({ data: {
    organizationId, runId: "synthetic-http-approval-run", planItemId: "synthetic-http-approval-plan-item",
    title: "Synthetic approval concurrency fixture — never execute", actionType: "resize_compute", provider: "aws", region: "us-east-1",
    resourceIds: [], currentState: "synthetic current", recommendedState: "synthetic proposed", riskLevel: "low", disposition: "approval_required",
    dispositionReason: "Local HTTP decision-only regression; no provider target", rollbackAvailable: false,
  } });
  assert.equal(item.status, "pending", "pending_fixture_default_required");
  async function decide(action, suppliedOrigin = metadata.origin) {
    return request("/api/approvals/decide", {
      method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: suppliedOrigin, referer: metadata.referer },
      body: new URLSearchParams({ itemId: item.id, action }).toString(),
    });
  }
  // Refusal must not consume the only seeded approval.
  assert.equal((await decide("approve", "https://foreign.example.test")).status, 403, "cross_origin_decision_must_fail");
  assert.equal((await client.axiomApprovalItem.findUniqueOrThrow({ where: { id: item.id } })).status, "pending");
  const responses = await Promise.all([decide("approve"), decide("reject")]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [303, 409], "exactly_one_http_decision_must_win");
  const winner = responses[0].status === 303 ? "approved" : "rejected";
  const committed = await client.axiomApprovalItem.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(committed.status, winner, "http_winner_must_match_persisted_decision");
  assert.equal(committed.decidedBy, userId, "decision_actor_must_be_authenticated_identity");
  assert.ok(committed.decidedAt instanceof Date && Number.isFinite(committed.decidedAt.getTime()), "decision_timestamp_required");
  assert.equal(committed.snoozedUntil, null);
  assert.equal((await decide(winner === "approved" ? "reject" : "approve")).status, 409, "terminal_decision_must_not_be_overwritten");
  const retained = await client.axiomApprovalItem.findUniqueOrThrow({ where: { id: item.id } });
  assert.equal(retained.status, committed.status);
  assert.equal(retained.decidedAt.getTime(), committed.decidedAt.getTime());
  assert.equal(await client.axiomApprovalItem.count(), 1, "exactly_one_synthetic_approval_retained");
  return { transport: "real_local_next_http", requestMetadata: "next_request_normalized_loopback_headers_not_browser", persistence: "real_disposable_postgresql", verified: ["cross_origin_decision_denied", "parallel_decisions_one303_one409", "persisted_authenticated_actor_and_time", "terminal_decision_retained"],
    notVerified: ["provider_execution", "saved_terraform_plan_authority", "production_approval_or_login", "deterministic_simultaneous_database_snapshots"] };
}
