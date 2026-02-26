import { NextRequest, NextResponse } from "next/server";
import { leadFormSchema } from "@/lib/leads/leadSchema";
import { estimatePricing } from "@/lib/leads/pricingEstimate";
import {
  sendLeadConfirmationEmail,
  sendLeadInternalNotification,
} from "@/lib/leads/leadEmailService";
import { createStarterToken } from "@/lib/leads/starterToken";
import { prisma } from "@/lib/db";

const MIN_COMPLETION_MS = 10_000; // 10 seconds minimum

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    console.warn("[Leads API] Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = leadFormSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((e) => e.message).join("; ");
    console.warn("[Leads API] Validation failed:", msg);
    return NextResponse.json(
      { error: "Validation failed", details: msg },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Honeypot
  if (data._honeypot && data._honeypot.length > 0) {
    console.warn("[Leads API] Honeypot triggered");
    return NextResponse.json({ success: true });
  }

  // Minimum completion time
  const startTime = data._startTime ?? 0;
  const elapsed = Date.now() - startTime;
  if (elapsed < MIN_COMPLETION_MS) {
    console.warn("[Leads API] Submission too fast (possible bot):", elapsed, "ms");
    return NextResponse.json(
      { error: "Submission too quick. Please wait and try again." },
      { status: 429 }
    );
  }

  const estimate = estimatePricing(data);
  const fullPayload = { ...data, _honeypot: undefined, _startTime: undefined };

  try {
    const lead = await prisma.lead.create({
      data: {
        name: data.fullName,
        email: data.email.trim().toLowerCase(),
        phone: data.phone?.trim() || null,
        fullPayload: fullPayload as object,
        status: "new",
        source: "website-request",
      },
    });

    let starterToken = "";
    try {
      starterToken = createStarterToken(lead.id);
    } catch {
      // STARTER_TOKEN_SECRET not set; token omitted, thank-you page will work without preview
    }

    const [confirmOk, notifyOk] = await Promise.all([
      sendLeadConfirmationEmail(data, estimate, {
        leadId: lead.id,
        starterToken: starterToken || undefined,
      }),
      sendLeadInternalNotification(data, estimate),
    ]);
    if (!confirmOk) console.warn("[Leads API] Confirmation email failed");
    if (!notifyOk) console.warn("[Leads API] Internal notification failed");

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      starterToken: starterToken || undefined,
      estimate: { min: estimate.min, max: estimate.max, breakdown: estimate.breakdown },
    });
  } catch (e) {
    console.error("[Leads API] Database error:", e);
    return NextResponse.json(
      { error: "Failed to save request. Please try again." },
      { status: 500 }
    );
  }
}
