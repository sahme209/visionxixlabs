/**
 * GET  /api/admin/growth/drafts            — list LinkedIn drafts (admin-only)
 * POST /api/admin/growth/drafts            — create N drafts via lib/growth/contentPlanner
 *
 * Internal only. ADMIN_EMAILS gated via requireAdmin.
 */

import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { listDrafts, createDraft, type LinkedInDraftStatus } from "@/lib/growth/draftStore";
import { planContent } from "@/lib/growth/contentPlanner";
import { parseFormOrJson } from "@/lib/growth/parseBody";
import type { ContentTopicCategory } from "@/lib/growth/growthModels";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  const status = (req.nextUrl.searchParams.get("status") ?? undefined) as LinkedInDraftStatus | undefined;
  const limitParam = req.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.max(1, Math.min(parseInt(limitParam, 10) || 50, 500)) : 100;

  const rows = await listDrafts({ status, limit });
  return NextResponse.json({
    ok: true,
    total: rows.length,
    drafts: rows.map(serialize),
  });
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("error" in gate) return gate.error;

  const body = await parseFormOrJson(req);
  const category = (body.category as ContentTopicCategory | undefined) ?? "product_education";
  const count = Math.max(1, Math.min(body.count ? parseInt(body.count, 10) || 3 : 3, 5));

  const planned = await planContent({ channel: "linkedin", category, topicHint: body.topicHint, maxDrafts: count });

  const created = await Promise.all(planned.drafts.map((d) => createDraft({
    title: deriveTitle(d.body),
    hook: firstSentence(d.body),
    body: d.body,
    cta: d.cta,
    hashtags: d.hashtags,
    category,
    confidence: planned.usedLlm ? 0.7 : 0.4,
    campaignId: body.campaignId || undefined,
    createdByAgent: d.draftedByAgent,
  }, gate.user.email ?? "admin")));

  // HTML form callers → redirect back to the drafts page.
  if (isFormPost(req)) {
    return NextResponse.redirect(new URL("/admin/growth/post-drafts", req.url), { status: 303 });
  }

  return NextResponse.json({
    ok: true,
    usedLlm: planned.usedLlm,
    drafts: created.map(serialize),
  });
}

function isFormPost(req: NextRequest): boolean {
  const ct = (req.headers.get("content-type") ?? "").toLowerCase();
  return ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
}

function serialize(d: Awaited<ReturnType<typeof listDrafts>>[number]) {
  return {
    id: d.id,
    title: d.title,
    hook: d.hook,
    body: d.body,
    cta: d.cta,
    hashtags: d.hashtags,
    category: d.category,
    targetAudience: d.targetAudience,
    status: d.status,
    confidence: d.confidence,
    scheduledFor: d.scheduledFor?.toISOString() ?? null,
    publishedAt: d.publishedAt?.toISOString() ?? null,
    linkedinPostUrn: d.linkedinPostUrn,
    linkedinPostUrl: d.linkedinPostUrl,
    createdByAgent: d.createdByAgent,
    approvedByEmail: d.approvedByEmail,
    rejectionReason: d.rejectionReason,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function firstSentence(text: string): string {
  const m = text.match(/^(.{20,160}?[.!?])(\s|$)/s);
  return (m?.[1] ?? text.slice(0, 140)).trim();
}

function deriveTitle(text: string): string {
  return firstSentence(text).slice(0, 80);
}
