/**
 * POST /api/policy/replay  Body: { organizationId, draft: Policy[], days?: 1-90 }
 * Policy replay (A12): what would a draft approval policy set have done to the
 * last N days of real actions? Read-only — nothing is enabled or saved.
 */
import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import type { ApprovalPolicyDef } from "@/lib/axiom/agent/rbacEngine";
import { replayPolicies, type HistoricalAction } from "@/lib/policy/replayKernel";

export const dynamic = "force-dynamic";
const strings = (v: unknown, max = 20) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length <= 60).slice(0, max) : []);

/** Parses an untrusted draft policy. Unknown fields are ignored; nothing here is persisted. */
function parseDraft(raw: unknown, organizationId: string, i: number): ApprovalPolicyDef | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const name = typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 120) : `Draft rule ${i + 1}`;
  const requiredApprovals = Number.isInteger(r.requiredApprovals) ? Math.min(5, Math.max(0, r.requiredApprovals as number)) : 1;
  return {
    id: `draft_${i}`, organizationId, name, enabled: r.enabled !== false, priority: Number.isInteger(r.priority) ? (r.priority as number) : 0,
    matchRiskLevels: strings(r.matchRiskLevels) as ApprovalPolicyDef["matchRiskLevels"], matchActionTypes: strings(r.matchActionTypes) as ApprovalPolicyDef["matchActionTypes"],
    matchProviders: strings(r.matchProviders) as ApprovalPolicyDef["matchProviders"], matchCategories: strings(r.matchCategories) as ApprovalPolicyDef["matchCategories"],
    matchMinSavings: typeof r.matchMinSavings === "number" && Number.isFinite(r.matchMinSavings) ? r.matchMinSavings : undefined,
    requiredApprovals, requiredRoles: strings(r.requiredRoles) as ApprovalPolicyDef["requiredRoles"], escalateToRoles: [], blockAction: r.blockAction === true,
  };
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const body = await req.json().catch(() => null) as { organizationId?: unknown; draft?: unknown; days?: unknown } | null;
  if (!await authorizedForOrganization(userId, body?.organizationId)) return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  const organizationId = body!.organizationId as string;
  if (!Array.isArray(body?.draft) || body.draft.length === 0 || body.draft.length > 50) return NextResponse.json({ ok: false, error: "draft_required" }, { status: 400 });
  const draft = body.draft.map((d, i) => parseDraft(d, organizationId, i));
  if (draft.some((d) => d === null)) return NextResponse.json({ ok: false, error: "invalid_draft" }, { status: 400 });
  const days = Number.isInteger(body.days) ? Math.min(90, Math.max(1, body.days as number)) : 30;
  const to = new Date(); const from = new Date(to.getTime() - days * 86_400_000);
  const [currentRows, items] = await Promise.all([
    prisma.axiomApprovalPolicy.findMany({ where: { organizationId, enabled: true } }),
    prisma.axiomApprovalItem.findMany({ where: { organizationId, createdAt: { gte: from, lte: to } }, select: { id: true, title: true, createdAt: true, status: true, riskLevel: true, actionType: true, provider: true, disposition: true, yearlyHigh: true }, orderBy: { createdAt: "asc" }, take: 5000 }),
  ]);
  const current = currentRows.map((p) => ({ ...p, description: p.description ?? undefined, matchMinSavings: p.matchMinSavings ?? undefined, escalateAfterHours: p.escalateAfterHours ?? undefined, autoExpireHours: p.autoExpireHours ?? undefined })) as unknown as ApprovalPolicyDef[];
  const result = replayPolicies({ current, draft: draft as ApprovalPolicyDef[], history: items as unknown as HistoricalAction[], from, to });
  return NextResponse.json({ ok: true, replay: { ...result, truncated: items.length === 5000 } }, { headers: { "Cache-Control": "no-store" } });
}
