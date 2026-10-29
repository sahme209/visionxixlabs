import "server-only";
import { createHash } from "node:crypto";
import { smallSonnetPayload } from "./smallSonnetRequest";
import { denyIsolatedExternalIO } from "./isolatedApplication/runtime";
import { applyMargin } from "./aiBillingMargin";
import { publicBillingPolicyEnabled } from "./publicBillingConfig";

export const SMALL_SONNET_55_MODEL = "anthropic/claude-sonnet-5.5";
export const SMALL_SONNET_55_BYTES = 32 * 1024;
export const SMALL_SONNET_55_OUTPUT_TOKENS = 4096;
const OUTPUT_TOKENS = SMALL_SONNET_55_OUTPUT_TOKENS;
const QUOTE_TTL_MS = 120_000;
type Scope = Readonly<{ organizationId: string; userId: string; correlationId: string }>;
declare const requestBrand: unique symbol;
declare const dispatchBrand: unique symbol;
export type SmallSonnet55Request = { readonly [requestBrand]: true };
export type SmallSonnet55Dispatch = { readonly [dispatchBrand]: true };
type Evidence = Readonly<{ policy: "small_sonnet55_anthropic_messages_v1"; maximumPayloadBytes: number; maximumOutputTokens: number; estimatedInputTokens: number; estimatedProviderCents: number; estimatedHoldCents: number; reservedCents: number; pricingDigest: string; quotedAt: string }>;
type Quote = Readonly<{ scope: Scope; digest: string; createdAt: number; reservedCents: number; evidence: Evidence }>;
const quotes = new WeakMap<object, Quote>();
const dispatches = new WeakMap<object, Quote>();
function deny(): never { throw Error("small_sonnet55_request_unavailable"); }

export const smallSonnet55Payload = smallSonnetPayload;
function digest(model: string, prompt: string, system: string, maxTokens: number): string {
  return createHash("sha256").update(JSON.stringify([model, prompt, system, maxTokens])).digest("hex");
}
function live(quote: Quote): boolean {
  const age = Date.now() - quote.createdAt;
  return age >= 0 && age <= QUOTE_TTL_MS;
}
function scopeMatches(a: Scope, b: Scope): boolean {
  return a.organizationId === b.organizationId && a.userId === b.userId && a.correlationId === b.correlationId;
}
type Row = Record<string, unknown>;
function row(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) deny();
  return value as Row;
}
// Exact nano-dollar arithmetic: metadata float rounding never lowers a hold.
function rate(value: unknown): bigint {
  if (typeof value !== "string" || !/^\d{1,3}(?:\.\d{1,9})?$/.test(value)) deny();
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole) * BigInt(1_000_000_000) + BigInt(fraction.padEnd(9, "0"));
}
function prices(value: unknown, required: boolean): { input: bigint; output: bigint } {
  const p = row(value);
  const known = new Set(["prompt", "completion", "request", "image", "image_output", "web_search", "internal_reasoning", "input_cache_read", "input_cache_write", "discount", "prompt_tiers", "completion_tiers", "input_cache_read_tiers", "input_cache_write_tiers"]);
  if (Object.keys(p).some(key => !known.has(key))) deny();
  if (required && (p.prompt === undefined || p.completion === undefined)) deny();
  if (p.request !== undefined && rate(p.request) !== BigInt(0) || p.internal_reasoning !== undefined && rate(p.internal_reasoning) !== BigInt(0) || p.discount !== undefined && p.discount !== 0) deny();
  const maximum = (keys: string[]) => {
    let maximum = BigInt(0);
    for (const key of keys) {
      if (p[key] === undefined) continue;
      if (key.endsWith("_tiers")) {
        if (!Array.isArray(p[key]) || p[key].length > 32) deny();
        for (const tier of p[key]) { const value = rate(row(tier).cost); if (value > maximum) maximum = value; }
      } else { const value = rate(p[key]); if (value > maximum) maximum = value; }
    }
    return maximum;
  };
  return { input: maximum(["prompt", "input_cache_read", "input_cache_write", "prompt_tiers", "input_cache_read_tiers", "input_cache_write_tiers"]), output: maximum(["completion", "completion_tiers"]) };
}

