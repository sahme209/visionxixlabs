// Email service for sending welcome emails
// Uses Resend API for reliable email delivery

import { Resend } from "resend";
import { COMPANY_NAME, SUPPORT_EMAIL, MAILTO_SUPPORT } from "@/lib/constants/company";
import { TAGLINE, DISCLAIMER_USCIS } from "@/lib/constants/copy";

interface WelcomeEmailData {
  email: string;
  name?: string;
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<boolean> {
  try {
    // Check if Resend API key is configured
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.error("[EmailService] ❌ RESEND_API_KEY not configured in environment variables.");
      console.error("[EmailService] Please add RESEND_API_KEY to your .env.local file.");
      console.error("[EmailService] Skipping welcome email to:", data.email);
      return false;
    }

    // Validate API key format (should start with 're_')
    if (!resendApiKey.startsWith('re_')) {
      console.error("[EmailService] ❌ Invalid RESEND_API_KEY format. Should start with 're_'");
      return false;
    }

    const client = new Resend(resendApiKey);

    // Use environment variable for from email, or default to support@visanova.app (verified domain)
    const fromEmail = process.env.RESEND_FROM_EMAIL || "VisaNova <support@visanova.app>";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app";
    
    console.log("[EmailService] 📧 Attempting to send welcome email to:", data.email);
    console.log("[EmailService] From:", fromEmail);
    
    const emailHtml = generateWelcomeEmailHTML(data.name || data.email.split("@")[0], baseUrl);

    const result = await client.emails.send({
      from: fromEmail,
      replyTo: SUPPORT_EMAIL,
      to: data.email,
      subject: "Welcome to VisaNova - Track Your Immigration Journey",
      html: emailHtml,
    });

    if (result.error) {
      console.error("[EmailService] ❌ Resend API error:", JSON.stringify(result.error, null, 2));
      console.error("[EmailService] Error details:", {
        message: result.error.message,
        name: result.error.name,
        statusCode: (result.error as any)?.statusCode,
      });
      
      // Common Resend errors and their meanings
      const errorMessage = result.error.message || "";
      if (errorMessage.includes("domain") || errorMessage.includes("Domain")) {
        console.error("[EmailService] 💡 Tip: Your sending domain may not be verified in Resend. Check: https://resend.com/domains");
      }
      if (errorMessage.includes("API key") || errorMessage.includes("unauthorized")) {
        console.error("[EmailService] 💡 Tip: Your API key may be invalid or have insufficient permissions.");
      }
      if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
        console.error("[EmailService] 💡 Tip: You may have exceeded your Resend email quota. Check: https://resend.com/overview");
      }
      
      return false;
    }

    console.log("[EmailService] ✅ Welcome email sent successfully to:", data.email);
    console.log("[EmailService] Email ID:", result.data?.id);
    return true;
  } catch (error) {
    console.error("[EmailService] ❌ Exception while sending welcome email:", error);
    if (error instanceof Error) {
      console.error("[EmailService] Error message:", error.message);
      console.error("[EmailService] Error stack:", error.stack);
    }
    return false;
  }
}

/**
 * Generate beautiful HTML email template
 */
