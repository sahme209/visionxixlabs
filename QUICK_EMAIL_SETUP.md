# Quick Email Setup Guide

## Problem: Emails Not Sending

If you're not receiving emails when submitting the contact form, it's because the Resend API key is not configured.

## Quick Setup (5 minutes)

### Step 1: Sign up for Resend (Free)
1. Go to https://resend.com
2. Click "Sign Up" (free tier: 100 emails/day)
3. Verify your email

### Step 2: Get Your API Key
1. After logging in, go to https://resend.com/api-keys
2. Click "Create API Key"
3. Give it a name (e.g., "Vision XIX Labs Website")
4. Copy the API key (starts with `re_`)

### Step 3: Add API Key to Your Project

**Local development:** Create a file named `.env.local` in the root of your project (same level as `package.json`). You can copy from `.env.example`:
   ```
   RESEND_API_KEY=re_your_actual_api_key_here
   CONTACT_EMAIL=support@visionxixlabs.com
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```
   Replace `re_your_actual_api_key_here` with your actual API key from Step 2.

**Deployed site (Vercel, Netlify, etc.):** `.env.local` is not deployed. Add the same variables in your host’s dashboard:
- **Vercel:** Project → Settings → Environment Variables. Add `RESEND_API_KEY` (and optionally `CONTACT_EMAIL`, `RESEND_FROM_EMAIL`), then redeploy.
- **Netlify:** Site → Site configuration → Environment variables. Add the variables, then trigger a new deploy.

### Step 4: Restart Your Server
```bash
# Stop your current server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 5: Test
1. Fill out the contact form
2. Submit it
3. Check your email inbox (support@visionxixlabs.com)
4. You should receive the email!

## Verify Setup

After adding the API key, check your terminal/console when submitting the form. You should see:
- ✅ "Email sent successfully" in the server logs
- ✅ Success message on the form
- ✅ Email in your inbox

If you see errors, check:
- Is the API key correct? (starts with `re_`)
- Did you restart the server after adding `.env.local`?
- Is `.env.local` in the root directory?
- Check the browser console and server logs for error messages

## Alternative: Use Your Own Domain (Optional)

1. In Resend dashboard, go to "Domains"
2. Add your domain (e.g., `visionxixlabs.com`)
3. Add the DNS records Resend provides to your domain
4. Wait for verification (usually a few minutes)
5. Update `.env.local`:
   ```
   RESEND_FROM_EMAIL=contact@visionxixlabs.com
   ```

## Troubleshooting

**Error: "Email service not configured"**
- **Local:** Add `RESEND_API_KEY` to `.env.local` in the project root, then restart the dev server (`npm run dev`). Run the app from the project root (the folder that contains `package.json`).
- **Deployed (Vercel/Netlify):** Set `RESEND_API_KEY` in your hosting dashboard under Environment Variables, then redeploy.

**Error: "Invalid API key"**
- Your API key is incorrect
- Get a new one from Resend dashboard

**Error: "API key doesn't have permission"**
- Check your Resend account status
- Make sure you've verified your email

**Emails going to spam**
- Add SPF/DKIM records (Resend provides these)
- Use your own domain instead of `onboarding@resend.dev`

## Need Help?

If you're still having issues:
1. Check server logs for detailed error messages
2. Check browser console for frontend errors
3. Verify your `.env.local` file exists and has the correct format
4. Make sure you restarted the server after adding the API key
