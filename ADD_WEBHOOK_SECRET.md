# Quick Guide: Add Stripe Webhook Secret to Vercel

## Steps (2 minutes)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Sign in if needed

2. **Select Your Project**
   - Click on your `VisaNovaWeb` project

3. **Go to Settings → Environment Variables**
   - Click **Settings** tab
   - Click **Environment Variables** in the left sidebar

4. **Add the Webhook Secret:**
   - Click **Add New**
   - **Key:** `STRIPE_WEBHOOK_SECRET`
   - **Value:** `whsec_pP9xFQlS5FkCzfgHuq9lKrmO70UlaXPC`
   - **Environment:** Select **Production** (or **All**)
   - Click **Save**

5. **Redeploy**
   - Go to **Deployments** tab
   - Click the **⋯** (three dots) on the latest deployment
   - Click **Redeploy**

## What This Does

The webhook secret allows Stripe to securely verify that webhook events are coming from Stripe and not from a malicious source. This is required for the subscription status updates to work properly.

## Verify It's Working

After redeploying, test by:
1. Going to `/subscribe` page
2. Subscribing with test card `4242 4242 4242 4242`
3. After successful payment, your subscription status should update automatically
4. Timeline blur should disappear
5. Stats page should be accessible