function generateWelcomeEmailHTML(userName: string, baseUrl: string = "https://visanova.app"): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to VisaNova</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <!-- Main Container -->
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header with Gradient -->
          <tr>
            <td style="background: linear-gradient(135deg, #0066cc 0%, #0071e3 50%, #0066cc 100%); padding: 40px 30px; text-align: center;">
              <div style="width: 64px; height: 64px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255, 255, 255, 0.3);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">Welcome to VisaNova</h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 400;">Track Your Immigration Journey</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                Thank you for joining VisaNova! We're excited to help you navigate your immigration journey with confidence and clarity.
              </p>

              <!-- Feature Highlights -->
              <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 30px 0;">
                <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">What you can do with VisaNova:</h2>
                
                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <div style="display: flex; align-items: start;">
                        <div style="width: 24px; height: 24px; background-color: #0071e3; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; margin-top: 2px;">
                          <span style="color: white; font-size: 14px; font-weight: 600;">✓</span>
                        </div>
                        <div>
                          <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 600;">Track Your Case Status</p>
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">Get data-driven updates as we refresh your estimated case progress</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <div style="display: flex; align-items: start;">
                        <div style="width: 24px; height: 24px; background-color: #0071e3; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; margin-top: 2px;">
                          <span style="color: white; font-size: 14px; font-weight: 600;">✓</span>
                        </div>
                        <div>
                          <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 600;">View Processing Times</p>
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">See current processing times for your form type</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e5e7eb;">
                      <div style="display: flex; align-items: start;">
                        <div style="width: 24px; height: 24px; background-color: #0071e3; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; margin-top: 2px;">
                          <span style="color: white; font-size: 14px; font-weight: 600;">✓</span>
                        </div>
                        <div>
                          <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 600;">Access Form Guides</p>
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">Step-by-step guides for all immigration forms</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0;">
                      <div style="display: flex; align-items: start;">
                        <div style="width: 24px; height: 24px; background-color: #0071e3; border-radius: 6px; display: flex; align-items: center; justify-content: center; margin-right: 12px; flex-shrink: 0; margin-top: 2px;">
                          <span style="color: white; font-size: 14px; font-weight: 600;">✓</span>
                        </div>
                        <div>
                          <p style="margin: 0; color: #1f2937; font-size: 15px; font-weight: 600;">Get Daily Updates</p>
                          <p style="margin: 4px 0 0; color: #6b7280; font-size: 14px; line-height: 1.5;">Stay informed with daily approval statistics</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${baseUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #0066cc 0%, #0071e3 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 113, 227, 0.25);">
                      Get Started →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions, our Help Center is always available. We're here to support you every step of the way.
              </p>
              
              <p style="margin: 20px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                Need help? Contact us at <a href="${MAILTO_SUPPORT}" style="color: #0071e3; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong style="color: #1f2937;">VisaNova</strong><br>
                ${TAGLINE}
              </p>
              
              <div style="margin: 20px 0;">
                <a href="${baseUrl}/help" style="color: #0071e3; text-decoration: none; font-size: 14px; margin: 0 12px;">Help Center</a>
                <span style="color: #d1d5db;">•</span>
                <a href="${baseUrl}/privacy" style="color: #0071e3; text-decoration: none; font-size: 14px; margin: 0 12px;">Privacy Policy</a>
                <span style="color: #d1d5db;">•</span>
                <a href="${baseUrl}/terms" style="color: #0071e3; text-decoration: none; font-size: 14px; margin: 0 12px;">Terms</a>
              </div>
              
              <p style="margin: 12px 0 0; color: #6b7280; font-size: 13px; line-height: 1.5;">
                Questions? Email us at <a href="${MAILTO_SUPPORT}" style="color: #0071e3; text-decoration: none;">${SUPPORT_EMAIL}</a>
              </p>

              <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                This email was sent to you because you created an account with VisaNova.<br>
                © ${new Date().getFullYear()} ${COMPANY_NAME}. All rights reserved.
              </p>

              <p style="margin: 16px 0 0; color: #9ca3af; font-size: 11px; line-height: 1.5;">
                <strong>Disclaimer:</strong> ${DISCLAIMER_USCIS}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

interface SubscriptionEmailData {
  email: string;
  name?: string;
  isSubscribed: boolean;
  timeline?: {
    formType: string;
    priorityDate: Date;
    stages: Array<{
      id: string;
      name: string;
      description: string;
      stageType: "uscis" | "nvc" | "embassy";
      earliestDate: Date;
      latestDate: Date;
      isCompleted: boolean;
      isCurrent: boolean;
    }>;
  };
}

/**
 * Send subscription confirmation email with timeline
 */
export async function sendSubscriptionEmail(data: SubscriptionEmailData): Promise<boolean> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.error("[EmailService] ❌ RESEND_API_KEY not configured. Skipping subscription email.");
      return false;
    }

    if (!resendApiKey.startsWith('re_')) {
      console.error("[EmailService] ❌ Invalid RESEND_API_KEY format.");
      return false;
    }

    const client = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "VisaNova <support@visanova.app>";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app";
    
    console.log("[EmailService] 📧 Sending subscription email to:", data.email, "isSubscribed:", data.isSubscribed);
    
    const emailHtml = generateSubscriptionEmailHTML(
      data.name || data.email.split("@")[0],
      data.isSubscribed,
      data.timeline,
      baseUrl
    );

    const result = await client.emails.send({
      from: fromEmail,
      replyTo: SUPPORT_EMAIL,
      to: data.email,
      subject: data.isSubscribed 
        ? "Welcome to VisaNova Premium - Your Complete Timeline" 
        : "Your USCIS Timeline - Upgrade for Full Access",
      html: emailHtml,
    });

    if (result.error) {
      console.error("[EmailService] ❌ Resend API error:", JSON.stringify(result.error, null, 2));
      return false;
    }

    console.log("[EmailService] ✅ Subscription email sent successfully to:", data.email);
    return true;
  } catch (error) {
    console.error("[EmailService] ❌ Exception while sending subscription email:", error);
    return false;
  }
}

