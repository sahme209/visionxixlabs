/**
 * POST /api/admin/growth/drafts/[id]/transition
 *
 * Body: { to: "approved" | "rejected" | "scheduled" | "in_review" | "needs_revision",
 *         scheduledFor?: ISO string, rejectionReason?: string }
 *
 * Closed-union validation lives in lib/growth/draftStore.transitionStatus.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { transitionStatus, type LinkedInDraftStatus } from "@/lib/growth/draftStore";
import { parseFormOrJson } from "@/lib/growth/parseBody";

export const dynamic = "force-dynamic";

const ALLOWED: ReadonlySet<LinkedInDraftStatus> = new Set([
  "in_review",
  "approved",
  "rejected",
  "scheduled",
  "needs_revision",
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;

  const body = await parseFormOrJson(req);
  const to = body.to as LinkedInDraftStatus | undefined;
  if (!to || !ALLOWED.has(to)) {
    return NextResponse.json({ ok: false, error: "invalid_target_status", to }, { status: 400 });
  }

  const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
  if (to === "scheduled" && (!scheduledFor || isNaN(scheduledFor.getTime()))) {
    return NextResponse.json({ ok: false, error: "scheduled_requires_valid_scheduledFor" }, { status: 400 });
  }

  const result = await transitionStatus(id, to, gate.user.email ?? "admin", {
    scheduledFor,
    rejectionReason: body.rejectionReason,
  });

  if (result.kind === "not_found") return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (result.kind === "invalid_transition") return NextResponse.json({ ok: false, error: result.kind, from: result.from, to: result.to }, { status: 409 });

  if (isFormPost(req)) {
    return NextResponse.redirect(new URL(`/admin/growth/post-drafts#${id}`, req.url), { status: 303 });
  }
  return NextResponse.json({ ok: true, draft: result.draft });
}

function isFormPost(req: NextRequest): boolean {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  return ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
}
