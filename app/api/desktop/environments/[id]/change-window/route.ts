import { withUnenrolledConfigurationMutation } from "@/lib/desktop/configurationMutationRefusal";
/**
 * PUT /api/desktop/environments/{id}/change-window — replace an environment's change window rule.
 * Body: { rule: object | null, expectedRule: object | null }
 *
 * Same authority as editing tags (policy:manage, governed configuration mutation). The rule must parse
 * (weekdays, UTC windows, freezes); null clears it. Compare-and-set on the rule the caller read plus the
 * row's updatedAt, so concurrent edits are refused, not overwritten.
 */
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@/lib/prismaClient";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { canonicalJson, parseChangeWindowRule, type ChangeWindowRule } from "@/lib/releaseops/environmentChangeWindow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Tx = { environment: { findFirst(a: unknown): Promise<{ id: string; name: string; changeWindowRuleJson: unknown; updatedAt: Date } | null>; updateMany(a: unknown): Promise<{ count: number }> } };

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "PUT /api/desktop/environments/{id}/change-window", allowApiKey: false, requiredCapability: "policy:manage" });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await params;
  const raw = await request.text().catch(() => "");
  if (raw.length > 16_384) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  let body: unknown;
  try { body = JSON.parse(raw); } catch { body = null; }
  if (!body || typeof body !== "object" || Array.isArray(body) || !("rule" in body) || !("expectedRule" in body) || Object.keys(body).length !== 2 || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }
  const { rule, expectedRule } = body as { rule: unknown; expectedRule: unknown };
  const parsed = parseChangeWindowRule(rule);
  if (parsed.kind === "unreadable") return NextResponse.json({ ok: false, error: "change_window_invalid", detail: parsed.error }, { status: 422 });
  const next: ChangeWindowRule | null = parsed.kind === "rule" ? parsed.rule : null;
  const organizationId = String(session.organizationId);
  let outcome: "updated" | "not_found" | "changed";
  let name = "";
  try {
    outcome = await withUnenrolledConfigurationMutation(prisma, { organizationId, userId: String(session.userId), sessionId: String(session.id) }, request.signal, async () => {
      const current = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", allowApiKey: false, requiredCapability: "policy:manage", recordHeartbeat: false, route: "configuration mutation current authority" });
      if (!current || current.credentialKind !== "desktop_session" || current.id !== session.id || current.userId !== session.userId || current.organizationId !== session.organizationId) throw Error("configuration_identity_changed");
    }, async (rawTx) => {
      const tx = rawTx as unknown as Tx;
      const env = await tx.environment.findFirst({ where: { id, organizationId }, select: { id: true, name: true, changeWindowRuleJson: true, updatedAt: true } });
      if (!env) return "not_found" as const;
      name = env.name;
      if (canonicalJson(env.changeWindowRuleJson) !== canonicalJson(expectedRule)) return "changed" as const;
      const r = await tx.environment.updateMany({ where: { id, organizationId, updatedAt: env.updatedAt }, data: { changeWindowRuleJson: next ?? Prisma.DbNull } });
      return r.count === 1 ? "updated" as const : "changed" as const;
    });
  } catch {
    return NextResponse.json({ ok: false, error: "governance_configuration_mutation_unavailable" }, { status: 409 });
  }
  if (outcome === "not_found") return NextResponse.json({ ok: false, error: "environment_not_found" }, { status: 404 });
  if (outcome === "changed") return NextResponse.json({ ok: false, error: "change_window_changed" }, { status: 409 });
  const summary = next ? `${next.utcWindows.length} window(s) on ${next.weekdays.join(", ")}, ${next.freezes.length} freeze(s)` : "none";
  try {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "environment.update", subjectKind: "environment", subjectId: id, summary: `Set change window on environment ${name}: ${summary}`, actorUserId: String(session.userId) });
  } catch { /* best-effort */ }
  return NextResponse.json({ ok: true, data: { id, changeWindowRule: next } });
}
