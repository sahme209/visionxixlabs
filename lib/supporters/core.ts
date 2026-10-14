import { createHmac, timingSafeEqual } from "node:crypto";

export const MIN_SUPPORT_CENTS = 100;
// Stripe's common eight-digit upper bound for USD Checkout amounts. This is a
// processor/channel constraint, not a company-imposed contribution ceiling.
export const MAX_STRIPE_USD_CENTS = 99_999_999;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CORRELATION_PATTERN = /^[A-Za-z0-9_-]{16,100}$/;

export type SupporterCheckoutInput = {
  amountCents: number;
  email: string;
  displayName?: string;
  publicName?: string;
  recognitionConsent: boolean;
  updatesOptIn: boolean;
  acceptedTerms: boolean;
  website?: string;
};

export function normalizeCheckoutInput(value: unknown): SupporterCheckoutInput {
  if (!value || typeof value !== "object") throw new Error("Invalid request body.");
  const input = value as Record<string, unknown>;
  const amountCents = Number(input.amountCents);
  const email = String(input.email ?? "").trim().toLowerCase().slice(0, 240);
  const displayName = String(input.displayName ?? "").trim().slice(0, 120) || undefined;
  const publicName = String(input.publicName ?? "").trim().slice(0, 120) || undefined;

  if (!Number.isSafeInteger(amountCents) || amountCents < MIN_SUPPORT_CENTS || amountCents > MAX_STRIPE_USD_CENTS) {
    throw new Error("Enter an amount supported by Stripe, starting at $1.");
  }
  if (!EMAIL_PATTERN.test(email)) throw new Error("Enter a valid email address.");
  if (input.acceptedTerms !== true) throw new Error("Accept the supporter terms to continue.");
  if (input.recognitionConsent === true && !publicName) throw new Error("Enter a recognition name or turn off public recognition.");

  return {
    amountCents,
    email,
    displayName,
    publicName,
    recognitionConsent: input.recognitionConsent === true,
    updatesOptIn: input.updatesOptIn === true,
    acceptedTerms: true,
    website: String(input.website ?? "").trim().slice(0, 240) || undefined,
  };
}

export function assertCorrelationId(value: string | null): string {
  const id = value?.trim() ?? "";
  if (!CORRELATION_PATTERN.test(id)) throw new Error("A valid idempotency key is required.");
  return id;
}

export function supporterCheckoutReadiness() {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
  // Only Stripe test credentials may bypass the live-approval gate. Treat
  // restricted live keys and any future/unknown key format as live so a key
  // format change can never fail open in production.
  const isTest = key.startsWith("sk_test_") || key.startsWith("rk_test_");
  const isLive = Boolean(key) && !isTest;
  const enabled = process.env.AXIOM_SUPPORTER_CHECKOUT_ENABLED === "true";
  const liveApproved = process.env.AXIOM_SUPPORTER_LIVE_APPROVED === "true";
  const dependenciesReady = Boolean(
    key
    && process.env.STRIPE_SUPPORTER_WEBHOOK_SECRET
    && process.env.SUPPORTER_BADGE_SIGNING_SECRET
    && process.env.DATABASE_URL
    && process.env.RESEND_API_KEY,
  );
  return {
    isLive,
    ready: enabled && dependenciesReady && (!isLive || liveApproved),
    reason: !enabled
      ? "Founding Supporter checkout is awaiting approval."
      : !dependenciesReady
        ? "Founding Supporter payment services are not fully configured."
        : isLive && !liveApproved
          ? "Live supporter checkout is awaiting founder, legal, tax, and Stripe approvals."
          : null,
  };
}

function badgeDigest(purchaseId: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`founding-supporter:${purchaseId}`).digest();
}

export function createBadgeToken(purchaseId: string, secret: string): string {
  return badgeDigest(purchaseId, secret).toString("base64url");
}

export function verifyBadgeToken(purchaseId: string, token: string, secret: string): boolean {
  try {
    const expected = badgeDigest(purchaseId, secret);
    const supplied = Buffer.from(token, "base64url");
    return expected.length === supplied.length && timingSafeEqual(expected, supplied);
  } catch {
    return false;
  }
}
