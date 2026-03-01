import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { redactSecrets } from "@/lib/security/secretRedaction";

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
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
    } = body;

    const isFreeReview = source === "free-review";
    const isCloudHealthSnapshot = source === "cloud-health-snapshot";
    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }
    if (!isFreeReview && !isCloudHealthSnapshot && !message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const rawMessage = String(message || (isFreeReview ? "Free Cloud & AI Infrastructure Review request." : isCloudHealthSnapshot ? "Cloud Health Snapshot request." : ""));
    const redactedMessage = redactSecrets(rawMessage);

    const safe = {
      name: escapeHtml(String(name)),
      email: escapeHtml(String(email)),
      company: escapeHtml(String(company || "Not provided")),
      topic: escapeHtml(String(topic || "Not specified")),
      companySize: escapeHtml(String(companySize || "Not specified")),
      cloudProvider: escapeHtml(String(cloudProvider || "Not specified")),
      mainConcern: escapeHtml(String(mainConcern || "Not specified")),
      setupMaturity: escapeHtml(String(setupMaturity || "Not specified")),
      message: escapeHtml(redactedMessage),
      source: escapeHtml(String(source || "contact")),
      aiUsageStatus: escapeHtml(String(aiUsageStatus || "Not specified")),
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

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: fromHeader,
            to: [TO_EMAIL],
            reply_to: safe.email,
            subject: emailSubject,
            text: emailContent,
          }),
        });
      } catch (e) {
        console.warn("[Contact] Failed to send internal notification:", e);
      }

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: fromHeader,
            to: [safe.email],
            subject: "Thanks for reaching out to Vision XIX Labs",
            text:
              "Thank you for contacting Vision XIX Labs.\n\n" +
              "We've received your message. Our AI resolution system is reviewing it and will respond shortly—often within minutes for common requests.\n\n" +
              "If you requested a cloud or security review, we'll use the details you provided to prepare the best response.\n\n" +
              "If this was sent in error, you can ignore this message.\n",
          }),
        });
      } catch {
        // best-effort confirmation
      }
    } else {
      console.warn("[Contact] RESEND_API_KEY not configured; emails not sent");
    }

    return NextResponse.json(
      {
        success: true,
        message: "Thank you for your message. Our AI resolution system is reviewing it and will respond shortly.",
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
