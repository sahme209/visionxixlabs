import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyStarterToken } from "@/lib/starterToken";
import { executiveSummaryEmail } from "@/lib/axiom/emailTemplates";
import { Resend } from "resend";

/**
 * Phase 8: POST /api/cloud-operator/send-report?token=XXX
 * Sends executive summary email. Only if email configured (RESEND_API_KEY).
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email not configured. Contact support." },
      { status: 503 }
    );
  }

  const lead = await prisma.lead.findUnique({ where: { id: result.leadId } });
  if (!lead || lead.source !== "cloud-operator") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};
  const axiomResult = payload.axiomResult as {
    scores?: { infrastructureScore?: number; estimatedAnnualSavings?: number | null; riskExposureLevel?: string };
    driftSignals?: { hasDrift?: boolean };
  } | undefined;
  const scores = axiomResult?.scores ?? {};
  const operatorOutput = payload.operatorOutput as { business?: { recommendedNextAction?: string } } | undefined;

  const snapshots = await prisma.axiomScoreSnapshot.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: "desc" },
    take: 2,
  });
  const [current, prev] = snapshots;
  const savingsDelta =
    current?.estimatedAnnualSavings != null && prev?.estimatedAnnualSavings != null
      ? current.estimatedAnnualSavings - prev.estimatedAnnualSavings
      : null;
  const riskDelta =
    current?.riskExposureLevel && prev?.riskExposureLevel && current.riskExposureLevel !== prev.riskExposureLevel
      ? `${prev.riskExposureLevel} → ${current.riskExposureLevel}`
      : null;

  const emailContent = executiveSummaryEmail({
    infrastructureScore: scores.infrastructureScore ?? null,
    savingsDelta,
    riskDelta,
    driftDetected: axiomResult?.driftSignals?.hasDrift ?? false,
    topAction: operatorOutput?.business?.recommendedNextAction ?? "Review your 30-day roadmap.",
  });

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM || "Axiom <onboarding@resend.dev>";
  const { data, error } = await resend.emails.send({
    from,
    to: lead.email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
  });

  if (error) {
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
  return NextResponse.json({ success: true, id: data?.id });
}
