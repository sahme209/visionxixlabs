# Welcome Email Setup Guide

This guide explains how to set up the welcome email functionality for new user sign-ups.

## Overview

When users sign up for VisaNova (via email/password or Google), they automatically receive a beautiful welcome email that:
- Welcomes them to the platform
- Highlights key features
- Provides helpful links
- Maintains a professional, authentic design

## Email Service: Resend

We use [Resend](https://resend.com) for reliable email delivery. Resend offers:
- Free tier: 3,000 emails/month
- Easy API integration
- Great deliverability
- Simple setup

## Setup Instructions

### 1. Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Get Your API Key

1. In the Resend dashboard, go to **API Keys**
2. Click **Create API Key**
3. Give it a name (e.g., "VisaNova Production")
4. Copy the API key (starts with `re_`)

### 3. Add API Key to Environment Variables

Add the Resend API key to your `.env.local` file:

```bash
RESEND_API_KEY=re_NgtRBNUv_JTohH9aA14Az7Jn8Fbh96WUk
RESEND_FROM_EMAIL=VisaNova <support@visionxixlabs.com>
NEXT_PUBLIC_BASE_URL=https://visanova.app
```

**For Vercel/Production:**
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add these variables:
   - `RESEND_API_KEY` = `re_NgtRBNUv_JTohH9aA14Az7Jn8Fbh96WUk`
   - `RESEND_FROM_EMAIL` = `VisaNova <support@visionxixlabs.com>`
   - `NEXT_PUBLIC_BASE_URL` = `https://visanova.app`
4. Redeploy your application

### 4. Verify Your Domain (CRITICAL for Deliverability)

Your domain should be verified in Resend to prevent emails from going to spam:

1. In Resend dashboard, go to **Domains**
2. Add your domain (e.g., `visanova.app` or `visionxixlabs.com`)
3. Follow the DNS setup instructions to add these records:
   - **SPF Record**: Authorizes Resend to send emails on your behalf
   - **DKIM Record**: Adds cryptographic signature to prove email authenticity
   - **DMARC Record**: Tells receiving servers how to handle emails that fail authentication
4. Once verified, emails will have better deliverability and won't go to spam

**Why Emails Go to Spam/Junk:**
- **Unverified Domain**: Without SPF/DKIM/DMARC, emails look suspicious to spam filters
- **New Sender**: First emails from a new address often go to spam as filters learn
- **Automated Emails**: Some filters flag automated/transactional emails more aggressively
- **No Reputation**: New domains/senders have no email reputation yet
- **Email Content**: Certain words or patterns can trigger spam filters

**Current Configuration:**
- From Email: `VisaNova <support@visionxixlabs.com>` (or your verified domain)
- Domain: Your verified domain in Resend
- Base URL: `https://visanova.app`

**To Improve Deliverability:**
1. ✅ Verify domain in Resend (adds SPF, DKIM, DMARC records)
2. ✅ Use consistent "From" address
3. ✅ Ask users to add sender to contacts (prevents future spam filtering)
4. ✅ Avoid spam trigger words in subject lines
5. ✅ Warm up the domain by sending to engaged users first

## How It Works

1. **User Signs Up**: When a new user creates an account (email/password or Google), the signup flow triggers the welcome email API.

2. **Email Service**: The API route (`/api/send-welcome-email`) calls the email service.

3. **Email Sent**: Resend sends a beautifully formatted HTML email to the user.

4. **Non-Blocking**: Email sending is non-blocking - if it fails, it won't prevent the user from completing signup.

## Email Template

The welcome email includes:
- Professional header with VisaNova branding
- Personalized greeting
- Feature highlights (4 key features)
- Call-to-action button
- Footer with links and disclaimer

The template is fully responsive and works in all major email clients.

## Testing

### Test Locally

1. Make sure `RESEND_API_KEY` is in your `.env.local`
2. Sign up a new account
3. Check your email inbox (and spam folder)

### Test Email Address

Resend provides a test email address for development:
- Use `delivered@resend.dev` to test email delivery
- All emails sent to this address are automatically delivered

## Troubleshooting

### Email Not Sending

1. **Check API Key**: Verify `RESEND_API_KEY` is set correctly
2. **Check Logs**: Look for errors in the console or Vercel logs
3. **Check Resend Dashboard**: View email logs in Resend dashboard
4. **Check Spam Folder**: Emails might be going to spam

### Rate Limits

- Free tier: 3,000 emails/month
- If you exceed limits, upgrade your Resend plan

### Domain Verification

If using a custom domain:
- Make sure DNS records are set correctly
- Wait for DNS propagation (can take up to 48 hours)
- Check domain status in Resend dashboard

## Customization

### Update Email Content

Edit `lib/services/emailService.ts` → `generateWelcomeEmailHTML()` function to customize:
- Email copy
- Features listed
- Colors and styling
- Links

### Add More Email Types

You can extend this pattern to send:
- Password reset emails
- Case status update emails
- Weekly digest emails
- etc.

## Cost

- **Resend Free Tier**: 3,000 emails/month (perfect for getting started)
- **Resend Pro**: $20/month for 50,000 emails
- **Resend Business**: Custom pricing for higher volumes

## Security Notes

- Never commit API keys to git
- Use environment variables for all secrets
- API keys are server-side only (not exposed to client)

## Support

- Resend Documentation: https://resend.com/docs
- Resend Support: support@resend.com
- VisaNova Issues: Check GitHub issues
