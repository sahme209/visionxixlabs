# Email Configuration - Quick Setup

## ✅ Already Configured

Your welcome email system is configured with:

- **Resend API Key**: `re_NgtRBNUv_JTohH9aA14Az7Jn8Fbh96WUk`
- **From Email**: `VisaNova <support@visanova.app>` (verified domain)
- **Domain**: `visanova.app`
- **Base URL**: `https://visanova.app`

## Environment Variables

Add these to your `.env.local` file (for local development):

```bash
RESEND_API_KEY=re_NgtRBNUv_JTohH9aA14Az7Jn8Fbh96WUk
RESEND_FROM_EMAIL=VisaNova <support@visanova.app>
NEXT_PUBLIC_BASE_URL=https://visanova.app
```

## Vercel/Production Setup

1. Go to Vercel Project Settings → Environment Variables
2. Add these three variables:
   - `RESEND_API_KEY` = `re_NgtRBNUv_JTohH9aA14Az7Jn8Fbh96WUk`
   - `RESEND_FROM_EMAIL` = `VisaNova <support@visanova.app>`
   - `NEXT_PUBLIC_BASE_URL` = `https://visanova.app`
3. Redeploy your application

## Domain Verification

Make sure `visanova.app` is verified in your Resend dashboard:
1. Go to https://resend.com/domains
2. Verify `visanova.app` is added and verified
3. If not, add it and follow DNS setup instructions

## Testing

After setup, test by:
1. Creating a new account
2. Check your email inbox (and spam folder)
3. You should receive a beautiful welcome email

## Support

- Resend Dashboard: https://resend.com
- Email logs: Check Resend dashboard for delivery status
- Issues: Check console logs for any errors
