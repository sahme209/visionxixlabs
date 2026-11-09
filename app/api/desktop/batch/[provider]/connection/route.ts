import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { resolveRequestDesktopSession } from "@/lib/desktop/resolveRequestDesktopSession";
import { encryptScopedCredential } from "@/lib/security/credentialVault";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { BATCH_DESCRIPTORS, isBatchProvider, publicBatchError, type BatchMetadata, type BatchProvider } from "@/lib/integrations/batch/batchProviders";
import { appendAuditEvent, type AuditEventRepo } from "@/lib/releaseops/auditEventResponder";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Read-only Batches connection (Prefect, Dagster, Argo Workflows).
 * GET: workspace readers see safe connection state (never the credential).
 * PUT: connection managers validate with one bounded read, then save an encrypted credential.
 * DELETE: connection managers revoke. Connecting grants observation only; nothing here can run a job.
 */
type Ctx = { params: Promise<{ provider: string }> };
const mutationSelect = { id: true, organizationId: true, provider: true, status: true, updatedAt: true, encryptedCredential: true, revokedAt: true } as const;
class ConnectionChanged extends Error {}
const route = (method: string, provider: string) => `${method} /api/desktop/batch/${provider}/connection`;
const noStore = { headers: { "Cache-Control": "no-store" } };

async function resolveProvider(ctx: Ctx): Promise<BatchProvider | null> {
  const { provider } = await ctx.params;
  return isBatchProvider(provider) ? provider : null;
}
async function manager(request: NextRequest, method: string, provider: BatchProvider) {
  return resolveRequestDesktopSession(request, { requiredScope: "pipeline:trigger", requiredCapability: "connections:manage", route: route(method, provider), allowApiKey: false });
}
async function assertSameManager(request: NextRequest, method: string, provider: BatchProvider, initial: { id: string; organizationId: unknown; userId: unknown }) {
  request.signal.throwIfAborted();
  const current = await manager(request, method, provider);
  if (!current || current.credentialKind !== "desktop_session" || current.id !== initial.id || current.organizationId !== initial.organizationId || current.userId !== initial.userId) throw new ConnectionChanged();
}
const observedWhere = (r: { id: string; organizationId: string; provider: string; status: string; updatedAt: Date; encryptedCredential: string; revokedAt: Date | null }) =>
  ({ id: r.id, organizationId: r.organizationId, provider: r.provider, status: r.status, updatedAt: new Date(r.updatedAt.getTime()), encryptedCredential: r.encryptedCredential, revokedAt: r.revokedAt });

export async function GET(request: NextRequest, ctx: Ctx): Promise<Response> {
  const provider = await resolveProvider(ctx);
  if (!provider) return NextResponse.json({ ok: false, error: "unknown_provider" }, { status: 404 });
  const session = await resolveRequestDesktopSession(request, { requiredScope: "pipeline:read", requiredCapability: "workspace:read", route: route("GET", provider), allowApiKey: false });
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const row = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId: String(session.organizationId), provider } }, select: { id: true, status: true, scopesJson: true, lastValidatedAt: true, updatedAt: true, revokedAt: true } });
  const m = row?.scopesJson as Partial<BatchMetadata> | null;
  return NextResponse.json({ ok: true, data: row ? {
    provider, label: BATCH_DESCRIPTORS[provider].label, connectionId: row.id, connectionUpdatedAt: row.updatedAt.toISOString(),
    connected: row.status === "active" && !row.revokedAt, status: row.revokedAt ? "revoked" : row.status,
    baseUrl: m?.baseUrl ?? null, namespace: m?.namespace ?? null, inventoryCount: m?.inventoryCount ?? null, lastValidatedAt: row.lastValidatedAt,
    authority: "observation_only",
  } : { provider, label: BATCH_DESCRIPTORS[provider].label, connected: false, status: "not_connected", authority: "observation_only" } }, noStore);
}

