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
1. Create a file named `.env.local` in the root of your project (same level as `package.json`)
2. Add this line:
   ```
   RESEND_API_KEY=re_your_actual_api_key_here
   CONTACT_EMAIL=support@visionxixlabs.com
   RESEND_FROM_EMAIL=onboarding@resend.dev
   ```
3. Replace `re_your_actual_api_key_here` with your actual API key from Step 2

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
- You haven't set up the RESEND_API_KEY yet
- Follow Step 3 above

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