/** Separate Sonnet55 capability: no production admission wiring is implied.
 * Conservative estimated reservation, NOT a guaranteed provider-cost cap.
 * Existing settlement caps customer debits and retains platform overrun cost.
 * Every step needs its own ordinary durable reservation and dispatch claim. */
export async function prepareSmallSonnet55Request(scope: Scope, request: { model: string; text: string; schemaHint: string }, abortSignal?: AbortSignal): Promise<SmallSonnet55Request | undefined> {
  if (request.model !== SMALL_SONNET_55_MODEL || !publicBillingPolicyEnabled() || process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS?.trim()) return undefined;
  const payload = smallSonnet55Payload(request.text, request.schemaHint);
  const payloadBytes = Buffer.byteLength(payload.prompt) + Buffer.byteLength(payload.system);
  if (payloadBytes > SMALL_SONNET_55_BYTES) return undefined;
  // Round upward; price the whole bucket, including the redacted system schema.
  const maximumPayloadBytes = [8192, 16384, SMALL_SONNET_55_BYTES].find(bytes => payloadBytes <= bytes)!;
  try {
    denyIsolatedExternalIO();
    const response = await fetch(`https://ai-gateway.vercel.sh/v1/models/${SMALL_SONNET_55_MODEL}/endpoints`, { cache: "no-store", signal: abortSignal ? AbortSignal.any([abortSignal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const text = await response.text();
    if (Buffer.byteLength(text) > 128 * 1024) return undefined;
    const data = row(row(JSON.parse(text)).data), reasoning = row(data.reasoning);
    // Sonnet55 has no disabled-thinking contract. Its separate raw Anthropic
    // Messages adapter binds max_tokens to TOTAL output, including thinking.
    // Do not reinterpret missing generic SDK reasoning metadata as SDK safety.
    if (data.id !== SMALL_SONNET_55_MODEL || reasoning.supports_max_tokens === false || !Array.isArray(reasoning.supported_efforts) || !reasoning.supported_efforts.includes("low")) return undefined;
    if (!Array.isArray(data.endpoints) || data.endpoints.length > 64) return undefined;
    const eligible = data.endpoints.map(row).filter(endpoint => endpoint.provider_name === "anthropic");
    if (eligible.length !== 1) return undefined;
    const endpoint = eligible[0];
    if (endpoint.status !== 0 || !Number.isSafeInteger(endpoint.max_completion_tokens) || (endpoint.max_completion_tokens as number) < OUTPUT_TOKENS || !Array.isArray(endpoint.supported_parameters) || !endpoint.supported_parameters.includes("max_tokens") || !endpoint.supported_parameters.includes("reasoning")) return undefined;
    let { input, output } = prices(endpoint.pricing, true);
    if (endpoint.inference_regions !== undefined) {
      if (!Array.isArray(endpoint.inference_regions) || endpoint.inference_regions.length > 64) return undefined;
      for (const region of endpoint.inference_regions) {
        const regional = prices(row(region).pricing, false);
        if (regional.input > input) input = regional.input;
        if (regional.output > output) output = regional.output;
      }
    }
    if (input <= BigInt(0) || output <= BigInt(0)) return undefined;
    // The immutable digest binds this quote to the complete observed payload.
    // Four tokens/byte for its whole bucket plus8192 overhead remains conservative.
    const estimatedInputTokens = maximumPayloadBytes * 4 + 8192;
    const nanoDollars = BigInt(estimatedInputTokens) * input + BigInt(OUTPUT_TOKENS) * output;
    const providerCents = Number((nanoDollars + BigInt(9_999_999)) / BigInt(10_000_000));
    if (!Number.isSafeInteger(providerCents)) return undefined;
    const estimatedHold = Math.ceil(applyMargin(providerCents) * 1.5);
    if (!Number.isSafeInteger(estimatedHold) || estimatedHold < 1 || estimatedHold > 100) return undefined; // Never clip required exposure.
    const handle = Object.freeze({}) as SmallSonnet55Request;
    const createdAt = Date.now();
    const evidence: Evidence = Object.freeze({ policy: "small_sonnet55_anthropic_messages_v1", maximumPayloadBytes, maximumOutputTokens: OUTPUT_TOKENS, estimatedInputTokens, estimatedProviderCents: providerCents, estimatedHoldCents: estimatedHold, reservedCents: estimatedHold,
      pricingDigest: createHash("sha256").update(JSON.stringify([SMALL_SONNET_55_MODEL, "anthropic", input.toString(), output.toString()])).digest("hex"), quotedAt: new Date(createdAt).toISOString() });
    quotes.set(handle, Object.freeze({ scope: Object.freeze({ ...scope }), digest: digest(request.model, payload.prompt, payload.system, OUTPUT_TOKENS), createdAt, reservedCents: estimatedHold, evidence }));
    return handle;
  } catch { return undefined; }
}

/** The reservation transaction also verifies public Free enrollment. */
export function smallSonnet55Reservation(request: SmallSonnet55Request, scope: { organizationId: string; correlationId?: string }): number {
  const quote = quotes.get(request);
  if (!quote || !live(quote) || quote.scope.organizationId !== scope.organizationId || quote.scope.correlationId !== scope.correlationId) deny();
  return quote.reservedCents;
}

/** Server-owned financial evidence contains no prompt, schema or secret. */
export function smallSonnet55ReservationEvidence(request: SmallSonnet55Request, scope: Scope): Evidence {
  const quote = quotes.get(request);
  if (!quote || !live(quote) || !scopeMatches(quote.scope, scope)) deny();
  return quote.evidence;
}

/** Called only when consuming the existing admission after its durable claim. */
export function authorizeSmallSonnet55Dispatch(request: SmallSonnet55Request, binding: Scope & { model?: string; maxTokens?: number; text: string; schemaHint: string }): SmallSonnet55Dispatch {
  const quote = quotes.get(request);
  quotes.delete(request);
  const payload = smallSonnet55Payload(binding.text, binding.schemaHint);
  if (!quote || !live(quote) || !scopeMatches(quote.scope, binding) || binding.model !== SMALL_SONNET_55_MODEL || binding.maxTokens !== OUTPUT_TOKENS || quote.digest !== digest(binding.model, payload.prompt, payload.system, binding.maxTokens)) deny();
  const dispatch = Object.freeze({}) as SmallSonnet55Dispatch;
  dispatches.set(dispatch, quote);
  return dispatch;
}

/** Dedicated raw Anthropic Messages boundary only; never SDK providerOptions.
 * Final boundary: a copied, forged, changed or reused request cannot use
 * the cheaper admission or silently change its model/routing/output contract. */
export function consumeSmallSonnet55Dispatch(dispatch: SmallSonnet55Dispatch, binding: { organizationId?: string; correlationId?: string; model: string; prompt: string; system?: string; maxTokens?: number }) {
  const quote = dispatches.get(dispatch);
  dispatches.delete(dispatch);
  if (!quote || !live(quote) || binding.organizationId !== quote.scope.organizationId || binding.correlationId !== quote.scope.correlationId || binding.model !== SMALL_SONNET_55_MODEL || binding.maxTokens !== OUTPUT_TOKENS || binding.system === undefined || quote.digest !== digest(binding.model, binding.prompt, binding.system, binding.maxTokens)) deny();
  return Object.freeze({
    wireContract: "anthropic_messages_v1" as const,
    model: SMALL_SONNET_55_MODEL,
    maxTokens: OUTPUT_TOKENS,
    thinking: Object.freeze({ type: "between_tools" as const }),
    outputConfig: Object.freeze({ effort: "low" as const }),
    gateway: Object.freeze({ only: Object.freeze(["anthropic"] as const) }),
  });
}
