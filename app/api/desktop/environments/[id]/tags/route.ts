import { withUnenrolledConfigurationMutation } from "@/lib/desktop/configurationMutationRefusal";
/**
 * PUT /api/desktop/environments/{id}/tags — replace an environment's tags.
 * Body: { tags: string[], expectedTags: string[] }
 *
 * Same authority as creating an environment (policy:manage, governed configuration mutation).
 * Compare-and-set on the tags the caller read, so concurrent edits are refused, not overwritten.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { prisma } from "@/lib/db";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { normalizeTags } from "@/lib/releaseops/environmentTags";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({ tags: z.array(z.string().max(100)).max(40), expectedTags: z.array(z.string().max(100)).max(40) }).strict();
type Tx = { environment: { findFirst(a: unknown): Promise<{ id: string; name: string; tags: string[] } | null>; updateMany(a: unknown): Promise<{ count: number }> } };

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", route: "PUT /api/desktop/environments/{id}/tags", allowApiKey: false, requiredCapability: "policy:manage" });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const next = normalizeTags(parsed.data.tags);
  if (!next.ok) return NextResponse.json({ ok: false, error: "tags_invalid", invalid: next.invalid }, { status: 422 });
  const expected = normalizeTags(parsed.data.expectedTags);
  if (!expected.ok) return NextResponse.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  const organizationId = String(session.organizationId);
  let outcome: "updated" | "not_found" | "changed";
  let name = "";
  try {
    outcome = await withUnenrolledConfigurationMutation(prisma, { organizationId, userId: String(session.userId), sessionId: String(session.id) }, request.signal, async () => {
      const current = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", allowApiKey: false, requiredCapability: "policy:manage", recordHeartbeat: false, route: "configuration mutation current authority" });
      if (!current || current.credentialKind !== "desktop_session" || current.id !== session.id || current.userId !== session.userId || current.organizationId !== session.organizationId) throw Error("configuration_identity_changed");
    }, async (raw) => {
      const tx = raw as unknown as Tx;
      const env = await tx.environment.findFirst({ where: { id, organizationId }, select: { id: true, name: true, tags: true } });
      if (!env) return "not_found" as const;
      name = env.name;
      if ([...env.tags].sort().join(",") !== expected.tags.join(",")) return "changed" as const;
      const r = await tx.environment.updateMany({ where: { id, organizationId, tags: { equals: env.tags } }, data: { tags: next.tags } });
      return r.count === 1 ? "updated" as const : "changed" as const;
    });
  } catch {
    return NextResponse.json({ ok: false, error: "governance_configuration_mutation_unavailable" }, { status: 409 });
  }
  if (outcome === "not_found") return NextResponse.json({ ok: false, error: "environment_not_found" }, { status: 404 });
  if (outcome === "changed") return NextResponse.json({ ok: false, error: "tags_changed" }, { status: 409 });
  try {
    await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: "environment.update", subjectKind: "environment", subjectId: id, summary: `Set tags on environment ${name}: ${next.tags.join(", ") || "none"}`, actorUserId: String(session.userId) });
  } catch { /* best-effort */ }
  return NextResponse.json({ ok: true, data: { id, tags: next.tags } });
}