export async function PUT(request: NextRequest, ctx: Ctx): Promise<Response> {
  const provider = await resolveProvider(ctx);
  if (!provider) return NextResponse.json({ ok: false, error: "unknown_provider" }, { status: 404 });
  const session = await manager(request, "PUT", provider);
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  const descriptor = BATCH_DESCRIPTORS[provider];
  try {
    const input = await descriptor.parse(body as Record<string, unknown>);
    const organizationId = String(session.organizationId);
    // Captured before provider I/O, so an older validation cannot undo a later disconnect.
    const existing = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider } }, select: mutationSelect });
    const expected = existing ? observedWhere(existing) : null;
    // Governance M03: a brand-new connection waits while enrolled; reconnecting or disconnecting an existing one still works.
    if (!existing && !await workspaceUnenrolled(organizationId)) return NextResponse.json({ ok: false, error: "governance_enrolled_connection_increase" }, { status: 409 });
    const inventoryCount = await descriptor.probe(descriptor.client(input.baseUrl, input.token, input.namespace));
    await assertSameManager(request, "PUT", provider, session);
    const connectionId = existing?.id ?? randomUUID();
    const encryptedCredential = encryptScopedCredential(JSON.stringify({ token: input.token }), connectionCredentialContext({ organizationId, provider, connectionId }));
    const metadata: BatchMetadata = { baseUrl: input.baseUrl, ...(input.namespace ? { namespace: input.namespace } : {}), inventoryCount };
    const validatedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await assertSameManager(request, "PUT", provider, session);
      const data = { status: "active", encryptedCredential, externalAccountId: input.baseUrl, scopesJson: metadata, consentedByUserId: String(session.userId), consentedAt: validatedAt, lastValidatedAt: validatedAt, revokedAt: null };
      if (expected) {
        const saved = await tx.tenantIntegrationConnection.updateMany({ where: expected, data });
        if (saved.count !== 1) throw new ConnectionChanged();
      } else {
        // The unique organization/provider key refuses a concurrent create; no upsert fallback.
        await tx.tenantIntegrationConnection.create({ data: { id: connectionId, organizationId, provider, ...data } });
      }
    });
    try { await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: `${provider}.connection.validated`, subjectKind: "integration", subjectId: connectionId, summary: `Validated read-only ${descriptor.label} connection`, actorUserId: String(session.userId) }); } catch { /* best-effort */ }
    return NextResponse.json({ ok: true, data: { provider, connectionId, status: "active", lastValidatedAt: validatedAt, ...metadata, authority: "observation_only" } }, noStore);
  } catch (error) {
    if (error instanceof ConnectionChanged) return NextResponse.json({ ok: false, error: `${provider}_connection_changed` }, { status: 409 });
    return NextResponse.json({ ok: false, error: publicBatchError(provider, error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, ctx: Ctx): Promise<Response> {
  const provider = await resolveProvider(ctx);
  if (!provider) return NextResponse.json({ ok: false, error: "unknown_provider" }, { status: 404 });
  const session = await manager(request, "DELETE", provider);
  if (!session) return NextResponse.json({ ok: false, error: "desktop_session_required" }, { status: 401 });
  const organizationId = String(session.organizationId);
  try {
    const row = await prisma.tenantIntegrationConnection.findUnique({ where: { organizationId_provider: { organizationId, provider } }, select: mutationSelect });
    if (row && !row.revokedAt) {
      const expected = observedWhere(row);
      await prisma.$transaction(async (tx) => {
        await assertSameManager(request, "DELETE", provider, session);
        const saved = await tx.tenantIntegrationConnection.updateMany({ where: expected, data: { status: "revoked", revokedAt: new Date() } });
        if (saved.count !== 1) throw new ConnectionChanged();
      });
      try { await appendAuditEvent(prisma as unknown as AuditEventRepo, { organizationId, kind: `${provider}.connection.revoked`, subjectKind: "integration", subjectId: row.id, summary: `Revoked read-only ${BATCH_DESCRIPTORS[provider].label} access`, actorUserId: String(session.userId) }); } catch { /* best-effort */ }
    }
    return NextResponse.json({ ok: true, data: { provider, disconnected: true } }, noStore);
  } catch (error) {
    const changed = error instanceof ConnectionChanged;
    return NextResponse.json({ ok: false, error: changed ? `${provider}_connection_changed` : `${provider}_connection_failed` }, { status: changed ? 409 : 503 });
  }
}
