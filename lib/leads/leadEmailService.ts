import { Resend } from "resend";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import type { LeadFormData } from "./leadSchema";
import type { PricingEstimate } from "./pricingEstimate";

export function formatEstimate(est: PricingEstimate): string {
  return `$${est.min.toLocaleString()} - $${est.max.toLocaleString()}`;
}

function generateConfirmationHtml(
  name: string,
  payload: LeadFormData,
  estimate: PricingEstimate,
  options?: { leadId?: string; starterToken?: string }
): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app";
  const formatted = formatEstimate(estimate);
  const thankYouUrl =
    options?.leadId && options?.starterToken
      ? `${baseUrl}/request/thank-you?leadId=${encodeURIComponent(options.leadId)}&token=${encodeURIComponent(options.starterToken)}&min=${estimate.min}&max=${estimate.max}`
      : `${baseUrl}/request/thank-you`;
  const previewNote =
    options?.leadId && options?.starterToken
      ? "<p style=\"margin:16px 0 0;color:#4b5563;font-size:14px;\">Your website preview will be generated and ready on the thank-you page. Bookmark this link to check back: <a href=\"" + thankYouUrl + "\" style=\"color:#0071e3;\">View your request & preview</a></p>"
      : "";
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Request Received</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;padding:40px 20px;">
    <tr><td style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
      <h1 style="margin:0 0 16px;color:#1d1d1f;font-size:24px;">Thanks, ${name}!</h1>
      <p style="margin:0 0 20px;color:#4b5563;font-size:16px;line-height:1.6;">We've received your website request and will review it shortly.</p>
      <div style="background:#f0f7ff;border-radius:8px;padding:20px;margin:24px 0;border-left:4px solid #0071e3;">
        <p style="margin:0 0 8px;font-weight:600;color:#1d1d1f;">Estimated Project Range</p>
        <p style="margin:0;font-size:20px;font-weight:700;color:#0071e3;">${formatted}</p>
        <p style="margin:12px 0 0;font-size:13px;color:#6b7280;">This is an estimate only. Final pricing will be confirmed after review.</p>
      </div>
      <p style="margin:24px 0 0;color:#6b7280;font-size:14px;">We'll be in touch within 1-2 business days.</p>
      ${previewNote}
      <p style="margin:20px 0 0;color:#9ca3af;font-size:12px;">Vision XIX Labs &middot; <a href="${baseUrl}" style="color:#0071e3;">visionxixlabs.com</a></p>
    </td></tr>
  </table>
</body>
</html>`;
}

function generateInternalHtml(payload: LeadFormData, estimate: PricingEstimate): string {
  const formatted = formatEstimate(estimate);
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>New Lead</title></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f7;">
  <table role="presentation" style="width:100%;max-width:700px;margin:0 auto;padding:40px 20px;">
    <tr><td style="background:#fff;border-radius:12px;padding:40px;box-shadow:0 4px 6px rgba(0,0,0,0.08);">
      <h1 style="margin:0 0 8px;color:#1d1d1f;font-size:22px;">New Website Request / Lead</h1>
      <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">Source: website-request form</p>

      <table role="presentation" style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Name</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.fullName}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Business</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.businessName || "—"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Email</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><a href="mailto:${payload.email}">${payload.email}</a></td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Phone</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.phone || "—"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Current Website</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.currentWebsiteUrl || "—"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Industry</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.industry}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Project Type</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.projectType.replace(/_/g, " ")}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Pages</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.numberOfPages}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Goals</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.projectGoals?.join(", ") || "—"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Copywriting</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.copywritingNeeded ? "Yes" : "No"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Brand assets ready</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.logoBrandAssetsReady ? "Yes" : "No"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Hosting / Domain</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.hostingDomainStatus || "—"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Timeline</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.timeline || "—"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Budget</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.budgetRange || "—"}</td></tr>
        <tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Estimate</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${formatted}</td></tr>
        ${payload.requiredSections ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Required sections</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.requiredSections}</td></tr>` : ""}
        ${payload.designPreference ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Design preference</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.designPreference}</td></tr>` : ""}
        ${payload.referenceSites ? `<tr><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;"><strong>Reference sites</strong></td><td style="padding:8px 0;border-bottom:1px solid #e5e7eb;">${payload.referenceSites}</td></tr>` : ""}
        ${payload.additionalNotes ? `<tr><td style="padding:8px 0;"><strong>Notes</strong></td><td style="padding:8px 0;">${payload.additionalNotes}</td></tr>` : ""}
      </table>

      <p style="margin:24px 0 0;color:#9ca3af;font-size:12px;">Vision XIX Labs &middot; Admin notification</p>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendLeadConfirmationEmail(
  data: LeadFormData,
  estimate: PricingEstimate,
  options?: { leadId?: string; starterToken?: string }
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !key.startsWith("re_")) {
    console.warn("[LeadEmailService] RESEND_API_KEY not configured, skipping confirmation");
    return false;
  }
  const client = new Resend(key);
  const from = process.env.RESEND_FROM_EMAIL || `Vision XIX Labs <${SUPPORT_EMAIL}>`;
  const html = generateConfirmationHtml(data.fullName, data, estimate, options);
  const result = await client.emails.send({
    from,
    replyTo: SUPPORT_EMAIL,
    to: data.email,
    subject: "We received your website request – Vision XIX Labs",
    html,
  });
  if (result.error) {
    console.error("[LeadEmailService] Confirmation email error:", result.error);
    return false;
  }
  console.log("[LeadEmailService] Confirmation email sent to:", data.email);
  return true;
}

const TEAM_EMAIL = process.env.VISIONXIX_LEADS_TEAM_EMAIL || SUPPORT_EMAIL;

export async function sendLeadInternalNotification(
  data: LeadFormData,
  estimate: PricingEstimate
): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !key.startsWith("re_")) {
    console.warn("[LeadEmailService] RESEND_API_KEY not configured, skipping internal notification");
    return false;
  }
  const client = new Resend(key);
  const from = process.env.RESEND_FROM_EMAIL || `Vision XIX Labs <${SUPPORT_EMAIL}>`;
  const html = generateInternalHtml(data, estimate);
  const result = await client.emails.send({
    from,
    replyTo: data.email,
    to: TEAM_EMAIL,
    subject: `[Lead] ${data.fullName} – ${data.businessName || data.projectType} – Website Request`,
    html,
  });
  if (result.error) {
    console.error("[LeadEmailService] Internal notification error:", result.error);
    return false;
  }
  console.log("[LeadEmailService] Internal notification sent to:", TEAM_EMAIL);
  return true;
}
