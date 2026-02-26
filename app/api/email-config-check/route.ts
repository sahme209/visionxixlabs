import { NextRequest, NextResponse } from "next/server";

/**
 * Diagnostic endpoint to check email service configuration
 * GET /api/email-config-check
 * 
 * This endpoint helps diagnose email configuration issues
 * without exposing sensitive information
 */
export async function GET(request: NextRequest) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    
    const config = {
      hasResendApiKey: !!resendApiKey,
      resendApiKeyLength: resendApiKey?.length || 0,
      resendApiKeyPrefix: resendApiKey?.substring(0, 3) || "N/A",
      hasResendFromEmail: !!resendFromEmail,
      resendFromEmail: resendFromEmail || "Not set (will use default)",
      nextPublicBaseUrl: process.env.NEXT_PUBLIC_BASE_URL || "Not set (will use default)",
    };

    // Check if configuration is valid
    const isValid = config.hasResendApiKey && 
                    config.resendApiKeyLength > 0 && 
                    config.resendApiKeyPrefix === "re_";

    return NextResponse.json({
      status: isValid ? "configured" : "missing_config",
      message: isValid 
        ? "Email service is properly configured" 
        : "Email service is not properly configured. Please check your environment variables.",
      config: {
        ...config,
        // Don't expose the full API key
        resendApiKey: config.hasResendApiKey ? `${config.resendApiKeyPrefix}...` : "Not set",
      },
      instructions: !isValid ? {
        step1: "Add RESEND_API_KEY to your .env.local file",
        step2: "Get your API key from https://resend.com/api-keys",
        step3: "Format: RESEND_API_KEY=re_xxxxxxxxxxxxx",
        step4: "Restart your development server after adding the variable",
      } : undefined,
    }, { status: isValid ? 200 : 500 });
  } catch (error) {
    console.error("[API] Error checking email config:", error);
    return NextResponse.json(
      { 
        status: "error",
        message: "Error checking email configuration",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
