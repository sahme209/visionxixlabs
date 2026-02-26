import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createStarterToken } from "@/lib/starterToken";

type InferredProfile = {
  projectType?: string;
  hostingProvider?: string;
  trafficLevel?: string;
  hasCiCd?: string;
  publicExposure?: string;
  primaryGoal?: string;
};

/**
 * POST /api/website-builder/run-axiom
 * Body: { inferredProfile: InferredProfile, siteName?: string }
 * Creates a Cloud Operator lead with inferred profile. Returns { token } for redirect to /cloud-operator?token=
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const inferred = (body?.inferredProfile ?? {}) as InferredProfile;
    const siteName = String(body?.siteName ?? "").trim().slice(0, 200);

    const secret = process.env.STARTER_TOKEN_SECRET;
    if (!secret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const operatorProfile = {
      projectType: inferred.projectType || "Static Site",
      hostingProvider: inferred.hostingProvider || "Vercel",
      monthlySpend: "",
      trafficLevel: inferred.trafficLevel || "Low",
      hasCiCd: inferred.hasCiCd || "no",
      publicExposure: inferred.publicExposure || "Public Web",
      complianceNeeds: "None",
      gitProvider: "None",
      primaryGoal: inferred.primaryGoal || "Launch faster",
    };

    const lead = await prisma.lead.create({
      data: {
        email: "website-builder@placeholder.local",
        name: siteName || "Website Builder",
        source: "cloud-operator",
        status: "created",
        fullPayload: {
          context: { type: "operator", fromWebsiteBuilder: true },
          form: { operatorProfile, tier: "free", email: "", name: siteName },
          operatorProfile,
          tier: "free",
          engine: {
            outputStatus: "pending",
            engineName: "cloud-operator",
            updatedAt: new Date().toISOString(),
            rawOutput: null,
            scores: null,
            axiomScores: null,
            roadmap: null,
          },
          infrastructure: {},
          metadata: {},
        },
      },
    });

    const token = createStarterToken(lead.id);
    return NextResponse.json({
      success: true,
      token,
      leadId: lead.id,
    });
  } catch (e) {
    console.error("[website-builder run-axiom]", e);
    return NextResponse.json({ error: "Failed to create Axiom analysis" }, { status: 500 });
  }
}
