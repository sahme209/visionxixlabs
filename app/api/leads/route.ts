import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createStarterToken } from "@/lib/starterToken";
import { encryptCredential } from "@/lib/credentialEncrypt";

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
      cloudProvider,
      useMyCloud,
      addOns,
      awsAccessKey,
      awsSecretKey,
      awsBucket,
      azureServicePrincipal,
      gcpServiceAccount,
    } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        email: trimmedEmail,
        name: String(name || "").trim().slice(0, 200),
        source: "website-request",
        status: "created",
        fullPayload: (() => {
          const prov = ["vercel", "aws", "azure", "gcp"].includes(String(cloudProvider || "")) ? cloudProvider : "vercel";
          const form: Record<string, unknown> = {
            name: String(name || "").trim().slice(0, 200),
            email: trimmedEmail,
            company: String(company || "").trim().slice(0, 200),
            message: String(message || "").trim().slice(0, 4000),
            industry: String(industry || "").trim().slice(0, 100),
            hasDomain: Boolean(hasDomain),
            domainName: String(domainName || "").trim().slice(0, 200),
            tier: ["starter", "professional", "done_for_you"].includes(String(tier || "")) ? tier : "starter",
            cloudProvider: prov,
            useMyCloud: Boolean(useMyCloud),
            addOns: Array.isArray(addOns) ? addOns.slice(0, 20).filter((a) => typeof a === "string") : [],
          };
          let credentials: Record<string, string> | undefined;
          try {
            if (useMyCloud && prov === "aws" && awsAccessKey && awsSecretKey) {
              credentials = {
                awsAccessKey: encryptCredential(String(awsAccessKey).trim().slice(0, 200)),
                awsSecretKey: encryptCredential(String(awsSecretKey).trim().slice(0, 400)),
                awsBucket: String(awsBucket || "").trim().slice(0, 100),
              };
            } else if (useMyCloud && prov === "azure" && azureServicePrincipal) {
              credentials = { azureServicePrincipal: encryptCredential(String(azureServicePrincipal).trim().slice(0, 4000)) };
            } else if (useMyCloud && prov === "gcp" && gcpServiceAccount) {
              credentials = { gcpServiceAccount: encryptCredential(String(gcpServiceAccount).trim().slice(0, 4000)) };
            }
          } catch {
            credentials = undefined;
          }
          return { form, credentials };
        })(),
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
