/**
 * POST /api/admin/growth/drafts/[id]/publish
 *
 * Publish a draft to LinkedIn NOW. Closed-union outcomes:
 * success | skipped_disabled | skipped_not_connected | token_expired |
 * http_error | network_error.
 *
 * Pre-conditions enforced at the route layer:
 *   - draft must be in status: approved | scheduled  (any other → 409)
 *
 * The actual LinkedIn API call lives in lib/growth/linkedin/posting.ts.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { findDraft } from "@/lib/growth/draftStore";
import { publishDraft } from "@/lib/growth/linkedin/posting";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PUBLISHABLE: ReadonlySet<string> = new Set(["approved", "scheduled"]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;

  const draft = await findDraft(id);
  if (!draft) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  if (!PUBLISHABLE.has(draft.status)) {
    return NextResponse.json(
      { ok: false, error: "draft_not_publishable", status: draft.status, hint: "Approve the draft first." },
      { status: 409 },
    );
  }

  const outcome = await publishDraft({
    draftId: id,
    triggeredBy: `operator:${gate.user.email ?? "admin"}`,
  });

  const httpStatus = outcome.kind === "success" ? 200
    : outcome.kind === "skipped_disabled" ? 202
    : outcome.kind === "skipped_not_connected" ? 412
    : outcome.kind === "token_expired" ? 401
    : outcome.kind === "http_error" ? 502
    : 500;

  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  const isFormPost = ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
  if (isFormPost) {
    const params = new URLSearchParams({ publishOutcome: outcome.kind });
    return NextResponse.redirect(new URL(`/admin/growth/post-drafts#${id}?${params.toString()}`, req.url), { status: 303 });
  }
  return NextResponse.json({ ok: outcome.kind === "success", outcome }, { status: httpStatus });
}
