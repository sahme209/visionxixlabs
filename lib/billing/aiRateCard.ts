/**
 * AI rate card — the single, versioned source for every customer-facing AI
 * price in Axiom (user decision 2026-11-08).
 *
 * Axiom itself is free to explore. Prepaid AI usage is the only paid part:
 *   customer price = marginMultiplier × provider-cost budget.
 *
 * Consumers:
 *   - `aiBillingMargin.ts` (usage ledger margin) reads `marginMultiplier`.
 *   - `addOnCatalog.ts` derives each credit pack's delivered credit with
 *     `deliveredCreditCentsForPrice` and its provider-cost budget with
 *     `providerCostBudgetCentsForPrice`.
 *   - The public "Get started" page (`/plans`) renders `perModelRates`,
 *     limits, refund rules and disclosures directly from this object.
 *
 * Hold vs final price: before an action runs, Axiom places a conservative
 * HOLD on the prepaid balance (`lib/ai/codingRequestQuote.ts`,
 * `smallSonnet55Request.ts`). The hold assumes the maximum output tokens and
 * adds a safety factor, so it is intentionally larger than the expected
 * price. It is not a price. After the provider reports actual usage, the
 * FINAL debit is `marginMultiplier × actual provider cost`, never more than
 * the hold, and the unused part of the hold is released. A failed action is
 * released in full. The balance can never go below zero: Axiom never charges
 * beyond what was prepaid.
 *
 * Ledger units: usage is debited from the prepaid balance at CUSTOMER price
 * (`UsageEvent.billedCents` = `applyMargin(provider cost)`), so a $10 top-up
 * credits 1,000 cents of balance, which buys 1000 / 1.5 = 666 cents of
 * provider cost. Crediting price / 1.5 instead would apply the margin twice
 * (2.25x). The 1.5x is therefore applied exactly once, at debit time.
 *
 * A change to any value here is a pricing change: bump `version`, update the
 * Pricing & Usage demo scenario and `planRegistry.ts` in the same change.
 * This module performs no charge and reads no environment variable.
 */

export interface AIModelRate {
  /** Gateway model id. */
  model: string;
  displayName: string;
  /** Provider cost in USD per million tokens (source + fetch date below). */
  providerUsdPerMTok: { input: number; cachedInput: number; output: number };
}

export const AI_RATE_CARD = {
  version: "ai_rate_card_v1",
  effectiveDate: "2026-11-08",
  currency: "usd",
  /** customer price = marginMultiplier × provider cost. */
  marginMultiplier: 1.5,
  /** Smallest prepaid top-up a customer can buy, in cents. */
  minimumTopUpCents: 1_000,
  /** Prepaid credits never expire. */
  creditsExpire: false,
  /** Unused prepaid balance is refundable on request within this many days of purchase. */
  refundWindowDays: 30,
  /** Counted deployments every organization gets each calendar month (UTC). */
  freeMonthlyDeployments: 10,
  /** Enterprise evaluation shape (no public seat price). */
  enterpriseEvaluation: { minDays: 30, maxDays: 60, aiCreditGrant: "capped, agreed per evaluation" },
  byok: "available in enterprise evaluations",
  providerRateSource: "https://platform.claude.com/docs/en/about-claude/pricing (fetched 2026-11-08)",
  perModelRates: [
    {
      model: "anthropic/claude-sonnet-5.5",
      displayName: "Claude Sonnet 5.5",
      providerUsdPerMTok: { input: 2.0, cachedInput: 0.1, output: 10.0 },
    },
  ] as const satisfies readonly AIModelRate[],
  refundRules: [
    "Unused prepaid balance is refundable on request within 30 days of purchase.",
    "A failed action is released automatically; you are not charged for it.",
    "The unused part of every pre-action hold is released when the action finishes.",
  ],
  disclosures: [
    "Axiom is free to explore. Prepaid AI usage is the only paid part.",
    "The cost of an AI action is shown before it runs.",
    "You are never charged more than you prepaid. There is no automatic top-up and no post-use billing.",
    "Prepaid credits never expire.",
    "The minimum top-up is $10, paid once through Stripe Checkout. No subscription is created.",
    "Customer price is 1.5× the provider's published token cost.",
    "Bring your own key (BYOK) is available in enterprise evaluations.",
  ],
} as const;

