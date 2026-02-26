import { NextRequest, NextResponse } from "next/server";
import { sendWeeklySummaryEmails } from "@/lib/services/weeklySummaryEmailService";

/**
 * Cron endpoint: Send weekly summary emails to opted-in users.
 * Schedule: Every Monday 9:00 AM UTC (e.g. via Vercel Cron)
 *
 * Protection: Requires CRON_SECRET in Authorization header or query param.
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : request.nextUrl.searchParams.get("secret");

    if (cronSecret && providedSecret !== cronSecret) {
      console.warn("[Cron] Unauthorized weekly-summary request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await sendWeeklySummaryEmails();

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors.slice(0, 5),
    });
  } catch (error) {
    console.error("[Cron] Weekly summary error:", error);
    return NextResponse.json(
      {
        error: "Failed to send weekly summaries",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