/**
 * Generate subscription email HTML with timeline
 */
function generateSubscriptionEmailHTML(
  userName: string,
  isSubscribed: boolean,
  timeline?: SubscriptionEmailData["timeline"],
  baseUrl: string = "https://visanova.app"
): string {
  // Filter stages based on subscription status
  const displayStages = timeline ? (
    isSubscribed 
      ? timeline.stages // Full timeline for subscribed
      : timeline.stages.filter(s => s.stageType === "uscis") // Only USCIS for non-subscribed
  ) : [];

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateRange = (earliest: Date, latest: Date): string => {
    const earliestStr = formatDate(earliest);
    const latestStr = formatDate(latest);
    if (earliestStr === latestStr) {
      return earliestStr;
    }
    return `${earliestStr} - ${latestStr}`;
  };

  const timelineHTML = displayStages.length > 0 ? `
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 30px 0;">
      <h2 style="margin: 0 0 20px; color: #1f2937; font-size: 20px; font-weight: 600;">
        ${isSubscribed ? 'Your Complete Immigration Timeline' : 'Your USCIS Processing Timeline'}
      </h2>
      
      ${displayStages.map((stage, index) => `
        <div style="margin-bottom: ${index < displayStages.length - 1 ? '20px' : '0'}; padding-bottom: ${index < displayStages.length - 1 ? '20px' : '0'}; border-bottom: ${index < displayStages.length - 1 ? '1px solid #e5e7eb' : 'none'};">
          <div style="display: flex; align-items: start;">
            <div style="width: 40px; height: 40px; background-color: ${stage.isCompleted ? '#10b981' : stage.isCurrent ? '#0071e3' : '#e5e7eb'}; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0;">
              ${stage.isCompleted ? `
                <span style="color: white; font-size: 18px;">✓</span>
              ` : stage.isCurrent ? `
                <span style="color: white; font-size: 18px;">→</span>
              ` : `
                <span style="color: #6b7280; font-size: 18px;">${index + 1}</span>
              `}
            </div>
            <div style="flex: 1;">
              <h3 style="margin: 0 0 8px; color: #1f2937; font-size: 16px; font-weight: 600;">
                ${stage.name}
              </h3>
              <p style="margin: 0 0 8px; color: #6b7280; font-size: 14px; line-height: 1.5;">
                ${stage.description}
              </p>
              <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
                <span style="background-color: ${stage.stageType === 'uscis' ? '#dbeafe' : stage.stageType === 'nvc' ? '#fef3c7' : '#fce7f3'}; color: ${stage.stageType === 'uscis' ? '#1e40af' : stage.stageType === 'nvc' ? '#92400e' : '#9f1239'}; padding: 4px 10px; border-radius: 4px; font-size: 12px; font-weight: 600; text-transform: uppercase;">
                  ${stage.stageType}
                </span>
                <span style="color: #4b5563; font-size: 13px; font-weight: 500;">
                  ${formatDateRange(stage.earliestDate, stage.latestDate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      `).join('')}
      
      ${!isSubscribed && timeline && timeline.stages.some(s => s.stageType !== "uscis") ? `
        <div style="margin-top: 24px; padding: 16px; background-color: #f0f7ff; border-radius: 6px; border-left: 4px solid #0071e3;">
          <p style="margin: 0; color: #1e40af; font-size: 14px; line-height: 1.6;">
            <strong>💡 Upgrade to Premium</strong> to see your complete timeline including NVC processing, embassy interviews, and visa issuance dates.
          </p>
        </div>
      ` : ''}
    </div>
  ` : `
    <div style="background-color: #f9fafb; border-radius: 8px; padding: 24px; margin: 30px 0; text-align: center;">
      <p style="margin: 0; color: #6b7280; font-size: 14px;">
        Complete your profile setup to see your personalized timeline.
      </p>
    </div>
  `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isSubscribed ? 'Welcome to VisaNova Premium' : 'Your USCIS Timeline'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0066cc 0%, #0071e3 50%, #0066cc 100%); padding: 40px 30px; text-align: center;">
              <div style="width: 64px; height: 64px; margin: 0 auto 20px; background-color: rgba(255, 255, 255, 0.2); border-radius: 16px; display: flex; align-items: center; justify-content: center; border: 2px solid rgba(255, 255, 255, 0.3);">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                ${isSubscribed ? 'Welcome to VisaNova Premium!' : 'Your Immigration Timeline'}
              </h1>
              <p style="margin: 10px 0 0; color: rgba(255, 255, 255, 0.9); font-size: 16px; font-weight: 400;">
                ${isSubscribed ? 'Unlock the full power of your immigration journey' : 'Track your case progress'}
              </p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px; color: #1f2937; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              
              <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">
                ${isSubscribed 
                  ? "Thank you for subscribing to VisaNova Premium! You now have access to your complete immigration timeline with detailed estimates for every stage of your journey."
                  : "Here's your USCIS processing timeline based on your case information. Upgrade to Premium to see your complete timeline including NVC processing, embassy interviews, and visa issuance dates."
                }
              </p>

              ${timelineHTML}

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin: 30px 0;">
                <tr>
                  <td align="center" style="padding: 0;">
                    <a href="${baseUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #0066cc 0%, #0071e3 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(0, 113, 227, 0.25);">
                      ${isSubscribed ? 'View Your Dashboard →' : 'Upgrade to Premium →'}
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
                If you have any questions, our Help Center is always available. We're here to support you every step of the way.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 12px; color: #6b7280; font-size: 14px; line-height: 1.6;">
                <strong style="color: #1f2937;">VisaNova</strong><br>
                ${TAGLINE}
              </p>
              
              <p style="margin: 20px 0 0; color: #9ca3af; font-size: 12px; line-height: 1.5;">
                <strong>Disclaimer:</strong> ${DISCLAIMER_USCIS}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send trial ending soon reminder (24 hours before trial ends)
 */
export async function sendTrialReminderEmail(data: { email: string; name?: string }): Promise<boolean> {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey || !resendApiKey.startsWith("re_")) {
      console.error("[EmailService] RESEND_API_KEY not configured. Skipping trial reminder.");
      return false;
    }

    const client = new Resend(resendApiKey);
    const fromEmail = process.env.RESEND_FROM_EMAIL || "VisaNova <support@visanova.app>";
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app";
    const userName = data.name || data.email.split("@")[0];

    const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Trial Ending Soon</title></head>
<body style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5;">
  <table role="presentation" style="width: 100%; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
    <tr>
      <td style="background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h1 style="margin: 0 0 16px; color: #0066cc; font-size: 24px;">Trial Ending Tomorrow</h1>
        <p style="margin: 0 0 20px; color: #4b5563; font-size: 16px; line-height: 1.6;">Hi ${userName},</p>
        <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">Your VisaNova trial ends tomorrow. You will be charged $4.99/month unless you cancel.</p>
        <p style="margin: 0 0 24px; color: #4b5563; font-size: 16px; line-height: 1.6;">To manage your subscription or update your payment method, visit Settings in the app.</p>
        <a href="${baseUrl}/settings" style="display: inline-block; padding: 12px 24px; background: #0066cc; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 600;">Manage Subscription</a>
        <p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px;">VisaNova – ${TAGLINE}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const result = await client.emails.send({
      from: fromEmail,
      replyTo: SUPPORT_EMAIL,
      to: data.email,
      subject: "Your VisaNova trial ends tomorrow – You will be charged $4.99/month",
      html,
    });

    if (result.error) {
      console.error("[EmailService] Trial reminder error:", result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[EmailService] Trial reminder exception:", err);
    return false;
  }
}
