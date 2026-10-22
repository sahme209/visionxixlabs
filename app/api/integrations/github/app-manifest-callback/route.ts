/** Platform-only GitHub App registration callback. A short-lived stored challenge
 * binds the return to its initiating operator, workspace and configured callback.
 * Claiming it once precedes any exchange; successful credential writes require a
 * confirmed durable audit receipt before a success response is returned. */

import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { isPlatformAdmin } from "@/lib/auth/platformAdmin";
import { trustedAxiomUrl } from "@/lib/integrations/trustedCallbackUrl";
import { record as recordFailureAudit } from "@/lib/audit/secureAudit";
import { recordRequiredAudit } from "@/lib/audit/requiredAudit";
import { prisma } from "@/lib/db";
import { consumeTenantIntegrationAuthorization, type TenantConnectionRepo } from "@/lib/integrations/tenantConnectionRepo";
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
  if (!isPlatformAdmin(ctx.email)) {
    return NextResponse.json({ ok: false, error: "platform_admin_required" }, { status: 403 });
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim();
  if (!code) {
    return redirectTo("/dashboard/github-app?error=manifest_exchange_failed");
  }

  const state = url.searchParams.get("state")?.trim();
  const redirectUri = trustedAxiomUrl("/api/integrations/github/app-manifest-callback");
  if (!state || !redirectUri) return NextResponse.json({ok:false,error:"invalid_setup_authorization"},{status:400});
  try {
    const claim = await consumeTenantIntegrationAuthorization(prisma as unknown as TenantConnectionRepo, {state,provider:"github",expected:{organizationId:ctx.organizationId,initiatedByUserId:ctx.userId,redirectUri}});
    if (!claim.ok) return NextResponse.json({ok:false,error:"invalid_setup_authorization"},{status:400});
  } catch {return NextResponse.json({ok:false,error:"setup_authorization_unavailable"},{status:503});}

  let conversion: GithubAppManifestConversion;
  try {
    const exchange = await fetch(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, {
      method: "POST",
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      cache: "no-store",
    });
    if (!exchange.ok) {
      await recordFailureAudit({
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
    await recordFailureAudit({
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

  let saved: Awaited<ReturnType<typeof upsertPlatformGithubAppCredential>>;
  try {
    saved = await upsertPlatformGithubAppCredential({
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
  } catch {
    return NextResponse.json({ok:false,error:"github_app_save_unconfirmed",message:"App credentials may have been saved. Review platform configuration before starting another registration."},{status:503});
  }
  try {
    await recordRequiredAudit({
      organizationId: idFactory.organization(ctx.organizationId),
      actorUserId: idFactory.user(ctx.userId),
      actorKind: "user",
      action: "github_app.manifest_created",
      outcome: "success",
      entityRef: "platform:github_app",
      correlationId: idFactory.correlation(`github_app_manifest_${Date.now().toString(36)}`),
      source: "live",
      detail: { appId: saved.appId, slug: saved.slug, name: saved.name },
    });
  } catch {
    return NextResponse.json({ok:false,error:"github_app_audit_unconfirmed",message:"App credentials were saved, but the audit receipt was not confirmed. Review configuration and audit storage before any retry."},{status:503});
  }

  return redirectTo("/dashboard/github-app?created=1");
}
