/**
 * Cron: Send trial-ending-soon emails (24 hours before trial ends).
 * Schedule: Run daily (e.g. 10:00 AM UTC via Vercel Cron).
 * Protection: CRON_SECRET in Authorization or query param.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminAuth } from "@/lib/firebase-admin";
import { sendTrialReminderEmail } from "@/lib/services/emailService";

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    const providedSecret =
      authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : request.nextUrl.searchParams.get("secret");

    if (cronSecret && providedSecret !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminDb = getAdminDb();
    const adminAuth = getAdminAuth();
    const now = new Date();
    const in24h = new Date(now.getTime() + TWENTY_FOUR_HOURS_MS);

    const subsSnap = await adminDb
      .collection("subscriptions")
      .where("status", "==", "trialing")
      .get();

    const sent: string[] = [];
    const failed: string[] = [];
    const errors: string[] = [];

    for (const doc of subsSnap.docs) {
      const data = doc.data();
      const trialEnd = data.trialEnd?.toDate?.() ?? data.trialEnd;
      const trialReminderSentAt = data.trialReminderSentAt?.toDate?.() ?? data.trialReminderSentAt;

      if (!trialEnd) continue;

      const trialEndDate = trialEnd instanceof Date ? trialEnd : new Date(trialEnd);
      if (trialEndDate <= now || trialEndDate > in24h) continue;
      if (trialReminderSentAt) continue; // Already sent

      let email: string | null = null;
      let displayName: string | undefined;
      try {
        const authUser = await adminAuth.getUser(doc.id);
        email = authUser.email || null;
        displayName = authUser.displayName || undefined;
      } catch {
        errors.push(`User ${doc.id}: no auth record`);
        continue;
      }

      if (!email) continue;

      const ok = await sendTrialReminderEmail({
        email,
        name: displayName || undefined,
      });

      if (ok) {
        sent.push(doc.id);
        await adminDb.collection("subscriptions").doc(doc.id).set(
          { trialReminderSentAt: new Date() },
          { merge: true }
        );
      } else {
        failed.push(doc.id);
        errors.push(`Failed to send to ${doc.id}`);
      }
    }

    return NextResponse.json({
      success: true,
      sent: sent.length,
      failed: failed.length,
      errors: errors.slice(0, 10),
    });
  } catch (error: any) {
    console.error("[Cron] Trial reminder error:", error);
    return NextResponse.json(
      { error: "Trial reminder failed", message: error?.message },
      { status: 500 }
    );
  }
}
