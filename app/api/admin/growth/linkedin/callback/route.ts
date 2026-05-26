/**
 * GET /api/admin/growth/linkedin/callback
 *
 * LinkedIn OAuth redirect target. Verifies the state cookie nonce,
 * exchanges the code for an access token, fetches the LinkedIn member
 * URN via /v2/userinfo, and upserts a LinkedInAccountConnection row.
 *
 * On any failure → redirects to /admin/growth/linkedin?error=<reason>.
 * On success → redirects to /admin/growth/linkedin?connected=1.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { exchangeCodeForToken, fetchUserInfo, memberUrn, loadLinkedInConfig } from "@/lib/growth/linkedin/oauth";
import { writeGrowthAudit } from "@/lib/growth/audit";

export const dynamic = "force-dynamic";

const STATE_COOKIE = "vxl_li_oauth_state";

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const adminEmail = gate.user.email ?? "admin";

  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const errorParam = url.searchParams.get("error");

  if (errorParam) {
    await writeGrowthAudit({
      actor: adminEmail,
      action: "linkedin.connect_failed",
      detail: { reason: errorParam },
    });
    return redirectBack(url.origin, { error: errorParam });
  }

  const cookieState = req.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !cookieState || state !== cookieState) {
    await writeGrowthAudit({
      actor: adminEmail,
      action: "linkedin.connect_failed",
      detail: { reason: "state_mismatch" },
    });
    return redirectBack(url.origin, { error: "state_mismatch" });
  }

  const exchange = await exchangeCodeForToken(code);
  if (exchange.kind !== "ok") {
    await writeGrowthAudit({
      actor: adminEmail,
      action: "linkedin.connect_failed",
      detail: { reason: exchange.kind },
    });
    return redirectBack(url.origin, { error: exchange.kind });
  }

  const userInfo = await fetchUserInfo(exchange.token.access_token);
  if (userInfo.kind !== "ok") {
    await writeGrowthAudit({
      actor: adminEmail,
      action: "linkedin.connect_failed",
      detail: { reason: `userinfo_${userInfo.kind}` },
    });
    return redirectBack(url.origin, { error: `userinfo_${userInfo.kind}` });
  }

  const config = loadLinkedInConfig();
  const orgUrn = config.kind === "configured" && config.config.organizationId
    ? `urn:li:organization:${config.config.organizationId}`
    : null;

  const expiresAt = new Date(Date.now() + exchange.token.expires_in * 1000);

  await prisma.linkedInAccountConnection.upsert({
    where: { ownerEmail: adminEmail },
    update: {
      linkedinUrn:     memberUrn(userInfo.info.sub),
      linkedinName:    userInfo.info.name ?? null,
      organizationUrn: orgUrn,
      accessToken:     exchange.token.access_token,
      refreshToken:    exchange.token.refresh_token ?? null,
      scopes:          exchange.token.scope ?? "",
      expiresAt,
      lastError:       null,
      status:          "connected",
    },
    create: {
      ownerEmail:      adminEmail,
      linkedinUrn:     memberUrn(userInfo.info.sub),
      linkedinName:    userInfo.info.name ?? null,
      organizationUrn: orgUrn,
      accessToken:     exchange.token.access_token,
      refreshToken:    exchange.token.refresh_token ?? null,
      scopes:          exchange.token.scope ?? "",
      expiresAt,
      status:          "connected",
    },
  });

  await writeGrowthAudit({
    actor: adminEmail,
    action: "linkedin.connect_succeeded",
    targetKind: "linkedin_connection",
    detail: { name: userInfo.info.name ?? "", urn: memberUrn(userInfo.info.sub) },
  });

  const res = redirectBack(url.origin, { connected: "1" });
  res.cookies.delete(STATE_COOKIE);
  return res;
}

function redirectBack(origin: string, qs: Record<string, string>): NextResponse {
  const params = new URLSearchParams(qs);
  return NextResponse.redirect(`${origin}/admin/growth/linkedin?${params.toString()}`);
}
