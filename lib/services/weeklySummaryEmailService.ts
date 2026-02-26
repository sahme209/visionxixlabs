/**
 * Weekly Summary Email Service
 * Sends personalized weekly digest to opted-in users via Resend.
 */

import { getAdminDb, getAdminAuth } from "../firebase-admin";
import { Resend } from "resend";
import { Timestamp } from "firebase-admin/firestore";
import { isCountryAffectedByPause } from "../data/visaPauseCountries";

const COLLECTION_I130 = "i130Approvals";
const COLLECTION_I129F = "i129fApprovals";

interface UserProfile {
  formType: string;
  priorityDate: string;
  country: string;
  serviceCenter?: string;
}

interface WeeklyEmailRecipient {
  uid: string;
  email: string;
  displayName?: string;
  profile: UserProfile | null;
}

interface WeekStats {
  totalApprovals: number;
  totalRFEs: number;
  avgProcessingDays: number;
  approvalsPerDay: number;
  similarApprovals: number;
  percentile?: number;
  percentileChange?: number;
}

interface VisaPauseInfo {
  affected: boolean;
  recoveryRate?: number;
  daysSincePause?: number;
  estimatedRecovery?: string;
}

interface ApprovalDocument {
  id: string;
  beneficiaryCountry?: string;
  country?: string;
  countryOfOrigin?: string;
  serviceCenter?: string;
  casePrefixServiceCenter?: string;
  status?: string;
  approvalDate?: any;
  priorityDate?: any;
  formType?: string;
  [key: string]: any; // Allow other properties from Firestore
}

async function getUsersWithWeeklyEmailEnabled(): Promise<WeeklyEmailRecipient[]> {
  const db = getAdminDb();
  const auth = getAdminAuth();

  const usersSnap = await db.collection("users")
    .where("weeklySummaryEmailEnabled", "==", true)
    .get();

  const recipients: WeeklyEmailRecipient[] = [];

  for (const doc of usersSnap.docs) {
    const uid = doc.id;
    let email: string | null = null;
    let displayName: string | undefined;

    try {
      const authUser = await auth.getUser(uid);
      email = authUser.email || null;
      displayName = authUser.displayName || undefined;
    } catch {
      continue; // Skip if we can't get auth user
    }

    if (!email) continue;

    const profileSnap = await db.collection("userProfiles").doc(uid).get();
    const profileData = profileSnap.data();
    const profile: UserProfile | null = profileSnap.exists && profileData
      ? {
          formType: profileData.formType || "I-130",
          priorityDate: profileData.priorityDate || "",
          country: profileData.country || "",
          serviceCenter: profileData.serviceCenter || "",
        }
      : null;

    recipients.push({
      uid,
      email,
      displayName,
      profile,
    });
  }

  return recipients;
}

async function fetchApprovalsForWeek(
  formType: string,
  startDate: Date,
  endDate: Date,
  country?: string,
  serviceCenter?: string
): Promise<ApprovalDocument[]> {
  const db = getAdminDb();
  const collectionName = formType === "I-129F" ? COLLECTION_I129F : COLLECTION_I130;

  try {
    const startTs = Timestamp.fromDate(startDate);
    const endTs = Timestamp.fromDate(endDate);
    const q = db.collection(collectionName)
      .where("formType", "==", formType)
      .where("approvalDate", ">=", startTs)
      .where("approvalDate", "<=", endTs)
      .orderBy("approvalDate", "desc")
      .limit(2000);

    const snapshot = await q.get();
    let approvals: ApprovalDocument[] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalDocument));

    if (country) {
      const norm = (s: string) => (s || "").toLowerCase().trim();
      const cNorm = norm(country);
      approvals = approvals.filter((a) => {
        const bc = norm(a.beneficiaryCountry || a.country || a.countryOfOrigin || "");
        return bc && (bc.includes(cNorm) || cNorm.includes(bc));
      });
    }
    if (serviceCenter) {
      const norm = (s: string) => (s || "").toLowerCase().trim();
      const scNorm = norm(serviceCenter);
      approvals = approvals.filter((a) => {
        const sc = norm(a.serviceCenter || a.casePrefixServiceCenter || "");
        return sc && (sc.includes(scNorm) || scNorm.includes(sc));
      });
    }

    return approvals;
  } catch (error) {
    console.error("[WeeklyEmail] Error fetching approvals (fallback):", error);
    try {
      const fallbackSnap = await db.collection(collectionName)
        .where("formType", "==", formType)
        .orderBy("approvalDate", "desc")
        .limit(3000)
        .get();
      const all: ApprovalDocument[] = fallbackSnap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalDocument));
      const toDate = (v: any) => (v?.toDate ? v.toDate() : new Date(v));
      return all.filter((a) => {
        const ad = toDate(a.approvalDate);
        return ad >= startDate && ad <= endDate;
      });
    } catch (e) {
      console.error("[WeeklyEmail] Fallback also failed:", e);
      return [];
    }
  }
}

