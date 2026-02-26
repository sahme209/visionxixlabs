import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeEmail } from "@/lib/services/emailService";

/**
 * Test endpoint to verify email sending works
 * POST /api/test-email
 * 
 * Body: { "email": "test@example.com", "name": "Test User" }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name } = body;

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    console.log("[Test Email API] Testing email send to:", email);

    // Send test email
    const success = await sendWelcomeEmail({
      email,
      name: name || "Test User",
    });

    if (success) {
      return NextResponse.json(
        { 
          success: true,
          message: "Test email sent successfully! Check your inbox (and spam folder)."
        },
        { status: 200 }
      );
    } else {
      return NextResponse.json(
        { 
          success: false,
          error: "Failed to send test email. Check server logs for details."
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Test Email API] Exception:", error);
    return NextResponse.json(
      { 
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
