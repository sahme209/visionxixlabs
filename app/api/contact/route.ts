import { NextRequest, NextResponse } from "next/server";

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

    // Format the email content
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

    // Using Resend for email sending
    // Get your API key from https://resend.com/api-keys
    // Add it to your .env.local file as: RESEND_API_KEY=your_key_here
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const TO_EMAIL = process.env.CONTACT_EMAIL || "support@visionxixlabs.com";

    if (!RESEND_API_KEY) {
      // Fallback: Log the submission (for development)
      console.log("Contact form submission (no API key configured):", {
        name,
        email,
        company,
        topic,
        message,
      });
      
      // In production, you should set up Resend API key
      // For now, return success but log a warning
      console.warn("RESEND_API_KEY not configured. Email not sent. Please configure Resend API key.");
      
      return NextResponse.json(
        { 
          success: true,
          message: "Thank you for your message. We'll get back to you soon!" 
        },
        { status: 200 }
      );
    }

    // Send email using Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `Vision XIX Labs Contact Form <${FROM_EMAIL}>`,
        to: [TO_EMAIL],
        replyTo: email,
        subject: `Vision XIX Labs - Contact Form: ${topic || "General Inquiry"}`,
        text: emailContent,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4f46e5;">New Contact Form Submission</h2>
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>Email:</strong> ${email}</p>
              <p><strong>Company:</strong> ${company || "Not provided"}</p>
              <p><strong>Topic:</strong> ${topic || "Not specified"}</p>
            </div>
            <div style="margin: 20px 0;">
              <h3 style="color: #334155;">Message:</h3>
              <p style="white-space: pre-wrap; background: #ffffff; padding: 15px; border-radius: 4px;">${message}</p>
            </div>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="color: #64748b; font-size: 12px;">
              This email was sent from the Vision XIX Labs contact form.
            </p>
          </div>
        `,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json().catch(() => ({}));
      console.error("Resend API error:", errorData);
      throw new Error("Failed to send email");
    }

    const data = await resendResponse.json();

    return NextResponse.json(
      { 
        success: true,
        message: "Thank you for your message. We'll get back to you soon!" 
      },
      { status: 200 }
    );

  } catch (error) {
    console.error("Contact form error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request. Please try again or email us directly at support@visionxixlabs.com" },
      { status: 500 }
    );
  }
}
