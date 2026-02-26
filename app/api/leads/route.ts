import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createStarterToken } from "@/lib/starterToken";
import { resolveTier } from "@/lib/websiteBuildPricing";

/**
 * POST /api/leads — Create new website request lead.
 * Lead is saved first; AI and deployment are triggered async and never block.
 * Returns { leadId, token } — use token for thank-you page and status polling.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      email,
      company,
      message,
      industry,
      hasDomain,
      domainName,
      tier,
    } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const resolvedTier = resolveTier(String(tier || "starter"));

    const normalizedForm = {
      name: String(name || "").trim().slice(0, 200),
      email: trimmedEmail,
      company: String(company || "").trim().slice(0, 200),
      message: String(message || "").trim().slice(0, 4000),
      industry: String(industry || "").trim().slice(0, 100),
      hasDomain: Boolean(hasDomain),
      domainName: String(domainName || "").trim().slice(0, 200),
      tier: resolvedTier,
    };

    const lead = await prisma.lead.create({
      data: {
        email: trimmedEmail,
        name: normalizedForm.name,
        source: "website-request",
        status: "created",
        fullPayload: {
          // Standardized structure
          context: {
            type: "website",
          },
          form: normalizedForm,
          engine: {
            outputStatus: "pending",
            rawOutput: null,
            scores: null,
            axiomScores: null,
            roadmap: null,
          },
          infrastructure: {},
          metadata: {},
          // Legacy keys (preserved for backward compatibility)
          // (form remains available at the same key via the standardized structure)
        },
      },
    });

    const secret = process.env.STARTER_TOKEN_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: "Server configuration error. Please try again later." },
        { status: 500 }
      );
    }

    const token = createStarterToken(lead.id);

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      token,
    });
  } catch (e) {
    console.error("[leads POST]", e);
    return NextResponse.json(
      { error: "Failed to create lead. Please try again." },
      { status: 500 }
    );
  }
}
