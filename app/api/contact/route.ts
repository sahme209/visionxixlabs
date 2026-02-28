import { NextRequest, NextResponse } from "next/server";

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

    // Validate required fields (message optional when source is free-review or cloud-health-snapshot)
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

    const safe = {
      name: escapeHtml(String(name)),
      email: escapeHtml(String(email)),
      company: escapeHtml(String(company || "Not provided")),
      topic: escapeHtml(String(topic || "Not specified")),
      companySize: escapeHtml(String(companySize || "Not specified")),
      cloudProvider: escapeHtml(String(cloudProvider || "Not specified")),
      mainConcern: escapeHtml(String(mainConcern || "Not specified")),
      setupMaturity: escapeHtml(String(setupMaturity || "Not specified")),
      message: escapeHtml(String(message || (isFreeReview ? "Free Cloud & AI Infrastructure Review request." : isCloudHealthSnapshot ? "Cloud Health Snapshot request." : ""))),
      source: escapeHtml(String(source || "contact")),
      aiUsageStatus: escapeHtml(String(aiUsageStatus || "Not specified")),
    };

    const emailSubject = safe.source === "free-review"
      ? `[Free Review] ${safe.company} – ${safe.name}`
      : safe.source === "cloud-health-snapshot"
        ? `[Cloud Health Snapshot] ${safe.company || safe.name} – ${safe.email}`
        : `Vision XIX Labs - Contact: ${safe.topic}`.slice(0, 255);

    // Format the email content (plain text)
    const emailContent = `
New Contact Form Submission${safe.source === "free-review" ? " (Free Cloud & AI Review)" : ""}

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
This email was sent from the Vision XIX Labs contact form${safe.source === "free-review" ? " (Free Review landing page)" : ""}.
    `.trim();

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const TO_EMAIL = process.env.CONTACT_EMAIL || "support@visionxixlabs.com";

    if (!RESEND_API_KEY) {
      console.log("Contact form submission (no API key configured):", { name, email, company, topic, message });
      return NextResponse.json(
        {
          error: "Email service not configured. Please set RESEND_API_KEY in your environment variables. For now, please email us directly at support@visionxixlabs.com",
          requiresSetup: true,
        },
        { status: 500 }
      );
    }

    // Resend: without a verified domain, use only onboarding@resend.dev (no display name).
    // After verifying your domain in Resend → Domains, set RESEND_FROM_EMAIL to e.g. contact@yourdomain.com
    const fromHeader =
      !FROM_EMAIL || FROM_EMAIL === "onboarding@resend.dev"
        ? "onboarding@resend.dev"
        : `Vision XIX Labs <${FROM_EMAIL}>`;

    // 1) Internal notification to us
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: fromHeader,
        to: [TO_EMAIL],
        reply_to: email,
        subject: emailSubject,
        text: emailContent,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5;">New Contact Form Submission</h2>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${safe.name}</p>
              <p><strong>Email:</strong> ${safe.email}</p>
              <p><strong>Company:</strong> ${safe.company}</p>
              <p><strong>Topic:</strong> ${safe.topic}</p>
              <p><strong>Company size:</strong> ${safe.companySize}</p>
              <p><strong>Cloud provider:</strong> ${safe.cloudProvider}</p>
              <p><strong>Main concern:</strong> ${safe.mainConcern}</p>
              <p><strong>Current setup maturity:</strong> ${safe.setupMaturity}</p>
              ${safe.source === "free-review" ? `<p><strong>AI usage status:</strong> ${safe.aiUsageStatus}</p>` : ""}
            </div>
            <div style="margin: 20px 0;">
              <h3 style="color: #334155;">Message:</h3>
              <p style="white-space: pre-wrap; background: #ffffff; padding: 15px; border-radius: 4px;">${safe.message}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #64748b; font-size: 12px;">This email was sent from the Vision XIX Labs contact form.</p>
          </div>
        `,
      }),
    });

    const errorBody = await resendResponse.text();
    const errorData = (() => {
      try {
        return JSON.parse(errorBody);
      } catch {
        return { message: errorBody || resendResponse.statusText };
      }
    })();

    if (!resendResponse.ok) {
      const resendMessage = errorData?.message ?? errorData?.msg ?? "";
      console.error("Resend API error:", { status: resendResponse.status, statusText: resendResponse.statusText, body: errorData });
      const payload: { error: string; resend_status?: number; resend_message?: string } = {
        error: "Email could not be sent. Please try again or email us at support@visionxixlabs.com.",
        resend_status: resendResponse.status,
        resend_message: typeof resendMessage === "string" ? resendMessage.slice(0, 200) : "",
      };
      if (resendResponse.status === 401) {
        payload.error = "Email service configuration error. Please contact support@visionxixlabs.com.";
      } else if (resendResponse.status === 422) {
        payload.error = "Email could not be sent (invalid configuration). Please email us directly at support@visionxixlabs.com.";
      } else if (resendResponse.status === 403) {
        payload.error = "Email service access denied. Check Resend dashboard: verify domain or use onboarding@resend.dev.";
      } else if (resendResponse.status === 429) {
        payload.error = "Too many requests. Please try again in a few minutes or email us at support@visionxixlabs.com.";
      }
      return NextResponse.json(payload, { status: 500 });
    }

    // 2) Confirmation email to the requester (best-effort; failures should not block success)
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
            "We’ve received your message and will review it shortly. We typically respond within 1–2 business days.\n\n" +
            "If you requested a cloud or security review, we’ll use the details you provided (company size, cloud provider, main concerns, and current setup) to prepare for the session.\n\n" +
            "If this was sent in error, you can ignore this message.\n",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #4f46e5;">Thanks for reaching out</h2>
              <p>Hi ${safe.name},</p>
              <p>We’ve received your message and will review it shortly. We typically respond within 1–2 business days.</p>
              <p>If you requested a cloud or security review, we’ll use the details you provided (company size, cloud provider, main concerns, and current setup) to prepare for the session.</p>
              <p style="font-size: 12px; color: #64748b;">If this wasn&apos;t intended for you, you can ignore this email.</p>
            </div>
          `,
        }),
      });
    } catch (confirmationError) {
      console.warn("Failed to send confirmation email:", confirmationError);
    }

    const data = (() => {
      try {
        return JSON.parse(errorBody);
      } catch {
        return {};
      }
    })();
    console.log("Email sent successfully:", data?.id ?? "ok");

    return NextResponse.json(
      { success: true, message: "Thank you for your message. We'll get back to you soon!" },
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
