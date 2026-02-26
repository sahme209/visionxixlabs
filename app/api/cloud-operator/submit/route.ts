import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

type SubmitBody = {
  operatorProfile?: Record<string, unknown>;
  tier?: string;
  email?: string;
  name?: string;
};

/**
 * POST /api/cloud-operator/submit
 * Body: { operatorProfile, tier?, email?, name? }
 * Creates Lead with source "cloud-operator", stores operatorProfile in fullPayload.operatorProfile.
 * Returns { token, leadId }.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`cloud-operator-submit:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: SubmitBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawProfile = body.operatorProfile && typeof body.operatorProfile === "object"
    ? body.operatorProfile
    : null;

  if (!rawProfile) {
    return NextResponse.json({ error: "operatorProfile is required" }, { status: 400 });
  }

  const projectType = String(rawProfile.projectType ?? "").trim();
  const hostingProvider = String(rawProfile.hostingProvider ?? "").trim();

  if (!projectType || !hostingProvider) {
    return NextResponse.json(
      { error: "projectType and hostingProvider are required" },
      { status: 400 }
    );
  }

  const tier = resolveOperatorTier(body.tier);
  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const name =
    typeof body.name === "string" ? body.name.trim().slice(0, 200) : null;

  const secret = process.env.STARTER_TOKEN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Server configuration error. Please try again later." },
      { status: 500 }
    );
  }

  try {
    const lead = await prisma.lead.create({
      data: {
        email: email || "cloud-operator@placeholder.local",
        name,
        source: "cloud-operator",
        status: "created",
        fullPayload: {
          operatorProfile: rawProfile,
          tier,
          operatorOutput: null,
          outputStatus: "pending",
        } as object,
      },
    });

    const token = createStarterToken(lead.id);
    return NextResponse.json({
      success: true,
      leadId: lead.id,
      token,
    });
  } catch (e) {
    console.error("[cloud-operator submit]", e);
    return NextResponse.json(
      { error: "Failed to create request. Please try again." },
      { status: 500 }
    );
  }
}

