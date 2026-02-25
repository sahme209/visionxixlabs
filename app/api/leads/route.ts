import { NextRequest, NextResponse } from "next/server";
import { leadFormSchema } from "@/lib/leads/leadSchema";
import { estimatePricing } from "@/lib/leads/pricingEstimate";
import {
  sendLeadConfirmationEmail,
  sendLeadInternalNotification,
} from "@/lib/leads/leadEmailService";
import { generateWebsiteStarterPackage } from "@/lib/leads/aiWebsiteStarter";
import { checkLeadsRateLimit, getClientIp } from "@/lib/leads/rateLimit";
import { prisma } from "@/lib/db";

const MIN_COMPLETION_MS = 10_000; // 10 seconds minimum

async function triggerAiStarterPackage(leadId: string, data: Record<string, unknown>) {
  try {
    const pkg = await generateWebsiteStarterPackage(data as Parameters<typeof generateWebsiteStarterPackage>[0]);
    const fullPayload = (await prisma.lead.findUnique({ where: { id: leadId }, select: { fullPayload: true } }))
      ?.fullPayload as Record<string, unknown> | null;
    const merged = { ...fullPayload, aiStarterPackage: pkg, aiStarterError: false };
    await prisma.lead.update({ where: { id: leadId }, data: { fullPayload: merged } });
  } catch (e) {
    console.warn("[Leads API] AI Starter Package generation failed:", e instanceof Error ? e.message : String(e));
    const fullPayload = (await prisma.lead.findUnique({ where: { id: leadId }, select: { fullPayload: true } }))
      ?.fullPayload as Record<string, unknown> | null;
    const merged = { ...fullPayload, aiStarterError: true };
    await prisma.lead.update({ where: { id: leadId }, data: { fullPayload: merged } });
  }
}

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

    // Emails never block success — send in background, log failures safely
    try {
      const [confirmOk, notifyOk] = await Promise.all([
        sendLeadConfirmationEmail(data, estimate, lead.id),
        sendLeadInternalNotification(data, estimate),
      ]);
      if (!confirmOk) console.warn("[Leads API] Confirmation email failed (lead saved)");
      if (!notifyOk) console.warn("[Leads API] Internal notification failed (lead saved)");
    } catch (emailErr) {
      console.warn("[Leads API] Email send error (lead saved):", emailErr instanceof Error ? emailErr.message : String(emailErr));
    }

    // Non-blocking: trigger AI Starter Package generation (fire-and-forget)
    triggerAiStarterPackage(lead.id, data as Record<string, unknown>).catch(() => {});

    return NextResponse.json({
      success: true,
      leadId: lead.id,
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
