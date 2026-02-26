import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { SUPPORT_EMAIL } from "@/lib/constants/company";

export async function POST(req: NextRequest) {
  let body: { email: string; name?: string; message?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const name = String(body.name || "").trim().slice(0, 200);
  const message = String(body.message || "").trim().slice(0, 2000);
  const source = String(body.source || "ai-assistant").slice(0, 50);

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !resendApiKey.startsWith("re_")) {
    return NextResponse.json(
      { error: "Lead capture is not configured. Please try emailing us directly." },
      { status: 503 }
    );
  }

  const client = new Resend(resendApiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL || `Vision XIX Labs <${SUPPORT_EMAIL}>`;

  const subject = `[Vision XIX AI Lead] ${name || "New lead"} — ${source}`;
  const html = `
    <h2>New lead from Vision XIX Labs AI</h2>
    <p><strong>Email:</strong> ${email}</p>
    ${name ? `<p><strong>Name:</strong> ${name}</p>` : ""}
    <p><strong>Source:</strong> ${source}</p>
    ${message ? `<p><strong>Message:</strong></p><pre>${message}</pre>` : ""}
    <p><em>Sent via Vision XIX Labs AI lead capture</em></p>
  `;

  try {
    const result = await client.emails.send({
      from: fromEmail,
      replyTo: email,
      to: SUPPORT_EMAIL,
      subject,
      html,
    });

    if (result.error) {
      console.error("[VisionXIX Lead] Resend error:", result.error);
      return NextResponse.json(
        { error: "Failed to submit. Please try emailing us directly." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[VisionXIX Lead] Error:", e);
    return NextResponse.json(
      { error: "Something went wrong. Please try again or email us directly." },
      { status: 500 }
    );
  }
}
