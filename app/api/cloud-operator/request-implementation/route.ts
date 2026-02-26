import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { resolveOperatorTier } from "@/lib/cloudOperator/pricing";
import { logAudit } from "@/lib/security/auditLog";

/**
 * Phase 4: Request Implementation — creates a Lead task for implementation support.
 * POST body: { contactEmail?, notes?, preferredWindow? }
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const result = verifyStarterToken(token);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error === "expired" ? "Token expired" : "Invalid token" },
      { status: 401 }
    );
  }

  try {
    const lead = await prisma.lead.findUnique({
      where: { id: result.leadId },
    });
    if (!lead || lead.source !== "cloud-operator") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: { contactEmail?: string; notes?: string; preferredWindow?: string };
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const contactEmail =
      typeof body.contactEmail === "string"
        ? body.contactEmail.trim().slice(0, 200)
        : lead.email;
    const notes =
      typeof body.notes === "string"
        ? body.notes.trim().slice(0, 2000)
        : "";
    const preferredWindow =
      typeof body.preferredWindow === "string"
        ? body.preferredWindow.trim().slice(0, 200)
        : "";

    const payload = (lead.fullPayload as Record<string, unknown>) || {};
    const tier = resolveOperatorTier(payload.tier as string);

    const implementationRequest = {
      requestedAt: new Date().toISOString(),
      contactEmail,
      preferredWindow,
      notes,
      recommendedTier: tier,
    };

    const updatedPayload = {
      ...payload,
      implementationRequest,
    };

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        fullPayload: updatedPayload as object,
      },
    });

    await logAudit({ leadId: lead.id, action: "implementation_requested", actor: "user" });

    return NextResponse.json({
      success: true,
      message: "Implementation request submitted. Our team will reach out shortly.",
      nextSteps: [
        "Check your email for confirmation.",
        "A solutions architect will contact you within 1–2 business days.",
        "Prepare your cloud account details and current architecture for the call.",
      ],
    });
  } catch (e) {
    console.error("[cloud-operator request-implementation]", e);
    return NextResponse.json(
      { error: "Failed to submit implementation request" },
      { status: 500 }
    );
  }
}
