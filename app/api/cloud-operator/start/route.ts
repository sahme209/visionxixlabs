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

    const lead = await prisma.lead.create({
      data: {
        email: body.email?.trim().toLowerCase() || "cloud-operator@placeholder.local",
        name: body.name?.trim() || null,
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
    const debugHeader = req.headers.get("x-axiom-debug") === "axiom-debug-2026";
    return NextResponse.json(
      {
        error: "Failed to initialize. Please try again.",
        ...(debugHeader && {
          _debug: {
            message: e instanceof Error ? e.message : String(e),
            name: e instanceof Error ? e.name : "Unknown",
            code: (e as { code?: string })?.code,
            stack: e instanceof Error ? e.stack?.split("\n").slice(0, 6).join("\n") : undefined,
          },
        }),
      },
      { status: 500 }
    );
  }
}
