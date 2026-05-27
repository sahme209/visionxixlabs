/**
 * POST /api/webhooks/github — Phase 497.
 *
 * Verifies X-Hub-Signature-256 against GITHUB_WEBHOOK_SECRET, then
 * idempotently dispatches the parsed payload via the pure responder.
 */

import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import {
  verifyGitHubSignature,
  dispatchGitHubWebhook,
  type GithubWebhookRepo,
} from "@/lib/releaseops/githubWebhookResponder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<Response> {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[GitHub Webhook] GITHUB_WEBHOOK_SECRET not set");
    return NextResponse.json({ ok: false, error: "webhook_not_configured" }, { status: 500 });
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const sigCheck = verifyGitHubSignature(raw, req.headers.get("x-hub-signature-256"), secret);
  if (!sigCheck.ok) {
    return NextResponse.json({ ok: false, error: "invalid_signature", hint: sigCheck.reason }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const deliveryId = req.headers.get("x-github-delivery") ?? "";
  const eventKind = req.headers.get("x-github-event") ?? "";

  const r = await dispatchGitHubWebhook(
    prisma as unknown as GithubWebhookRepo,
    { deliveryId, eventKind, payload },
  );
  return NextResponse.json(r.body, { status: r.status });
}
