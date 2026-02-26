# Quick Fix: Set Environment Variables in Vercel

## The Problem
You're seeing: "Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable."

This happens because environment variables need to be set in Vercel (your hosting platform), not just locally.

## Quick Steps (2 minutes)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Sign in if needed

2. **Select Your Project**
   - Click on your `VisaNovaWeb` project (or whatever it's named)

3. **Go to Settings → Environment Variables**
   - Click **Settings** tab
   - Click **Environment Variables** in the left sidebar

4. **Add These 3 Variables:**

   Click **Add New** for each:

   **Variable 1:**
   - Key: `STRIPE_SECRET_KEY`
   - Value: `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`
   - Environment: Select **Production** (or **All**)
   - ⚠️ **PRODUCTION KEY** - This will process real payments!

   **Variable 2:**
   - Key: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Value: `pk_live_51SpEdeFet66ERY29154GPZZklZeDrvjGjNo4c4NrlgNci3paoc3oaPUk3I34w2QwfyreFJ1ScsozTPvvm9zbA8mA00AC5nGsOU`
   - Environment: Select **Production** (or **All**)
   - ⚠️ **PRODUCTION KEY** - This will process real payments!

   **Variable 3:**
   - Key: `NEXT_PUBLIC_BASE_URL`
   - Value: `https://visanova.app`
   - Environment: Select **Production** (or **All**)

   **Variable 4:**
   - Key: `STRIPE_WEBHOOK_SECRET`
   - Value: `whsec_pP9xFQlS5FkCzfgHuq9lKrmO70UlaXPC`
   - Environment: Select **Production** (or **All**)

5. **Redeploy**
   - After adding variables, go to **Deployments** tab
   - Click the **⋯** (three dots) on the latest deployment
   - Click **Redeploy**
   - Or push a new commit to trigger auto-deploy

## That's It!

After redeploy, your Stripe checkout should work. The error will be gone and users can subscribe.

## Optional: Price IDs

You can optionally set these (but not required - API creates them automatically):
- `STRIPE_PRICE_ID_MONTHLY` (leave empty for auto-create)
- `STRIPE_PRICE_ID_ANNUAL` (leave empty for auto-create)
