/**
 * GET   /api/admin/growth/drafts/[id]  — fetch a single draft
 * PATCH /api/admin/growth/drafts/[id]  — edit hook/body/cta/hashtags
 *
 * Admin-only. Edits are blocked on terminal statuses (handled in
 * draftStore.editDraft).
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { editDraft, findDraft } from "@/lib/growth/draftStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  const draft = await findDraft(id);
  if (!draft) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, draft });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;
  const { id } = await ctx.params;
  let patch: {
    title?: string; hook?: string; body?: string; cta?: string | null;
    hashtags?: string[]; targetAudience?: string | null;
  } = {};
  try { patch = await req.json(); } catch { /* empty body */ }
  const updated = await editDraft(id, patch, gate.user.email ?? "admin");
  if (!updated) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, draft: updated });
}
