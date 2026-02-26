import { NextRequest, NextResponse } from "next/server";
import { leadFormSchema } from "@/lib/leads/leadSchema";
import { estimatePricing } from "@/lib/leads/pricingEstimate";
import {
  sendLeadConfirmationEmail,
  sendLeadInternalNotification,
} from "@/lib/leads/leadEmailService";
import { createStarterToken } from "@/lib/leads/starterToken";
import { checkLeadsRateLimit, getClientIp } from "@/lib/leads/rateLimit";
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

  const ip = getClientIp(req);
  const { ok: rateOk, remaining } = checkLeadsRateLimit(ip);
  if (!rateOk) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } }
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

    // Token for secure starter package access (AI generation via POST /starter/generate)
    let starterToken: string | undefined;
    try {
      starterToken = createStarterToken(lead.id);
    } catch (e) {
      console.warn("[Leads API] STARTER_TOKEN_SECRET not set, starter access disabled");
    }

    // Emails never block success — send in background, log failures safely
    try {
      const [confirmOk, notifyOk] = await Promise.all([
        sendLeadConfirmationEmail(data, estimate, lead.id, starterToken),
        sendLeadInternalNotification(data, estimate),
      ]);
      if (!confirmOk) console.warn("[Leads API] Confirmation email failed (lead saved)");
      if (!notifyOk) console.warn("[Leads API] Internal notification failed (lead saved)");
    } catch (emailErr) {
      console.warn("[Leads API] Email send error (lead saved):", emailErr instanceof Error ? emailErr.message : String(emailErr));
    }

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      starterToken: starterToken ?? undefined,
      estimate: { min: estimate.min, max: estimate.max, breakdown: estimate.breakdown },
    }, { headers: { "X-RateLimit-Remaining": String(remaining) } });
  } catch (e) {
    console.error("[Leads API] Database error:", e);
    return NextResponse.json(
      { error: "Failed to save request. Please try again." },
      { status: 500 }
    );
  }
}
