import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/security/secretRedaction";
import { checkRateLimit } from "@/lib/rateLimit";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 240;
const MAX_MESSAGE_LENGTH = 8_000;

function normalized(value: unknown, maxLength = MAX_FIELD_LENGTH): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

async function sendResend(apiKey: string, payload: object): Promise<boolean> {
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
    return response.ok;
  } catch (error) {
    console.warn("[Contact] Email delivery request failed:", error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "anon";
  if (!checkRateLimit(`contact:${ip}`)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 }
    );
  }
  try {
    const body = await request.json();
    const {
      name,
      email,
      company,
      topic,
      companySize,
      cloudProvider,
      mainConcern,
      setupMaturity,
      message,
      source,
      aiUsageStatus,
      website,
    } = body;

    // Hidden honeypot. Return a neutral response so bots cannot tune around it.
    if (normalized(website)) {
      return NextResponse.json({ success: true, accepted: false }, { status: 200 });
    }

    const isFreeReview = source === "free-review";
    const isCloudHealthSnapshot = source === "cloud-health-snapshot";
    const cleanName = normalized(name);
    const cleanEmail = normalized(email).toLowerCase();
    const cleanMessage = normalized(message, MAX_MESSAGE_LENGTH);
    if (!cleanName || !cleanEmail) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }
    if (!isFreeReview && !isCloudHealthSnapshot && !cleanMessage) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const rawMessage = cleanMessage || (isFreeReview ? "Free Cloud & AI Infrastructure Review request." : isCloudHealthSnapshot ? "Cloud Health Snapshot request." : "");
    const redactedMessage = redactSecrets(rawMessage);

    const safe = {
      name: escapeHtml(cleanName),
      email: escapeHtml(cleanEmail),
      company: escapeHtml(normalized(company) || "Not provided"),
      topic: escapeHtml(normalized(topic) || "Not specified"),
      companySize: escapeHtml(normalized(companySize) || "Not specified"),
      cloudProvider: escapeHtml(normalized(cloudProvider) || "Not specified"),
      mainConcern: escapeHtml(normalized(mainConcern) || "Not specified"),
      setupMaturity: escapeHtml(normalized(setupMaturity) || "Not specified"),
      message: escapeHtml(redactedMessage),
      source: escapeHtml(normalized(source) || "contact"),
      aiUsageStatus: escapeHtml(normalized(aiUsageStatus) || "Not specified"),
    };

    const lead = await prisma.lead.create({
      data: {
        email: safe.email,
        name: safe.name,
        source: "contact",
        status: "created",
        fullPayload: {
          name: safe.name,
          email: safe.email,
          company: safe.company,
          topic: safe.topic,
          companySize: safe.companySize,
          cloudProvider: safe.cloudProvider,
          mainConcern: safe.mainConcern,
          setupMaturity: safe.setupMaturity,
          message: safe.message,
          source: safe.source,
          aiUsageStatus: safe.aiUsageStatus,
        } as object,
      },
    });

    await prisma.agentJob.create({
      data: {
        leadId: lead.id,
        type: "CONTACT_RESOLUTION",
        status: "pending",
        runAt: new Date(),
      },
    });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const TO_EMAIL = process.env.CONTACT_EMAIL || "support@visionxixlabs.com";

    let delivery: "sent" | "failed" | "not_configured" = "not_configured";
    if (RESEND_API_KEY) {
      const emailSubject = safe.source === "free-review"
        ? `[Free Review] ${safe.company} – ${safe.name}`
        : safe.source === "cloud-health-snapshot"
          ? `[Cloud Health Snapshot] ${safe.company || safe.name} – ${safe.email}`
          : `Vision XIX Labs - Contact: ${safe.topic}`.slice(0, 255);

      const emailContent = `
New Contact Form Submission${safe.source === "free-review" ? " (Free Cloud & AI Review)" : ""}
Automated resolution agent queued.

Name: ${safe.name}
Email: ${safe.email}
Company: ${safe.company}
Topic: ${safe.topic}
Company size: ${safe.companySize}
Cloud provider: ${safe.cloudProvider}
Main concern: ${safe.mainConcern}
Current setup maturity: ${safe.setupMaturity}
${safe.source === "free-review" ? `AI usage status: ${safe.aiUsageStatus}\n` : ""}

Message:
${safe.message}

---
Lead ID: ${lead.id}
      `.trim();

      const fromHeader =
        !FROM_EMAIL || FROM_EMAIL === "onboarding@resend.dev"
          ? "onboarding@resend.dev"
          : `Vision XIX Labs <${FROM_EMAIL}>`;

      const internalSent = await sendResend(RESEND_API_KEY, {
        from: fromHeader,
        to: [TO_EMAIL],
        reply_to: safe.email,
        subject: emailSubject,
        text: emailContent,
      });
      delivery = internalSent ? "sent" : "failed";

      await sendResend(RESEND_API_KEY, {
        from: fromHeader,
        to: [safe.email],
        subject: "Vision XIX Labs received your message",
        text:
          `Your message was recorded with reference ${lead.id}.\n\n` +
          "This confirmation does not promise a response time or support entitlement. " +
          "For download help, you can also email support@visionxixlabs.com.\n",
      });
    } else {
      console.warn("[Contact] RESEND_API_KEY not configured; emails not sent");
    }

    return NextResponse.json(
      {
        success: true,
        accepted: true,
        referenceId: lead.id,
        delivery,
        message: "Your message was recorded.",
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request. Please try again or email us directly at support@visionxixlabs.com." },
      { status: 500 }
    );
  }
}
