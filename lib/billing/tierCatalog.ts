/**
 * Billing tier catalog.
 *
 * Closed union of every plan literal Axiom recognises. Adding a tier
 * is a deliberate edit here + the Prisma TenantBillingPlan row's
 * tier column accepts only these literals at the API boundary.
 *
 * Why a typed catalog (vs Stripe metadata): operators see the same
 * tier label whether or not Stripe is configured. The Stripe layer
 * maps tier → Price ID via env (STRIPE_PRICE_<TIER>) so we never
 * hardcode a price.
 */

export type BillingTier = "trial" | "starter" | "growth" | "enterprise";

export type BillingStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "no_plan";

export interface TierSpec {
  tier: BillingTier;
  label: string;
  /** One-paragraph operator-readable description. */
  description: string;
  /** Hard caps enforced at the API boundary. */
  caps: {
    /** Max autonomy cycles per day. -1 means unlimited. */
    autonomyCyclesPerDay: number;
    /** Max staged runbooks at one time. */
    stagedRunbooks: number;
    /** Max outbound notifications per day. */
    outboundPerDay: number;
    /** Max distinct cloud connectors. */
    cloudConnectors: number;
  };
  /** When non-null, this tier requires a paid Stripe subscription. */
  requiresStripe: boolean;
}

export const TIER_CATALOG: TierSpec[] = [
  {
    tier: "trial",
    label: "14-day trial",
    description: "Full feature access for evaluation. Caps prevent runaway spend. Converts to 'starter' if no plan is selected before expiry.",
    caps: {
      autonomyCyclesPerDay: 48,
      stagedRunbooks: 25,
      outboundPerDay: 500,
      cloudConnectors: 3,
    },
    requiresStripe: false,
  },
  {
    tier: "starter",
    label: "Starter",
    description: "One cloud · daily autonomy ticks · Slack-only outbound · runbook queue. Right-sized for a single team.",
    caps: {
      autonomyCyclesPerDay: 96,
      stagedRunbooks: 50,
      outboundPerDay: 1000,
      cloudConnectors: 1,
    },
    requiresStripe: true,
  },
  {
    tier: "growth",
    label: "Growth",
    description: "All three clouds · 15-minute autonomy ticks · multi-channel outbound · policy previews + terraform draft.",
    caps: {
      autonomyCyclesPerDay: 480,
      stagedRunbooks: 250,
      outboundPerDay: 5000,
      cloudConnectors: 5,
    },
    requiresStripe: true,
  },
  {
    tier: "enterprise",
    label: "Enterprise",
    description: "Unlimited cycles + connectors + outbound. Cross-tenant admin, per-tenant Slack routing, custom SCP recipes.",
    caps: {
      autonomyCyclesPerDay: -1,
      stagedRunbooks: -1,
      outboundPerDay: -1,
      cloudConnectors: -1,
    },
    requiresStripe: true,
  },
];

const TIER_SET = new Set<string>(TIER_CATALOG.map((t) => t.tier));

export function isBillingTier(v: string): v is BillingTier {
  return TIER_SET.has(v);
}

export function tierSpec(tier: BillingTier): TierSpec {
  const spec = TIER_CATALOG.find((t) => t.tier === tier);
  if (!spec) throw new Error(`Unknown billing tier: ${tier}`);
  return spec;
}

const TIER_ALLOW: Record<BillingTier, Set<string>> = {
  trial: new Set(["help", "self-diagnostic", "cron-health"]),
  starter: new Set([
    "help", "self-diagnostic", "cron-health",
    "runbooks", "outbound-slack", "rationale-audit",
  ]),
  growth: new Set([
    "help", "self-diagnostic", "cron-health",
    "runbooks", "outbound-slack", "rationale-audit",
    "policy-previews", "terraform-draft", "scp-simulator",
    "multi-cloud-inventory", "network-topology",
  ]),
  enterprise: new Set([
    "help", "self-diagnostic", "cron-health",
    "runbooks", "outbound-slack", "rationale-audit",
    "policy-previews", "terraform-draft", "scp-simulator",
    "multi-cloud-inventory", "network-topology",
    "admin-cross-tenant", "custom-recipes", "field-encryption",
  ]),
};

/** Union of every feature key any tier knows about. */
const KNOWN_FEATURES: Set<string> = new Set(
  Object.values(TIER_ALLOW).flatMap((s) => Array.from(s)),
);

/**
 * Returns true when a feature key is allowed under a given tier.
 * Unknown feature keys default to allowed (we don't gate features
 * the catalog doesn't list). Known features are checked against the
 * tier's allow set.
 */
export function tierAllows(tier: BillingTier, feature: string): boolean {
  if (!KNOWN_FEATURES.has(feature)) return true;
  return TIER_ALLOW[tier].has(feature);
}
