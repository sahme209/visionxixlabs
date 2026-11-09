/**
 * Workspace self-service API keys (owners/admins). Session auth; the workspace
 * comes from the session, never the request body.
 *   GET  — list this workspace's keys (never the secret).
 *   POST — mint a key under the self-service policy; the secret is shown once.
 */
import { NextResponse, type NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { authorizedForOrganization } from "@/lib/axiom/workspaceAuthority";
import { mintApiKeyRecord } from "@/lib/security/mintApiKeyRecord";
import { decideSelfServiceMint } from "@/lib/security/selfServiceApiKeyPolicy";
import { workspaceUnenrolled } from "@/lib/governance/intelligence/enrolledRefusal";

export const dynamic = "force-dynamic";
const noStore = { headers: { "Cache-Control": "no-store" } } as const;

async function admin(): Promise<{ organizationId: string; email: string } | NextResponse> {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId || !ctx.sessionUserId || !ctx.email) return NextResponse.json({ ok: false, error: "sign_in_required" }, { status: 401 });
  const organizationId = String(ctx.organizationId);
  if (!await authorizedForOrganization(String(ctx.sessionUserId), organizationId, true)) return NextResponse.json({ ok: false, error: "owner_or_admin_required" }, { status: 403 });
  return { organizationId, email: ctx.email };
}

export async function GET() {
  const who = await admin();
  if (who instanceof NextResponse) return who;
  const rows = await prisma.apiKey.findMany({ where: { organizationId: who.organizationId }, orderBy: { createdAt: "desc" }, take: 100,
    select: { id: true, name: true, prefix: true, env: true, scopes: true, createdBy: true, lastUsedAt: true, useCount: true, expiresAt: true, revokedAt: true, createdAt: true } });
  return NextResponse.json({ ok: true, apiKeys: rows }, noStore);
}

export async function POST(req: NextRequest) {
  const who = await admin();
  if (who instanceof NextResponse) return who;
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  const now = new Date();
  const activeKeys = await prisma.apiKey.count({ where: { organizationId: who.organizationId, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } });
  const decision = decideSelfServiceMint({ name: body?.name, scopes: body?.scopes, expiresInDays: body?.expiresInDays, env: body?.env, activeKeys }, now);
  if (!decision.ok) return NextResponse.json(decision, { status: decision.error === "too_many_keys" ? 409 : 400 });
  // Governance M04: a new credential is an increase, so it waits while enrolled. Revoking still works.
  if (!await workspaceUnenrolled(who.organizationId)) return NextResponse.json({ ok: false, error: "governance_enrolled_credential_increase" }, { status: 409, ...noStore });
  const result = await mintApiKeyRecord({ organizationId: who.organizationId, name: decision.name, scopes: decision.scopes, env: decision.env, createdBy: who.email, expiresAt: decision.expiresAt, correlationId: `control_apikey_${now.getTime().toString(36)}` });
  return NextResponse.json({ ok: true, apiKey: { id: result.apiKeyId, prefix: result.prefix, env: result.env, scopes: result.scopes, expiresAt: result.expiresAt, plaintext: result.plaintext } }, { status: 201, ...noStore });
}
