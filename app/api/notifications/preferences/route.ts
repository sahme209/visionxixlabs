/**
 * GET / PUT /api/notifications/preferences
 *
 * Reads + writes the signed-in user's notification preferences,
 * stored on Lead.fullPayload.notifications. Per-tenant so multiple
 * users in the same workspace see the same webhook target.
 *
 * Schema:
 *   {
 *     slackWebhookUrl?: string,   // https://hooks.slack.com/services/T.../B.../...
 *     teamsWebhookUrl?: string,   // https://...office.com/webhook/...
 *     emailDigestTo?:   string,   // recipient address; one email per scan completion
 *     severityFloor:    "info" | "low" | "medium" | "high" | "critical"
 *                                 // suppress sends below this severity
 *   }
 *
 * GET returns the current prefs (or sensible defaults).
 * PUT replaces them in a single transactional update on the Lead.
 * Both auth-gated via currentContext.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Severity = "info" | "low" | "medium" | "high" | "critical";

interface Preferences {
  slackWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
  emailDigestTo: string | null;
  severityFloor: Severity;
}

const DEFAULT: Preferences = {
  slackWebhookUrl: null,
  teamsWebhookUrl: null,
  emailDigestTo: null,
  severityFloor: "low",
};

async function loadLead(email: string) {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true },
  });
  return prisma.lead.findFirst({
    where: {
      source: "cloud-operator",
      OR: [
        ...(user?.id ? [{ userId: user.id }] : []),
        { email: email.toLowerCase() },
      ],
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, fullPayload: true },
  });
}

function clampSeverity(input: unknown): Severity {
  if (input === "info" || input === "low" || input === "medium" || input === "high" || input === "critical") return input;
  return "low";
}

function safeHttpsUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;
  try {
    const u = new URL(trimmed);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function safeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (trimmed.length === 0) return null;
  // Simple RFC-5322-ish check; the email service does the real validation.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

export async function GET() {
  const ctx = await requireContext();
  const lead = await loadLead(ctx.email!);
  const payload = (lead?.fullPayload as Record<string, unknown>) ?? {};
  const stored = (payload.notifications as Partial<Preferences> | undefined) ?? {};
  const prefs: Preferences = {
    slackWebhookUrl: safeHttpsUrl(stored.slackWebhookUrl) ?? DEFAULT.slackWebhookUrl,
    teamsWebhookUrl: safeHttpsUrl(stored.teamsWebhookUrl) ?? DEFAULT.teamsWebhookUrl,
    emailDigestTo:   safeEmail(stored.emailDigestTo) ?? DEFAULT.emailDigestTo,
    severityFloor:   clampSeverity(stored.severityFloor),
  };
  return NextResponse.json({ ok: true, preferences: prefs });
}

export async function PUT(req: NextRequest) {
  const ctx = await requireContext();
  const lead = await loadLead(ctx.email!);
  if (!lead) {
    return NextResponse.json({
      ok: false,
      error: "no_lead",
      hint: "Connect a cloud first — preferences attach to your tenant's lead row.",
    }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const next: Preferences = {
    slackWebhookUrl: safeHttpsUrl(body.slackWebhookUrl),
    teamsWebhookUrl: safeHttpsUrl(body.teamsWebhookUrl),
    emailDigestTo:   safeEmail(body.emailDigestTo),
    severityFloor:   clampSeverity(body.severityFloor),
  };

  const payload = (lead.fullPayload as Record<string, unknown>) ?? {};
  await prisma.lead.update({
    where: { id: lead.id },
    data: {
      fullPayload: {
        ...payload,
        notifications: next,
      } as object,
    },
  });

  return NextResponse.json({ ok: true, preferences: next });
}
