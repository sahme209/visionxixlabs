/**
 * Pure whoami response composer — Phase 399.
 *
 * Turns the inputs to `/api/v1/whoami` (auth result + quota snapshot)
 * into the canonical JSON body. Pure so the same shape can be exercised
 * by tests + future tooling (SDK validators) without spinning up a
 * Postgres mock.
 *
 * The body purposely excludes anything that would leak internal state:
 *   - no `keyHash`
 *   - no internal database row id beyond the `apiKeyId` already minted
 *   - no plaintext anywhere
 *
 * Useful as a 3-line integration test for engineers building against
 * the v1 surface — call /api/v1/whoami with their key and read back
 * the scopes / env / quota they have available.
 */

import type { ApiKeyScope } from "./apiKeyScope";
import type { QuotaDecision } from "./computeApiQuota";

export interface WhoamiResponse {
  /** Always present on success. */
  ok: true;
  /** The api key the bearer authenticated as. */
  apiKey: {
    id: string;
    env: "live" | "test";
    scopes: ReadonlyArray<ApiKeyScope>;
  };
  /** Workspace the key belongs to. */
  organization: {
    id: string;
    /** Plan tier display name — useful for SDK to show "Starter / Growth / ..." */
    planTier: string;
  };
  /** Current monthly v1 quota snapshot. */
  quota: {
    monthlyLimit: number | null;
    currentCalls: number;
    remaining: number | null;
    ratio: number | null;
    /** True when quota gate is at warning threshold (>=90% by default). */
    nearLimit: boolean;
  };
  /** Server time in seconds since epoch — handy for SDK clock-skew checks. */
  serverTimeSec: number;
}

export interface ComposeWhoamiInput {
  apiKeyId: string;
  env: "live" | "test";
  scopes: ReadonlyArray<ApiKeyScope>;
  organizationId: string;
  planTier: string;
  quota: QuotaDecision;
  /** Pass for deterministic tests; defaults to Date.now() in seconds. */
  serverTimeSec?: number;
}

export function composeWhoamiResponse(input: ComposeWhoamiInput): WhoamiResponse {
  const ratio = input.quota.ratio;
  const nearLimit = typeof ratio === "number" && ratio >= 0.9;

  // The +1 reflects "the in-flight whoami call we just authed" — current
  // quota count from authenticateApiKey is BEFORE the UsageEvent write,
  // so the user-visible "currentCalls" should already include this call.
  const currentCalls = input.quota.currentCalls + 1;

  // remaining decrements by 1 too, but never goes below 0 nor disturbs
  // the unlimited (null) tier.
  let remaining: number | null;
  if (input.quota.remaining === null) {
    remaining = null;
  } else {
    remaining = Math.max(0, input.quota.remaining - 1);
  }

  return {
    ok: true,
    apiKey: {
      id: input.apiKeyId,
      env: input.env,
      scopes: input.scopes,
    },
    organization: {
      id: input.organizationId,
      planTier: input.planTier,
    },
    quota: {
      monthlyLimit: input.quota.monthlyLimit,
      currentCalls,
      remaining,
      ratio: input.quota.ratio,
      nearLimit,
    },
    serverTimeSec: input.serverTimeSec ?? Math.floor(Date.now() / 1000),
  };
}
