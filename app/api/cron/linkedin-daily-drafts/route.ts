/**
 * GET/POST /api/cron/linkedin-daily-drafts
 *
 * Vercel cron — runs daily on weekdays. Generates 3 LinkedIn drafts via
 * lib/growth/contentPlanner and persists them with status="drafted". No
 * external posting happens here — humans still must approve in
 * /admin/growth/post-drafts before anything publishes.
 *
 * Guarded by Bearer ${CRON_SECRET}.
 */

import { NextResponse, type NextRequest } from "next/server";
import { planContent } from "@/lib/growth/contentPlanner";
import { createDraft } from "@/lib/growth/draftStore";
import { writeGrowthAudit } from "@/lib/growth/audit";
import type { ContentTopicCategory } from "@/lib/growth/growthModels";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Rotate the daily category so the queue stays varied across the week.
const ROTATION: ContentTopicCategory[] = [
  "product_education",
  "thought_leadership",
  "technical_deep_dive",
  "case_study",
  "founder_voice",
  "launch_announcement",
];

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }

async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, reason: "cron_not_configured" }, { status: 503 });
  }
  if ((req.headers.get("authorization") ?? "") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, reason: "cron_unauthorized" }, { status: 401 });
  }

  const dayIndex = new Date().getUTCDay(); // 0..6
  const category = ROTATION[dayIndex % ROTATION.length];

  const planned = await planContent({ channel: "linkedin", category, maxDrafts: 3 });

  const created = [];
  for (const d of planned.drafts) {
    const row = await createDraft({
      title: firstSentence(d.body).slice(0, 80),
      hook:  firstSentence(d.body),
      body:  d.body,
      cta:   d.cta,
      hashtags: d.hashtags,
      category,
      confidence: planned.usedLlm ? 0.7 : 0.4,
      createdByAgent: d.draftedByAgent,
    }, "cron:linkedin-daily-drafts");
    created.push(row.id);
  }

  await writeGrowthAudit({
    actor: "cron:linkedin-daily-drafts",
    action: "cron.daily_drafts_ran",
    detail: { category, generated: created.length, usedLlm: planned.usedLlm },
  });

  return NextResponse.json({
    ok: true,
    category,
    usedLlm: planned.usedLlm,
    generated: created.length,
    draftIds: created,
    ranAt: new Date().toISOString(),
  });
}

function firstSentence(text: string): string {
  // [\s\S] instead of . so we don't need the regex /s (dotAll) flag,
  // which requires TS target ES2018+ (this project targets lower).
  const m = text.match(/^([\s\S]{20,160}?[.!?])(\s|$)/);
  return (m?.[1] ?? text.slice(0, 140)).trim();
}
