/**
 * GET /api/admin/diag/connect-flow
 *
 * Self-diagnostic for the cloud-connect architecture. Hit this URL
 * while signed in to verify each piece of state the connect flow
 * depends on. No mutations, no AWS calls — just reads.
 *
 * Use:
 *   1. Sign up as a brand new user.
 *   2. Visit /api/admin/diag/connect-flow → see your derived org id +
 *      the lead-state and session-state for that org. Both should be
 *      empty (no Lead, no ConnectorSetupSession).
 *   3. Walk through /dashboard/connect-cloud and pick AWS.
 *   4. Re-hit the diag → leads array now shows one cloud-operator
 *      Lead with your real email and userId. sessions array is still
 *      empty because no provider is linked yet.
 *   5. Complete CFN in AWS.
 *   6. Re-hit the diag → the Lead's connectors.aws.status should be
 *      "linked" AND the sessions array should contain
 *      {provider:"aws", status:"connected"}. If only one is true, the
 *      bridge is broken — fix that, not the UI.
 *
 * Output shape is human-readable JSON, optimized for "open the URL
 * in a browser, read the result, fix the broken piece."
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentContext } from "@/lib/auth/currentContext";
import { deriveWorkspaceIdFromEmail } from "@/lib/auth/workspaceId";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type DiagReport = {
  signedIn: boolean;
  email?: string;
  userId?: string;
  organizationId?: string;
  expectedOrganizationId?: string;
  organizationIdConsistent?: boolean;
  user?: { id: string; email: string; createdAt: string } | null;
  leads: Array<{
    id: string;
    email: string;
    userId: string | null;
    source: string;
    status: string;
    createdAt: string;
    matchedBy: ("userId" | "email")[];
    connectors: Array<{
      provider: string;
      status: string;
      linkedAt?: string;
      verifiedAccountId?: string;
      source?: string;
    }>;
  }>;
  sessions: Array<{
    provider: string;
    status: string;
    lastEventKind: string | null;
    lastErrorCode: string | null;
    firstConnectedAt: string | null;
    lastTransitionAt: string | null;
  }>;
  migrationPending: boolean;
  bridgeStatus: "ok" | "lead_has_no_session" | "session_has_no_lead" | "both_empty" | "indeterminate";
  recommendedFix?: string;
};

export async function GET() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.email || !ctx.organizationId) {
    const out: DiagReport = {
      signedIn: false,
      leads: [],
      sessions: [],
      migrationPending: false,
      bridgeStatus: "indeterminate",
      recommendedFix: "Sign in first — this endpoint is session-gated.",
    };
    return NextResponse.json(out, { status: 200 });
  }

  const expectedOrgId = deriveWorkspaceIdFromEmail(ctx.email);
  const out: DiagReport = {
    signedIn: true,
    email: ctx.email,
    userId: ctx.userId,
    organizationId: ctx.organizationId,
    expectedOrganizationId: expectedOrgId,
    organizationIdConsistent: ctx.organizationId === expectedOrgId,
    user: null,
    leads: [],
    sessions: [],
    migrationPending: false,
    bridgeStatus: "indeterminate",
  };

  // Resolve User row (the source of truth for userId in bridges).
  try {
    const user = await prisma.user.findUnique({
      where: { email: ctx.email.toLowerCase() },
      select: { id: true, email: true, createdAt: true },
    });
    out.user = user
      ? { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() }
      : null;
  } catch (e) {
    console.error("[diag/connect-flow] user lookup failed:", e);
  }

  // Mirror the exact query the status endpoint uses for backfill —
  // (userId OR email) on source=cloud-operator. If this finds the
  // Lead but the session below is empty, the bridge is what's broken.
  try {
    const leads = await prisma.lead.findMany({
      where: {
        source: "cloud-operator",
        OR: [
          ...(out.user?.id ? [{ userId: out.user.id }] : []),
          { email: ctx.email.toLowerCase() },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: {
        id: true,
        email: true,
        userId: true,
        source: true,
        status: true,
        createdAt: true,
        fullPayload: true,
      },
    });
    for (const lead of leads) {
      const matchedBy: ("userId" | "email")[] = [];
      if (out.user?.id && lead.userId === out.user.id) matchedBy.push("userId");
      if (lead.email?.toLowerCase() === ctx.email.toLowerCase()) matchedBy.push("email");

      const payload = (lead.fullPayload as Record<string, unknown>) || {};
      const connectors = (payload.connectors as Record<string, unknown>) || {};
      const connectorList: DiagReport["leads"][number]["connectors"] = [];
      for (const [provider, raw] of Object.entries(connectors)) {
        const meta = raw as Record<string, unknown>;
        connectorList.push({
          provider,
          status: String(meta.status ?? "unknown"),
          linkedAt: meta.linkedAt ? String(meta.linkedAt) : undefined,
          verifiedAccountId: meta.verifiedAccountId ? String(meta.verifiedAccountId) : undefined,
          source: meta.source ? String(meta.source) : undefined,
        });
      }

      out.leads.push({
        id: lead.id,
        email: lead.email,
        userId: lead.userId,
        source: lead.source,
        status: lead.status,
        createdAt: lead.createdAt.toISOString(),
        matchedBy,
        connectors: connectorList,
      });
    }
  } catch (e) {
    console.error("[diag/connect-flow] leads lookup failed:", e);
  }

  // Mirror the exact query the status endpoint uses in session mode.
  try {
    const sessions = await prisma.connectorSetupSession.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        provider: true,
        status: true,
        lastEventKind: true,
        lastErrorCode: true,
        firstConnectedAt: true,
        lastTransitionAt: true,
      },
    });
    out.sessions = sessions.map((s) => ({
      provider: s.provider,
      status: s.status,
      lastEventKind: s.lastEventKind,
      lastErrorCode: s.lastErrorCode,
      firstConnectedAt: s.firstConnectedAt?.toISOString() ?? null,
      lastTransitionAt: s.lastTransitionAt?.toISOString() ?? null,
    }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      out.migrationPending = true;
    } else {
      console.error("[diag/connect-flow] sessions lookup failed:", e);
    }
  }

  // Diagnose the bridge.
  const linkedOnLead = out.leads.some((l) =>
    l.connectors.some((c) => c.status === "linked" || c.status === "connected"),
  );
  const connectedSession = out.sessions.some((s) => s.status === "connected");

  if (out.migrationPending) {
    out.bridgeStatus = "indeterminate";
    out.recommendedFix = "ConnectorSetupSession table not migrated. Run: DATABASE_URL=… npx prisma migrate deploy.";
  } else if (!linkedOnLead && !connectedSession) {
    out.bridgeStatus = "both_empty";
    out.recommendedFix = out.leads.length === 0
      ? "No cloud-operator Lead found for this user. Start the connect flow at /dashboard/connect-cloud."
      : "Lead exists but no connector linked yet. Complete CFN Quick-Create in AWS.";
  } else if (linkedOnLead && !connectedSession) {
    out.bridgeStatus = "lead_has_no_session";
    out.recommendedFix = "The bridge that mirrors Lead → ConnectorSetupSession didn't run. Check Vercel logs for [connectors/link] or [cfn-callback] bridge warnings.";
  } else if (!linkedOnLead && connectedSession) {
    out.bridgeStatus = "session_has_no_lead";
    out.recommendedFix = "Session row exists but no Lead reflects it. Probably a stale connect or manual seed. Visit /dashboard — it should still show 'Connected' since the dashboard reads from sessions.";
  } else {
    out.bridgeStatus = "ok";
    out.recommendedFix = "Everything's wired correctly. The dashboard should show 'Connected accounts'.";
  }

  return NextResponse.json(out, { status: 200 });
}
