import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createStarterToken } from "@/lib/starterToken";
import { checkTieredRateLimit } from "@/lib/rateLimitTiered";

export const maxDuration = 15;

const VALID_PROVIDERS = ["aws", "azure", "gcp"] as const;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

/**
 * POST /api/cloud-operator/start
 * Body: { provider: "aws" | "azure" | "gcp" }
 * Creates a lightweight Lead for the onboarding flow, returns { token, leadId }.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkTieredRateLimit("free", ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: { provider?: string; email?: string; name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const provider = body.provider?.trim().toLowerCase();
  if (!provider || !VALID_PROVIDERS.includes(provider as typeof VALID_PROVIDERS[number])) {
    return NextResponse.json({ error: "Valid provider required (aws, azure, gcp)" }, { status: 400 });
  }

  const secret = process.env.STARTER_TOKEN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server configuration error. Please try again later." },
      { status: 500 }
    );
  }

  try {
    const sessionPromise = getServerSession(authOptions);
    const session = await Promise.race([
      sessionPromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ]);
    const userId = session?.user && "id" in session.user ? (session.user as { id: string }).id : null;
    const sessionEmail = session?.user?.email?.trim().toLowerCase() || null;

    // Critical: use the signed-in user's real email when present. The
    // ConnectorSetupSession bridge derives the org id by hashing this
    // email — if the Lead carries the "cloud-operator@placeholder.local"
    // fallback, the bridge skips the upsert AND the session-mode status
    // backfill can't find the Lead, so /dashboard sits on "Connect a
    // cloud" forever after a successful AWS connect.
    const leadEmail = body.email?.trim().toLowerCase()
      || sessionEmail
      || "cloud-operator@placeholder.local";

    const lead = await prisma.lead.create({
      data: {
        email: leadEmail,
        // DB column is NOT NULL (migration drift vs nullable schema) — always
        // pass a string default to avoid P2011 null-constraint violations.
        name: body.name?.trim() || session?.user?.name?.trim() || "Cloud Operator",
        userId: userId ?? undefined,
        source: "cloud-operator",
        status: "created",
        fullPayload: {
          context: { type: "operator" },
          form: { provider },
          engine: {
            outputStatus: "pending",
            engineName: "cloud-operator",
            updatedAt: new Date().toISOString(),
          },
          infrastructure: {},
          connectors: {},
          operatorProfile: {
            hostingProvider: provider,
            projectType: "infrastructure",
          },
          tier: "free",
        } as object,
      },
    });

    const token = createStarterToken(lead.id);
    return NextResponse.json({ success: true, leadId: lead.id, token });
  } catch (e) {
    console.error("[cloud-operator start]", e);
    return NextResponse.json(
      { error: "Failed to initialize. Please try again." },
      { status: 500 }
    );
  }
}
