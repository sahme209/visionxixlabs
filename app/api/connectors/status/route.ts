/**
 * GET /api/connectors/status
 *
 * Returns the current user's connector status, used by the /dashboard
 * "Connect AWS" / "Connected accounts" panel. Two modes:
 *
 *   - Token mode (?token=…): legacy Lead-based read for the pre-login
 *     /operator/onboarding flow. Returns Lead.fullPayload.connectors.
 *
 *   - Session mode (no token): reads ConnectorSetupSession by org —
 *     the authoritative state for an authenticated user. This is what
 *     the dashboard hits.
 *
 * Both modes return the same array shape so the dashboard renders
 * identically regardless of how it was reached:
 *
 *   { ok: true, connectors: [{ provider, status, accountId?, lastScan? }, …] }
 *
 * Returns an empty array (not 401) when the user is signed out — the
 * dashboard renders an "empty state" CTA, not a sign-in modal.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { isCloudConnectorEnabled } from "@/lib/featureFlags";
import { currentContext } from "@/lib/auth/currentContext";

export const dynamic = "force-dynamic";

type ConnectorView = {
  provider: string;
  status: string;
  accountId?: string;
  lastScan?: string;
  /** Verified role ARN — present when the cfn-callback or link route
   *  has run AssumeRole + GetCallerIdentity. Lets the connect page
   *  poll for completion without re-running validate-role. */
  arn?: string;
};

function clampCloudStatus(provider: string, status: string): string {
  if (provider === "aws" || provider === "azure" || provider === "gcp") {
    if (!isCloudConnectorEnabled(provider as "aws" | "azure" | "gcp")) {
      return "unavailable";
    }
  }
  return status;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  // ─── Token mode (legacy / pre-login operator flow) ────────────────────
  if (token) {
    const result = verifyStarterToken(token);
    if ("error" in result) {
      return NextResponse.json(
        { ok: false, error: result.error === "expired" ? "Token expired" : "Invalid token" },
        { status: 401 }
      );
    }
    try {
      const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
      if (!lead) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

      const payload = (lead.fullPayload as Record<string, unknown>) || {};
      const connectors = (payload.connectors as Record<string, unknown>) || {};
      const view: ConnectorView[] = [];
      for (const [provider, raw] of Object.entries(connectors)) {
        const meta = raw as Record<string, unknown>;
        const status = clampCloudStatus(provider, (meta.status as string) || "pending");
        const entry: ConnectorView = { provider, status };
        if (meta.verifiedAccountId) entry.accountId = String(meta.verifiedAccountId);
        if (meta.verifiedCallerArn) entry.arn = String(meta.verifiedCallerArn);
        view.push(entry);
      }
      return NextResponse.json({ ok: true, connectors: view });
    } catch (e) {
      console.error("[connectors status] token mode", e);
      return NextResponse.json({ ok: false, error: "Failed to fetch status" }, { status: 500 });
    }
  }

  // ─── Session mode (authenticated dashboard) ───────────────────────────
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.email) {
    // Empty array, not 401 — the dashboard treats this as "nothing
    // connected yet" and renders its empty-state CTA. A 401 here would
    // cause the dashboard's loading spinner to never resolve.
    return NextResponse.json({ ok: true, connectors: [] });
  }
  try {
    const sessions = await prisma.connectorSetupSession.findMany({
      where: { organizationId: ctx.organizationId },
      select: {
        provider: true,
        status: true,
        firstConnectedAt: true,
        lastTransitionAt: true,
      },
    });
    let view: ConnectorView[] = sessions.map((s) => {
      const status = clampCloudStatus(s.provider, s.status);
      const entry: ConnectorView = { provider: s.provider, status };
      if (s.lastTransitionAt) entry.lastScan = s.lastTransitionAt.toISOString();
      return entry;
    });

    // Backfill from Lead.fullPayload.connectors for users who linked
    // BEFORE the bridge fix shipped (commit c655c56). Without this,
    // anyone who completed /operator/onboarding earlier would still
    // see "Connect a cloud" forever — their connector lives on the
    // Lead but never propagated to ConnectorSetupSession. The
    // backfill is lazy: on first read after the fix, the missing
    // session row is created so subsequent reads are fast.
    const seenProviders = new Set(view.map((c) => c.provider));
    const missing: ConnectorView[] = [];
    try {
      const lead = await prisma.lead.findFirst({
        where: {
          email: ctx.email.toLowerCase(),
          source: "cloud-operator",
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, fullPayload: true },
      });
      if (lead) {
        const payload = (lead.fullPayload as Record<string, unknown>) || {};
        const connectors = (payload.connectors as Record<string, unknown>) || {};
        for (const [provider, raw] of Object.entries(connectors)) {
          if (seenProviders.has(provider)) continue;
          const meta = raw as Record<string, unknown>;
          const status = clampCloudStatus(provider, (meta.status as string) || "pending");
          if (status !== "linked" && status !== "connected") continue;
          const entry: ConnectorView = { provider, status: "connected" };
          if (meta.verifiedAccountId) entry.accountId = String(meta.verifiedAccountId);
          missing.push(entry);
          // Lazy upsert so the next read hits the session row.
          try {
            await prisma.connectorSetupSession.upsert({
              where: {
                organizationId_provider: { organizationId: ctx.organizationId, provider },
              },
              update: {
                status: "connected",
                lastEventKind: "backfill_from_lead",
                lastErrorCode: null,
                firstConnectedAt: new Date(),
                lastTransitionAt: new Date(),
              },
              create: {
                organizationId: ctx.organizationId,
                provider,
                status: "connected",
                lastEventKind: "backfill_from_lead",
                firstConnectedAt: new Date(),
                lastTransitionAt: new Date(),
              },
            });
          } catch (upsertErr) {
            console.warn("[connectors status] backfill upsert failed:",
              upsertErr instanceof Error ? upsertErr.message : upsertErr);
          }
        }
      }
    } catch (backfillErr) {
      console.warn("[connectors status] lead backfill lookup failed:",
        backfillErr instanceof Error ? backfillErr.message : backfillErr);
    }
    if (missing.length > 0) view = [...view, ...missing];

    return NextResponse.json({ ok: true, connectors: view });
  } catch (e) {
    // Table not migrated yet → return empty list, not 500. The
    // dashboard then renders the empty-state CTA, which is the right
    // UX during the brief window between deploy and migration.
    const msg = e instanceof Error ? e.message : String(e);
    if (/relation .* does not exist|table .* does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, connectors: [], migrationPending: true });
    }
    console.error("[connectors status] session mode", e);
    return NextResponse.json({ ok: false, error: "Failed to fetch status" }, { status: 500 });
  }
}
