import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/services/emailService";

/**
 * API route to send welcome email to new users
 * POST /api/send-welcome-email
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    console.log("[API] Received welcome email request for:", email);

    if (!email) {
      console.error("[API] ❌ Email is required");
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error("[API] ❌ Invalid email format:", email);
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Check if Resend API key is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("[API] ❌ RESEND_API_KEY not configured in environment variables");
      console.error("[API] Please add RESEND_API_KEY to your .env.local file");
      return NextResponse.json(
        { 
          error: "Email service not configured",
          message: "RESEND_API_KEY environment variable is missing. Please configure it in .env.local"
        },
        { status: 500 }
      );
    }

    // Send welcome email
    console.log("[API] Calling sendWelcomeEmail...");
    const success = await sendWelcomeEmail({
      email,
      name: name || undefined,
    });

    if (success) {
      console.log("[API] ✅ Welcome email sent successfully");
      return NextResponse.json(
        { message: "Welcome email sent successfully" },
        { status: 200 }
      );
    } else {
      console.error("[API] ❌ Failed to send welcome email (check logs above for details)");
      // Return error so we can see it in the client
      return NextResponse.json(
        { 
          error: "Failed to send welcome email",
          message: "Email service returned false. Check server logs for details."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API] ❌ Exception in welcome email API:", error);
    if (error instanceof Error) {
      console.error("[API] Error message:", error.message);
      console.error("[API] Error stack:", error.stack);
    }
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