async function computeWeekStats(
  profile: UserProfile | null | undefined,
  startDate: Date,
  endDate: Date
): Promise<WeekStats> {
  const formType = profile?.formType || "I-130";
  const approvals = await fetchApprovalsForWeek(
    formType,
    startDate,
    endDate,
    profile?.country,
    profile?.serviceCenter
  );

  const approved = approvals.filter((a) => (a.status || "approved") === "approved");
  const rfe = approvals.filter((a) => a.status === "rfe");

  let avgProcessingDays = 0;
  const withDays = approvals.filter((a) => {
    const ad = a.approvalDate?.toDate?.() ?? new Date(a.approvalDate);
    const pd = a.priorityDate?.toDate?.() ?? new Date(a.priorityDate);
    return ad && pd;
  });
  if (withDays.length > 0) {
    const total = withDays.reduce((sum, a) => {
      const ad = a.approvalDate?.toDate?.() ?? new Date(a.approvalDate);
      const pd = a.priorityDate?.toDate?.() ?? new Date(a.priorityDate);
      return sum + Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    avgProcessingDays = Math.round(total / withDays.length);
  }

  const daysInRange = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const approvalsPerDay = approved.length / daysInRange;

  return {
    totalApprovals: approved.length,
    totalRFEs: rfe.length,
    avgProcessingDays,
    approvalsPerDay: Math.round(approvalsPerDay * 10) / 10,
    similarApprovals: profile
      ? (await fetchApprovalsForWeek(formType, startDate, endDate, profile.country, profile.serviceCenter))
          .filter((a) => (a.status || "approved") === "approved").length
      : approved.length,
  };
}

async function getVisaPauseInfo(country: string): Promise<VisaPauseInfo> {
  if (!country || !isCountryAffectedByPause(country)) {
    return { affected: false };
  }
  try {
    const { VisaPauseService } = await import("./visaPauseService");
    const metrics = await VisaPauseService.getRecoveryMetrics();
    return {
      affected: true,
      recoveryRate: metrics.recoveryRate,
      daysSincePause: metrics.daysSincePause,
      estimatedRecovery: metrics.estimatedFullRecovery
        ? metrics.estimatedFullRecovery.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : undefined,
    };
  } catch {
    return { affected: true };
  }
}

function generateWeeklyEmailHTML(
  userName: string,
  weekStart: string,
  weekEnd: string,
  stats: WeekStats,
  visaPause: VisaPauseInfo,
  baseUrl: string
): string {
  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const visaPauseSection = visaPause.affected
    ? `
    <div style="background: linear-gradient(135deg, #1d1d1f 0%, #0071e3 100%); padding: 20px; border-radius: 8px; margin: 20px 0; color: #fff;">
      <h3 style="margin: 0 0 12px; font-size: 16px; font-weight: 600;">📋 Visa Pause Update</h3>
      <p style="margin: 0 0 8px; font-size: 14px; opacity: 0.95;">Recovery rate: <strong>${visaPause.recoveryRate ?? "—"}%</strong></p>
      ${visaPause.daysSincePause != null ? `<p style="margin: 0 0 8px; font-size: 14px; opacity: 0.95;">Days since pause: <strong>${visaPause.daysSincePause}</strong></p>` : ""}
      ${visaPause.estimatedRecovery ? `<p style="margin: 0; font-size: 14px; opacity: 0.95;">Est. full recovery: <strong>${visaPause.estimatedRecovery}</strong></p>` : ""}
    </div>
  `
    : "";

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table role="presentation" style="width:100%;border-collapse:collapse;background:#f5f5f5;">
    <tr><td align="center" style="padding:40px 20px;">
      <table role="presentation" style="max-width:600px;width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 4px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0071e3 0%,#0066cc 100%);padding:32px 24px;text-align:center;border-left:4px solid #42a1ec;">
            <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">Your Weekly VisaNova Summary</h1>
            <p style="margin:8px 0 0;color:rgba(255,255,255,0.9);font-size:14px;">${weekStart} – ${weekEnd}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <p style="margin:0 0 20px;color:#1f2937;font-size:16px;">Hi ${userName},</p>
            <p style="margin:0 0 20px;color:#4b5563;font-size:15px;line-height:1.6;">Here’s your weekly immigration data digest from VisaNova.</p>
            
            <div style="background:#f8f9fa;border-radius:8px;padding:20px;margin:20px 0;border-left:4px solid #0071e3;">
              <h3 style="margin:0 0 16px;color:#1f2937;font-size:16px;font-weight:600;">📊 This Week’s Stats</h3>
              <table role="presentation" style="width:100%;border-collapse:collapse;">
                <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Total approvals</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#1f2937;">${stats.totalApprovals}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">RFEs issued</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#1f2937;">${stats.totalRFEs}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Approvals per day</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#0071e3;">~${stats.approvalsPerDay}</td></tr>
                <tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Avg processing time</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#1f2937;">${stats.avgProcessingDays} days</td></tr>
                ${stats.similarApprovals > 0 ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Similar cases approved</td><td style="padding:8px 0;text-align:right;font-weight:600;color:#2E7D32;">${stats.similarApprovals}</td></tr>` : ""}
              </table>
            </div>

            ${visaPauseSection}

            <table role="presentation" style="width:100%;margin:24px 0;">
              <tr><td align="center">
                <a href="${baseUrl}" style="display:inline-block;padding:12px 24px;background:#0071e3;color:#fff;text-decoration:none;border-radius:4px;font-weight:600;font-size:15px;">Open VisaNova →</a>
              </td></tr>
            </table>

            <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">You’re receiving this because you enabled Weekly Summary in settings. <a href="${baseUrl}/settings" style="color:#0071e3;">Manage preferences</a></p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
            <p style="margin:0;color:#6b7280;font-size:12px;"><strong>VisaNova</strong> — Know where you stand. Plan with confidence.</p>
            <p style="margin:12px 0 0;color:#9ca3af;font-size:11px;">Estimates based on public data.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

export async function sendWeeklySummaryEmails(): Promise<{ sent: number; failed: number; errors: string[] }> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey || !resendApiKey.startsWith("re_")) {
    console.error("[WeeklyEmail] RESEND_API_KEY not configured");
    return { sent: 0, failed: 0, errors: ["RESEND_API_KEY not configured"] };
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL || "VisaNova <support@visanova.app>";
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app";

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - 7);
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  const weekStartStr = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const weekEndStr = endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const recipients = await getUsersWithWeeklyEmailEnabled();
  console.log(`[WeeklyEmail] Found ${recipients.length} users with weekly email enabled`);

  const client = new Resend(resendApiKey);
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    try {
      const stats = await computeWeekStats(r.profile || undefined, startOfWeek, endOfWeek);
      const visaPause = r.profile?.country
        ? await getVisaPauseInfo(r.profile.country)
        : { affected: false };

      const userName = r.displayName || r.email.split("@")[0];
      const html = generateWeeklyEmailHTML(
        userName,
        weekStartStr,
        weekEndStr,
        stats,
        visaPause,
        baseUrl
      );

      const result = await client.emails.send({
        from: fromEmail,
        to: r.email,
        subject: `Your VisaNova Weekly Summary: ${weekStartStr} – ${weekEndStr}`,
        html,
      });

      if (result.error) {
        failed++;
        errors.push(`${r.email}: ${result.error.message}`);
        console.error("[WeeklyEmail] Failed for", r.email, result.error);
      } else {
        sent++;
        console.log("[WeeklyEmail] Sent to", r.email);
      }
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${r.email}: ${msg}`);
      console.error("[WeeklyEmail] Error for", r.email, err);
    }
  }

  return { sent, failed, errors };
}
