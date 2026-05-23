/**
 * POST /api/admin/api-keys — Phase 394.
 *
 * Admin-only endpoint that mints a fresh API key for a workspace.
 * The plaintext is returned ONCE in the response body; we never
 * store it. The operator must capture it from this response —
 * subsequent reads will only show the prefix.
 *
 * GET /api/admin/api-keys — list keys for a workspace (no plaintext).
 *
 * Gated by ADMIN_EMAILS. Every mint emits a workforce.api_key_created
 * audit row.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin/auth";
import { prisma } from "@/lib/db";
import { mintApiKeyRecord } from "@/lib/security/mintApiKeyRecord";
import { normalizeScopes } from "@/lib/security/apiKeyScope";

export const dynamic = "force-dynamic";

interface MintBody {
  organizationId?: unknown;
  name?: unknown;
  scopes?: unknown;
  env?: unknown;
  expiresAt?: unknown;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  let body: MintBody = {};
  try { body = (await req.json()) as MintBody; } catch { /* empty */ }

  if (typeof body.organizationId !== "string" || body.organizationId.length === 0) {
    return NextResponse.json({ ok: false, reason: "organizationId_required" }, { status: 400 });
  }
  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json({ ok: false, reason: "name_required" }, { status: 400 });
  }

  const scopes = normalizeScopes(Array.isArray(body.scopes) ? body.scopes : []);
  if (scopes.length === 0) {
    return NextResponse.json({ ok: false, reason: "no_valid_scopes" }, { status: 400 });
  }

  const env: "live" | "test" = body.env === "test" ? "test" : "live";

  let expiresAt: Date | null = null;
  if (typeof body.expiresAt === "string" && body.expiresAt.length > 0) {
    const d = new Date(body.expiresAt);
    if (Number.isFinite(d.getTime())) expiresAt = d;
  }

  const correlationId = `apikey_mint_${Date.now().toString(36)}`;

  const result = await mintApiKeyRecord({
    organizationId: body.organizationId,
    name: body.name.trim(),
    scopes,
    env,
    createdBy: session.user.email,
    expiresAt,
    correlationId,
  });

  return NextResponse.json({
    ok: true,
    apiKey: {
      id: result.apiKeyId,
      prefix: result.prefix,
      env: result.env,
      scopes: result.scopes,
      expiresAt: result.expiresAt,
      /** Plaintext shown ONCE. Capture it now — it will never be retrievable. */
      plaintext: result.plaintext,
    },
  });
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, reason: "admin_required" }, { status: 403 });
  }

  const organizationId = req.nextUrl.searchParams.get("organizationId");
  if (!organizationId) {
    return NextResponse.json({ ok: false, reason: "organizationId_required" }, { status: 400 });
  }

  const rows = await prisma.apiKey.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      env: true,
      scopes: true,
      createdBy: true,
      lastUsedAt: true,
      lastUsedIp: true,
      useCount: true,
      expiresAt: true,
      revokedAt: true,
      revokedReason: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ok: true, apiKeys: rows });
}
