/**
 * POST /api/connectors/audit
 * Logs onboarding flow events: provider selection, connection attempts, scan starts.
 * Lightweight audit trail for events not captured by the plugin execution engine.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";

const VALID_EVENTS = [
  "onboarding_started",
  "provider_selected",
  "connection_attempted",
  "connection_succeeded",
  "connection_failed",
  "scan_started",
  "scan_completed",
  "scan_failed",
  "report_viewed",
  "dashboard_opened",
] as const;

type AuditEvent = (typeof VALID_EVENTS)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, event, provider, metadata } = body as {
      token?: string;
      event?: string;
      provider?: string;
      metadata?: Record<string, unknown>;
    };

    if (!event || !VALID_EVENTS.includes(event as AuditEvent)) {
      return NextResponse.json(
        { error: `Invalid event. Must be one of: ${VALID_EVENTS.join(", ")}` },
        { status: 400 }
      );
    }

    let leadId: string | null = null;
    let userId: string | null = null;

    if (token) {
      const result = verifyStarterToken(token);
      if (!("error" in result)) {
        leadId = result.leadId;
        const lead = await prisma.lead.findUnique({
          where: { id: result.leadId },
          select: { userId: true },
        });
        userId = lead?.userId ?? null;
      }
    }

    await prisma.executionLog.create({
      data: {
        userId: userId ?? "anonymous",
        action: `onboarding:${event}`,
        pluginId: provider ? `onboarding:${provider}` : "onboarding:flow",
        status: "success",
        dryRun: true,
        leadId,
        params: {
          event,
          provider: provider ?? null,
          ...(metadata ?? {}),
          userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
          ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
          timestamp: new Date().toISOString(),
        },
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[connectors/audit]", e);
    return NextResponse.json({ error: "Failed to log event" }, { status: 500 });
  }
}