export type AIRateCard = typeof AI_RATE_CARD;

/** Customer USD per million tokens for one model and token kind. */
export function customerUsdPerMTok(rate: AIModelRate, kind: keyof AIModelRate["providerUsdPerMTok"]): number {
  return Math.round(rate.providerUsdPerMTok[kind] * AI_RATE_CARD.marginMultiplier * 1_000_000) / 1_000_000;
}

/** Customer price in cents for an integer-cents provider cost. */
export function customerPriceCents(providerCostCents: number): number {
  if (!Number.isSafeInteger(providerCostCents) || providerCostCents < 0) throw new Error("provider_cost_cents_invalid");
  return Math.round(providerCostCents * AI_RATE_CARD.marginMultiplier);
}

function assertTopUp(priceCents: number): void {
  if (!Number.isSafeInteger(priceCents) || priceCents < AI_RATE_CARD.minimumTopUpCents) throw new Error("top_up_below_minimum");
}

/** Prepaid balance credited for a top-up, in customer-price cents (= price). */
export function deliveredCreditCentsForPrice(priceCents: number): number {
  assertTopUp(priceCents);
  return priceCents;
}

/**
 * Provider-cost budget a top-up buys: price / multiplier, rounded down so the
 * customer price is never less than 1.5x the provider cost it covers.
 */
export function providerCostBudgetCentsForPrice(priceCents: number): number {
  assertTopUp(priceCents);
  return Math.floor(priceCents / AI_RATE_CARD.marginMultiplier);
}

export function isAllowedTopUpCents(priceCents: number): boolean {
  return Number.isSafeInteger(priceCents) && priceCents >= AI_RATE_CARD.minimumTopUpCents;
}

/**
 * Expected cost range per agent effort level (user decision 2026-11-08: one 1.5x for every
 * level; the price rises naturally with steps and model). These are ESTIMATES for the public
 * page, not quotes: the exact hold is shown before every action, and the final debit is
 * 1.5x the actual provider cost. Step limits come from `resolveAgentEffortProfile`
 * (lib/axiom/agentRuntime/decisionLoop.ts); output per step is capped at 4,096 tokens.
 */
export const EFFORT_LEVEL_ESTIMATE = {
  /** A light step: short context, short answer. */
  lightStep: { inputTokens: 4_000, outputTokens: 500 },
  /** A heavy step: large repository context and the maximum output. */
  heavyStep: { inputTokens: 30_000, outputTokens: 4_096 },
  levels: [
    { label: "Inspect", maxSteps: 2, use: "Read-only questions and explanations." },
    { label: "Engineer", maxSteps: 4, use: "Default: investigate and prepare a reviewed proposal." },
    { label: "DeepOps", maxSteps: 6, use: "Larger multi-step investigations." },
  ],
} as const;

function stepCustomerCents(step: { inputTokens: number; outputTokens: number }, rate: AIModelRate): number {
  const providerCents = (step.inputTokens * rate.providerUsdPerMTok.input + step.outputTokens * rate.providerUsdPerMTok.output) / 10_000;
  return providerCents * AI_RATE_CARD.marginMultiplier;
}

/**
 * Low = an action that finishes in one light step; high = every allowed step is heavy.
 * Rounded outward to whole cents, so the shown range never understates.
 */
export function effortLevelCostRangeCents(label: (typeof EFFORT_LEVEL_ESTIMATE.levels)[number]["label"], rate: AIModelRate = AI_RATE_CARD.perModelRates[0]): { lowCents: number; highCents: number; maxSteps: number } {
  const level = EFFORT_LEVEL_ESTIMATE.levels.find((l) => l.label === label);
  if (!level) throw new Error("effort_level_unknown");
  return {
    lowCents: Math.floor(stepCustomerCents(EFFORT_LEVEL_ESTIMATE.lightStep, rate)),
    highCents: Math.ceil(stepCustomerCents(EFFORT_LEVEL_ESTIMATE.heavyStep, rate) * level.maxSteps),
    maxSteps: level.maxSteps,
  };
}
