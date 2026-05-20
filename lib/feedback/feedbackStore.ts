/**
 * Feedback capture store.
 *
 * Persists rows to FeedbackRecord + mirrors to the outbound lane so
 * the team Slack gets a ping with the verbatim message. Best-effort
 * — DB or Slack failure must NEVER crash the dashboard request.
 *
 * Hard rules:
 *   - sentiment validated against the closed union.
 *   - message length capped at 2000 chars (defense-in-depth; UI
 *     already limits).
 *   - DB write + Slack ping run in parallel; failures are swallowed.
 */

import "server-only";

import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { sendOutboundNotification } from "@/lib/notifications/outboundNotificationLane";

export type FeedbackSentiment = "happy" | "neutral" | "frustrated";

const SENTIMENTS: FeedbackSentiment[] = ["happy", "neutral", "frustrated"];
export function isFeedbackSentiment(v: string): v is FeedbackSentiment {
  return (SENTIMENTS as string[]).includes(v);
}

export interface FeedbackInput {
  organizationId?: string;
  email?: string;
  sentiment: FeedbackSentiment;
  pagePath?: string;
  message: string;
  userAgent?: string;
}

export async function captureFeedback(input: FeedbackInput): Promise<{ ok: boolean; id?: string; reason?: string }> {
  if (!input.message || input.message.trim().length === 0) {
    return { ok: false, reason: "Message required." };
  }
  if (!isFeedbackSentiment(input.sentiment)) {
    return { ok: false, reason: "Invalid sentiment." };
  }

  const id = randomUUID();
  const trimmedMessage = input.message.slice(0, 2000);

  // DB write — best-effort.
  try {
    await prisma.feedbackRecord.create({
      data: {
        id,
        organizationId: input.organizationId ?? null,
        email: input.email?.slice(0, 320) ?? null,
        sentiment: input.sentiment,
        pagePath: input.pagePath?.slice(0, 200) ?? null,
        message: trimmedMessage,
        userAgent: input.userAgent?.slice(0, 500) ?? null,
      },
    });
  } catch {
    // Keep going — Slack still gets the message.
  }

  // Slack/Teams mirror — best-effort, never blocks.
  void sendOutboundNotification({
    dedupeKey: `feedback:${id}`,
    kind: "cycle_summary",
    severity: input.sentiment === "frustrated" ? "high" : "info",
    tenantId: input.organizationId ?? "anonymous",
    headline: `Feedback (${input.sentiment}) from ${input.email ?? "anonymous"}`,
    body: `*Sentiment:* ${input.sentiment}\n*Page:* ${input.pagePath ?? "—"}\n\n${trimmedMessage}`,
    safeNextAction: { label: "Open dashboard", href: "/dashboard/command-center" },
    evidenceRefs: [`feedback:${id}`],
  });

  return { ok: true, id };
}
