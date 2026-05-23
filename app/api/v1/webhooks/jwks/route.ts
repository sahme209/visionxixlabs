/**
 * GET /api/v1/webhooks/jwks — Phase 404.
 *
 * Public JWKS endpoint exposing the platform's ES256 webhook-signing
 * public keys. Integrators using `signingMode = "es256"` fetch this
 * endpoint, find the key whose `kid` matches the `X-VXL-Kid` header on
 * an incoming delivery, and verify the signature with the matching
 * public key.
 *
 * No auth required — public keys are by definition safe to publish.
 * No rate limiting either (a polite caller hits this once per day or
 * less and caches; the keys rarely rotate).
 *
 * Returns every key whose status is "active" or "retiring", so an
 * in-flight delivery signed with a key that's just been rotated still
 * verifies during the grace window.
 *
 * Cache headers: 1h client + 5m CDN. Verifiers may safely cache.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface JwkRow {
  kid: string;
  publicJwk: unknown;
  status: string;
}

export async function GET() {
  let rows: JwkRow[] = [];
  try {
    rows = await prisma.webhookSigningKey.findMany({
      where: { status: { in: ["active", "retiring"] } },
      orderBy: { createdAt: "desc" },
      select: { kid: true, publicJwk: true, status: true },
    });
  } catch {
    // No keys yet (cold platform) → return an empty JWKS so verifiers
    // can still parse the response shape. The "active" key gets
    // generated lazily by the first dispatch needing ES256.
    rows = [];
  }

  // Build the JWKS keys array via an explicit loop instead of a map+filter
  // chain so the inferred shape ({ ...jwk, kid, use, alg } & Record<string,
  // unknown>) stays compatible with a typed result array. The type-
  // predicate-based filter would WIDEN the type back to Record<string,
  // unknown>, which TS 5.9 rejects under strict mode.
  const keys: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    if (r.publicJwk === null || typeof r.publicJwk !== "object") continue;
    const jwk = r.publicJwk as Record<string, unknown>;
    if (jwk.kty !== "EC" || jwk.crv !== "P-256") continue;
    keys.push({
      ...jwk,
      kid: r.kid,
      use: "sig",
      alg: "ES256",
    });
  }

  return NextResponse.json(
    { keys },
    {
      status: 200,
      headers: {
        // 1 hour browser cache, 5 min CDN cache. Verifiers must
        // re-fetch on signature failure to handle un-cached rotation.
        "Cache-Control": "public, max-age=3600, s-maxage=300",
        "Content-Type": "application/jwk-set+json",
      },
    },
  );
}
