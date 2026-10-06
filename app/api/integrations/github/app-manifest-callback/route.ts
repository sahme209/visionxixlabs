/**
 * GET /api/integrations/github/app-manifest-callback
 *
 * GitHub's App Manifest flow redirects here as a plain browser navigation
 * with `?code=...` — there is no state/body to verify (GitHub does not
 * support it for this flow), so this route is gated purely on the admin's
 * own session cookie. The code is single-use and keyed by itself: we
 * exchange it directly with GitHub (no auth header) for the App's full
 * credentials, encrypt the three secret fields, and upsert the one
 * platform-level `PlatformGithubAppCredential` row.
 *
 * On success: redirect to /dashboard/github-app?created=1.
 * On failure: redirect to /dashboard/github-app?error=manifest_exchange_failed
 * with no raw error detail exposed to the browser.
 */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isAdminOrOwner } from "@/lib/auth/platformAdmin";
import { trustedAxiomUrl } from "@/lib/integrations/trustedCallbackUrl";
import { record as recordAudit } from "@/lib/audit/secureAudit";
import { id as idFactory } from "@/lib/domain/ids";
import { upsertPlatformGithubAppCredential } from "@/lib/connectors/github/platformGithubAppCredential";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface GithubAppManifestConversion {
  id: number;
  slug: string;
  name: string;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  pem: string;
  html_url: string;
}

function redirectTo(path: string): Response {
  const destination = trustedAxiomUrl(path);
  return destination
    ? NextResponse.redirect(destination)
    : NextResponse.json({ ok: false, error: "trusted_return_url_unavailable" }, { status: 503 });
}

export async function GET(request: NextRequest): Promise<Response> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.userId) {
    return redirectTo("/dashboard/github-app?error=auth_required");
  }
  if (!isAdminOrOwner({ email: ctx.email, roles: ctx.roles })) {
    return redirectTo("/dashboard/github-app?error=workspace_owner_required");
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  if (!code) {
    return redirectTo("/dashboard/github-app?error=manifest_exchange_failed");
  }

  let conversion: GithubAppManifestConversion;
  try {
    const exchange = await fetch(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, {
      method: "POST",
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store",
    });
    if (!exchange.ok) {
      await recordAudit({
        organizationId: idFactory.organization(ctx.organizationId),
        actorUserId: idFactory.user(ctx.userId),
        actorKind: "user",
        action: "github_app.manifest_create_failed",
        outcome: "failure",
        entityRef: "platform:github_app",
        correlationId: idFactory.correlation(`github_app_manifest_${Date.now().toString(36)}`),
        source: "live",
        errorCode: `http_${exchange.status}`,
      }).catch(() => undefined);
      return redirectTo("/dashboard/github-app?error=manifest_exchange_failed");
    }
    conversion = (await exchange.json()) as GithubAppManifestConversion;
  } catch {
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorUserId: idFactory.user(ctx.userId),
      actorKind: "user",
      action: "github_app.manifest_create_failed",
      outcome: "failure",
      entityRef: "platform:github_app",
      correlationId: idFactory.correlation(`github_app_manifest_${Date.now().toString(36)}`),
      source: "live",
      errorCode: "network_error",
    }).catch(() => undefined);
    return redirectTo("/dashboard/github-app?error=manifest_exchange_failed");
  }

  if (!conversion?.id || !conversion.slug || !conversion.pem || !conversion.client_secret || !conversion.webhook_secret) {
    return redirectTo("/dashboard/github-app?error=manifest_exchange_failed");
  }

  try {
    const saved = await upsertPlatformGithubAppCredential({
      appId: conversion.id,
      slug: conversion.slug,
      name: conversion.name,
      clientId: conversion.client_id,
      clientSecret: conversion.client_secret,
      webhookSecret: conversion.webhook_secret,
      privateKeyPem: conversion.pem,
      htmlUrl: conversion.html_url,
      createdByUserId: ctx.userId,
    });
    await recordAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorUserId: idFactory.user(ctx.userId),
      actorKind: "user",
      action: "github_app.manifest_created",
      outcome: "success",
      entityRef: "platform:github_app",
      correlationId: idFactory.correlation(`github_app_manifest_${Date.now().toString(36)}`),
      source: "live",
      detail: { appId: saved.appId, slug: saved.slug, name: saved.name },
    }).catch(() => undefined);
  } catch {
    return redirectTo("/dashboard/github-app?error=manifest_exchange_failed");
  }

  return redirectTo("/dashboard/github-app?created=1");
}
