/**
 * GET /api/dashboard/github-app/manifest
 *
 * Admin-gated. Returns the GitHub App Manifest JSON the dashboard's
 * "Create GitHub App" button submits (as a real HTML form POST — not
 * fetch) to https://github.com/settings/apps/new. This is the one-time
 * platform-operator setup step; it never touches a tenant's workspace
 * data, mutates nothing, and returns no secret — just a manifest the
 * browser then hands to GitHub itself.
 *
 * Deliberately NOT same-origin-checked: isSameOriginRequest's check
 * (lib/auth/requestOrigin.ts) compares the inbound `Origin` header
 * against the request's own host, which is the right defense for a
 * state-changing mutation reachable via a plain form POST — but
 * browsers routinely omit the `Origin` header on same-origin GET
 * requests, so applying that check here made this route fail for
 * essentially every legitimate caller. Session auth + the admin/owner
 * check below are the real gate for a read-only GET like this one.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { trustedAxiomUrl } from "@/lib/integrations/trustedCallbackUrl";
import { buildGithubAppManifest } from "@/lib/connectors/github/githubAppManifest";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_request: NextRequest): Promise<Response> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated) {
    return NextResponse.json({ ok: false, error: "auth_required" }, { status: 401 });
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return NextResponse.json({ ok: false, error: "workspace_owner_required" }, { status: 403 });
  }

  // Derive the trusted origin from Axiom's own configured app URL, never
  // from an inbound Host header.
  const trustedRoot = trustedAxiomUrl("/");
  if (!trustedRoot) {
    return NextResponse.json({ ok: false, error: "trusted_origin_unavailable" }, { status: 503 });
  }
  const origin = new URL(trustedRoot).origin;
  const manifest = buildGithubAppManifest({ origin });
  return NextResponse.json({ ok: true, data: { manifest, createUrl: "https://github.com/settings/apps/new" } });
}
