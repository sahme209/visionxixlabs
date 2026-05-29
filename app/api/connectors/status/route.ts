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
  if (!ctx.isAuthenticated || !ctx.organizationId) {
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
    const view: ConnectorView[] = sessions.map((s) => {
      const status = clampCloudStatus(s.provider, s.status);
      const entry: ConnectorView = { provider: s.provider, status };
      if (s.lastTransitionAt) entry.lastScan = s.lastTransitionAt.toISOString();
      return entry;
    });
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
