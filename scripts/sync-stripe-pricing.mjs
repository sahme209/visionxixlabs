#!/usr/bin/env node
/**
 * Stripe pricing sync — creates products, prices, and Payment Links for
 * Starter / Growth / Scale tiers that match the canonical config in
 * `lib/pricing/membership.ts`.
 *
 * Usage:
 *   STRIPE_KEY=sk_live_... node scripts/sync-stripe-pricing.mjs
 *
 * The script never echoes the key. It does write a JSON artifact at
 * `./stripe-sync.<timestamp>.json` containing the Stripe object IDs +
 * Payment Link URLs so you can paste them into Vercel env vars.
 *
 * Idempotency: this script CREATES new objects on every run. Stripe
 * products + prices cannot be deleted once used — archive previous
 * ones from the Stripe Dashboard if you re-run.
 */

import fs from "node:fs";
import path from "node:path";

const KEY = process.env.STRIPE_KEY;
if (!KEY) {
  console.error("ERROR: set STRIPE_KEY before running this script.");
  process.exit(1);
}

const SITE = process.env.SITE_URL || "https://visionxixlabs.com";
const REDIRECT_URL = `${SITE}/dashboard/command-center?welcome=1`;

// Tier config — must mirror lib/pricing/membership.ts. Cents.
const TIERS = [
  {
    id: "starter",
    name: "Axiom Starter",
    description:
      "AI-assisted ops for a solo founder or small team. 1 cloud, 6,000 AI ops/month, Slack integration, every safety contract.",
    monthlyCents: 14_900,
    yearlyCents: 118_800,
  },
  {
    id: "growth",
    name: "Axiom Growth",
    description:
      "Series A–B teams. Phased Terraform execution plans, GitHub connector, multi-cloud read, Slack + Teams + Zendesk + Intercom. 15,000 AI ops/month.",
    monthlyCents: 89_900,
    yearlyCents: 718_800,
  },
  {
    id: "scale",
    name: "Axiom Scale",
    description:
      "Mid-market platforms. AWS + Azure + GCP write, daily auto-scan, signed Terraform, full API + webhooks, 60,000 AI ops/month, SSO + SLA.",
    monthlyCents: 349_900,
    yearlyCents: 2_998_800,
  },
];

const PRODUCT_TAG = "axiom-platform";

async function stripeApi(endpoint, body) {
  const params = new URLSearchParams();
  function flatten(prefix, value) {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => flatten(`${prefix}[${i}]`, v));
    } else if (typeof value === "object") {
      for (const k of Object.keys(value)) flatten(`${prefix}[${k}]`, value[k]);
    } else {
      params.append(prefix, String(value));
    }
  }
  for (const k of Object.keys(body)) flatten(k, body[k]);

  const res = await fetch(`https://api.stripe.com/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || `Stripe API error (${res.status})`;
    throw new Error(`POST ${endpoint} failed: ${msg}`);
  }
  return json;
}

async function createTier(tier) {
  // 1. Product
  const product = await stripeApi("products", {
    name: tier.name,
    description: tier.description,
    metadata: { product: PRODUCT_TAG, tier: tier.id },
  });
  console.log(`  ✓ product ${tier.id}: ${product.id}`);

  // 2. Prices (monthly + yearly recurring)
  const monthlyPrice = await stripeApi("prices", {
    product: product.id,
    unit_amount: tier.monthlyCents,
    currency: "usd",
    recurring: { interval: "month" },
    metadata: { tier: tier.id, period: "monthly" },
  });
  console.log(`  ✓ price ${tier.id}/monthly: ${monthlyPrice.id} (${formatCents(tier.monthlyCents)}/mo)`);

  const yearlyPrice = await stripeApi("prices", {
    product: product.id,
    unit_amount: tier.yearlyCents,
    currency: "usd",
    recurring: { interval: "year" },
    metadata: { tier: tier.id, period: "yearly" },
  });
  console.log(`  ✓ price ${tier.id}/yearly:  ${yearlyPrice.id} (${formatCents(tier.yearlyCents)}/yr)`);

  // 3. Payment Links (one per period)
  const monthlyLink = await stripeApi("payment_links", {
    line_items: [{ price: monthlyPrice.id, quantity: 1 }],
    after_completion: { type: "redirect", redirect: { url: REDIRECT_URL } },
    metadata: { tier: tier.id, period: "monthly" },
    allow_promotion_codes: true,
  });
  console.log(`  ✓ link ${tier.id}/monthly: ${monthlyLink.url}`);

  const yearlyLink = await stripeApi("payment_links", {
    line_items: [{ price: yearlyPrice.id, quantity: 1 }],
    after_completion: { type: "redirect", redirect: { url: REDIRECT_URL } },
    metadata: { tier: tier.id, period: "yearly" },
    allow_promotion_codes: true,
  });
  console.log(`  ✓ link ${tier.id}/yearly:  ${yearlyLink.url}`);

  return {
    tier: tier.id,
    productId: product.id,
    monthlyPriceId: monthlyPrice.id,
    yearlyPriceId: yearlyPrice.id,
    monthlyUrl: monthlyLink.url,
    yearlyUrl: yearlyLink.url,
  };
}

function formatCents(c) {
  return `$${(c / 100).toLocaleString("en-US")}`;
}

async function main() {
  console.log("Syncing Axiom pricing into Stripe…");
  console.log(`Redirect after checkout → ${REDIRECT_URL}`);
  console.log("");

  const results = [];
  for (const tier of TIERS) {
    console.log(`[${tier.id}]`);
    const r = await createTier(tier);
    results.push(r);
    console.log("");
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const artifactPath = path.resolve(`stripe-sync.${ts}.json`);
  fs.writeFileSync(artifactPath, JSON.stringify({ syncedAt: new Date().toISOString(), redirect: REDIRECT_URL, tiers: results }, null, 2));
  console.log(`Wrote artifact → ${artifactPath}`);
  console.log("");

  // Print Vercel env-var block for easy copy-paste.
  console.log("──────────────── VERCEL ENV VARS ────────────────");
  for (const r of results) {
    const slug = r.tier.toUpperCase();
    console.log(`NEXT_PUBLIC_STRIPE_${slug}_MONTHLY=${r.monthlyUrl}`);
    console.log(`NEXT_PUBLIC_STRIPE_${slug}_YEARLY=${r.yearlyUrl}`);
  }
  console.log("─────────────────────────────────────────────────");
  console.log("Update these on Vercel: Project → Settings → Environment Variables.");
  console.log("Then redeploy.");
}

main().catch((err) => {
  console.error("");
  console.error("✗ sync failed:", err.message);
  process.exit(1);
});
