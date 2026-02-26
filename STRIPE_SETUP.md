# Stripe Integration Setup

## Checkout Flow (3-Day Trial)

**All subscriptions must go through [visanova.app/subscribe](https://visanova.app/subscribe).**

- The app creates Stripe Checkout Sessions via `/api/stripe/create-checkout-session`
- The API applies a **3-day free trial** for first-time subscribers (`trial_period_days: 3`)
- **Do NOT use Stripe Payment Links** (e.g. `https://buy.stripe.com/...`) — they bypass the app's trial logic and do not sync with Firestore/user metadata
- If you previously used a Payment Link, deprecate it and direct users to **visanova.app/subscribe** instead

## Environment Variables

### For Local Development

Create a `.env.local` file in the `VisaNovaWeb` directory with the following:

```env
# Stripe Keys (Sandbox/Test)
STRIPE_SECRET_KEY=sk_test_51SpEdeFet66ERY294RKplXROTEzkFWZQD4BvCLCGYOqrzRCt3bjf3S2XXd4vNKbfWq0vrRlGA9ReUkPzuWMouYNk002OkBVVZC
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51SpEdeFet66ERY29EJNY0rDN7S0TbcucW8YKj5yTJc8qmo9hU3NcbBbTPmKwEjI5iO9ArEhqJgDKXGABLNCmEW6T00rcYnGTvx

# Stripe Price IDs (Create these in Stripe Dashboard)
# Go to Stripe Dashboard > Products > Create Product
# Create Monthly subscription: $4.99/month
# Create Annual subscription: $39.99/year
# Copy the Price IDs and paste them here:
STRIPE_PRICE_ID_MONTHLY=price_xxxxx_monthly
STRIPE_PRICE_ID_ANNUAL=price_xxxxx_annual

# Base URL
NEXT_PUBLIC_BASE_URL=http://localhost:3000
# For production, use: NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

## Setting Up Stripe Products

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/test/products)
2. Click "Add product"
3. Create two products:

### Monthly Subscription
- Name: "VisaNova Premium Monthly"
- Pricing: Recurring
- Price: $4.99
- Billing period: Monthly
- **Do not** add a free trial on the Price itself; the app applies a 3-day trial at checkout via the API.
- Copy the Price ID (starts with `price_`) and add to `STRIPE_PRICE_ID_MONTHLY`

### Annual Subscription
- Name: "VisaNova Premium Annual"
- Pricing: Recurring
- Price: $39.99
- Billing period: Yearly
- Copy the Price ID (starts with `price_`) and add to `STRIPE_PRICE_ID_ANNUAL`

### For Production (Vercel/visanova.app)

**IMPORTANT:** You must set environment variables in your hosting platform (Vercel):

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your `VisaNovaWeb` project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

```
STRIPE_SECRET_KEY=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
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_51SpEdeFet66ERY29154GPZZklZeDrvjGjNo4c4NrlgNci3paoc3oaPUk3I34w2QwfyreFJ1ScsozTPvvm9zbA8mA00AC5nGsOU
STRIPE_WEBHOOK_SECRET=whsec_pP9xFQlS5FkCzfgHuq9lKrmO70UlaXPC
NEXT_PUBLIC_BASE_URL=https://visanova.app
```

**⚠️ PRODUCTION KEYS IN USE:**
- These are **LIVE** Stripe keys that will process real payments
- Make sure webhook secret matches your production webhook endpoint
- Test thoroughly before going live

5. **Redeploy** your application after adding the variables (Vercel will auto-redeploy or you can trigger a manual redeploy)

**Note:** 
- `STRIPE_PRICE_ID_MONTHLY` and `STRIPE_PRICE_ID_ANNUAL` are optional - the API will create products automatically if not set
- `STRIPE_WEBHOOK_SECRET` is required for webhook verification - get this from Stripe Dashboard → Webhooks → Your endpoint → Signing secret
- Make sure to set these for **Production** environment (or all environments)

## Testing

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
- Use any future expiry date, any CVC, any ZIP

## Features Implemented

- ✅ Subscription page with monthly/annual plans
- ✅ Stripe Checkout integration
- ✅ Success page after subscription
- ✅ Timeline blur overlay that links to subscription
- ✅ Premium gating on timeline component
- ✅ Automatic product/price creation if not configured
