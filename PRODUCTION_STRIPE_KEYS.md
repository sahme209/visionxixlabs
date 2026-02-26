# Production Stripe Keys Setup

## ⚠️ IMPORTANT: Production Keys

These are **LIVE** Stripe keys that will process **REAL payments**. Use with caution!

## Environment Variables for Vercel

Add these to your Vercel project at: **Settings → Environment Variables**

### Required Variables:

1. **STRIPE_SECRET_KEY**
   ```
   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
   ```
   - Environment: **Production** (or All)
   - ⚠️ Keep this secret! Never commit to Git.

2. **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**
   ```
   pk_live_51SpEdeFet66ERY29154GPZZklZeDrvjGjNo4c4NrlgNci3paoc3oaPUk3I34w2QwfyreFJ1ScsozTPvvm9zbA8mA00AC5nGsOU
   ```
   - Environment: **Production** (or All)
   - This is safe to expose in client-side code.

3. **STRIPE_WEBHOOK_SECRET**
   ```
   whsec_pP9xFQlS5FkCzfgHuq9lKrmO70UlaXPC
   ```
   - Environment: **Production** (or All)
   - Get from Stripe Dashboard → Webhooks → Your endpoint → Signing secret

4. **NEXT_PUBLIC_BASE_URL**
   ```
   https://visanova.app
   ```
   - Environment: **Production** (or All)

## Steps to Add in Vercel:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Click **Add New** for each variable above
5. Make sure to select **Production** environment
6. Click **Save**
7. **Redeploy** your application (go to Deployments → Redeploy)

## After Adding:

- ✅ Your Stripe checkout will process real payments
- ✅ Webhooks will verify subscription status
- ✅ Users will be charged $4.99/month

## Security Notes:

- ✅ Never commit these keys to Git
- ✅ Only add them in Vercel environment variables
- ✅ The secret key (`sk_live_...`) should NEVER be exposed in client-side code
- ✅ The publishable key (`pk_live_...`) is safe for client-side use

## Testing Production:

Before going fully live, test with a small real payment to ensure everything works correctly.
