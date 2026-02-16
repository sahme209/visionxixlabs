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
    const { name, email, company, topic, message } = body;

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required" },
        { status: 400 }
      );
    }

    const safe = {
      name: escapeHtml(String(name)),
      email: escapeHtml(String(email)),
      company: escapeHtml(String(company || "Not provided")),
      topic: escapeHtml(String(topic || "Not specified")),
      message: escapeHtml(String(message)),
    };

    // Format the email content (plain text)
    const emailContent = `
New Contact Form Submission

Name: ${name}
Email: ${email}
Company: ${company || "Not provided"}
Topic: ${topic || "Not specified"}

Message:
${message}

---
This email was sent from the Vision XIX Labs contact form.
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

    // Resend free tier: "from" must be onboarding@resend.dev or a verified domain
    const fromHeader = FROM_EMAIL === "onboarding@resend.dev"
      ? "Vision XIX Labs <onboarding@resend.dev>"
      : `Vision XIX Labs <${FROM_EMAIL}>`;

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
        subject: `Vision XIX Labs - Contact: ${topic || "General Inquiry"}`.slice(0, 255),
        text: emailContent,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5;">New Contact Form Submission</h2>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${safe.name}</p>
              <p><strong>Email:</strong> ${safe.email}</p>
              <p><strong>Company:</strong> ${safe.company}</p>
              <p><strong>Topic:</strong> ${safe.topic}</p>
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
      console.error("Resend API error:", { status: resendResponse.status, statusText: resendResponse.statusText, body: errorData });
      const msg = errorData?.message ?? errorData?.msg ?? resendResponse.statusText;
      if (resendResponse.status === 401) {
        return NextResponse.json(
          { error: "Email service configuration error. Please contact support@visionxixlabs.com." },
          { status: 500 }
        );
      }
      if (resendResponse.status === 422) {
        return NextResponse.json(
          { error: "Email could not be sent (invalid configuration). Please email us directly at support@visionxixlabs.com." },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: "Email could not be sent. Please try again or email us at support@visionxixlabs.com." },
        { status: 500 }
      );
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
