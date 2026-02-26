import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createStarterToken } from "@/lib/starterToken";
import { checkRateLimit } from "@/lib/rateLimit";
import { CLOUD_STUDIO_SERVICE_TYPES } from "@/lib/cloudStudio/types";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "anon"
  );
}

/**
 * POST /api/cloud-studio/submit
 * Body: { serviceType, form, tier?, email?, name? }
 * Creates Lead with source "cloud-studio", stores in fullPayload. Returns { token, leadId }.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`cloud-studio-submit:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }

  let body: {
    serviceType?: string;
    form?: Record<string, unknown>;
    tier?: string;
    email?: string;
    name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const serviceType = body.serviceType;
  if (!serviceType || !CLOUD_STUDIO_SERVICE_TYPES.includes(serviceType as (typeof CLOUD_STUDIO_SERVICE_TYPES)[number])) {
    return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
  }

  const form = body.form && typeof body.form === "object" ? body.form : {};
  const tier = ["free", "professional", "enterprise"].includes(String(body.tier || ""))
    ? body.tier
    : "free";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 200) : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : null;

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
        email: email || "cloud-studio@placeholder.local",
        name,
        source: "cloud-studio",
        status: "created",
        fullPayload: {
          serviceType,
          form,
          tier,
          output: null,
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
    console.error("[cloud-studio submit]", e);
    return NextResponse.json(
      { error: "Failed to create request. Please try again." },
      { status: 500 }
    );
  }
}
