import "server-only";
import { createHash } from "node:crypto";
import { redact } from "@/lib/security/redaction";
import { denyIsolatedExternalIO } from "./isolatedApplication/runtime";
import { applyMargin } from "./aiBillingMargin";
import { publicBillingPolicyEnabled } from "./publicBillingConfig";

export const SMALL_SONNET_MODEL = "anthropic/claude-sonnet-5";
// Existing workspace approval is still checked before every admission.
export const SMALL_GROK_MODEL = "spacexai/grok-4.20-multi-agent";
export const SMALL_GROK_OUTPUT_TOKENS = 1024;
export function supportsSizedAgentRequest(model: string | undefined): model is string {
  return model === SMALL_SONNET_MODEL || model === SMALL_GROK_MODEL;
}
export const SMALL_SONNET_BYTES = 32 * 1024;
const OUTPUT_TOKENS = 4096;
const QUOTE_TTL_MS = 120_000;
type Scope = Readonly<{ organizationId: string; userId: string; correlationId: string }>;
declare const requestBrand: unique symbol;
declare const dispatchBrand: unique symbol;
export type SmallSonnetRequest = { readonly [requestBrand]: true };
export type SmallSonnetDispatch = { readonly [dispatchBrand]: true };
type Evidence = Readonly<{ policy: "small_sonnet_free_v2" | "small_grok_free_v1"; model: string; maximumPayloadBytes: number; maximumOutputTokens: number; estimatedInputTokens: number; estimatedProviderCents: number; estimatedHoldCents: number; reservedCents: number; pricingDigest: string; quotedAt: string }>;
type Quote = Readonly<{ model: string; provider: "anthropic" | "xai"; scope: Scope; digest: string; createdAt: number; reservedCents: number; evidence: Evidence }>;
const quotes = new WeakMap<object, Quote>();
const dispatches = new WeakMap<object, Quote>();
function deny(): never { throw Error("small_agent_request_unavailable"); }

export function smallSonnetPayload(text: string, schemaHint: string) {
  return { prompt: redact(text), system: redact(`Return valid JSON only. The required shape is: ${schemaHint}`) };
}
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
function prices(value: unknown, required: boolean, grok = false): { input: bigint; output: bigint } {
  const p = row(value);
  const known = new Set(["prompt", "completion", "request", "image", "image_output", "web_search", "internal_reasoning", "input_cache_read", "input_cache_write", "discount", "prompt_tiers", "completion_tiers", "input_cache_read_tiers", "input_cache_write_tiers"]);
  if (grok) for (const key of ["x_search_post", "x_search_user", "service_tiers"]) known.add(key);
  if (Object.keys(p).some(key => !known.has(key))) deny();
  // No provider-native search tools are attached to governed JSON decisions.
  // Recognized optional search prices do not authorize those capabilities.
  if (grok) for (const key of ["x_search_post", "x_search_user"]) if (p[key] !== undefined) rate(p[key]);
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
  let input = maximum(["prompt", "input_cache_read", "input_cache_write", "prompt_tiers", "input_cache_read_tiers", "input_cache_write_tiers"]);
  let output = maximum(["completion", "completion_tiers"]);
  if (grok && p.service_tiers !== undefined) {
    const tiers = row(p.service_tiers);
    if (Object.keys(tiers).some(key => key !== "priority")) deny();
    for (const value of Object.values(tiers)) {
      const tier = row(value);
      if (Object.keys(tier).some(key => !["prompt", "completion", "input_cache_read", "long_context"].includes(key))) deny();
      const absorb = (value: Row) => {
        const price = prices(value, true);
        if (price.input > input) input = price.input;
        if (price.output > output) output = price.output;
      };
      const { long_context: longContext, ...standard } = tier;
      absorb(standard);
      if (longContext !== undefined) {
        const { threshold, ...long } = row(longContext);
        if (!Number.isSafeInteger(threshold) || (threshold as number) < 1) deny();
        absorb(long);
      }
    }
  }
  return { input, output };
}

/** Conservative estimated reservation, NOT a guaranteed provider-cost cap.
 * Existing settlement caps customer debits and retains platform overrun cost.
 * Every step needs its own ordinary durable reservation and dispatch claim. */
export async function prepareSmallSonnetRequest(scope: Scope, request: { model: string; text: string; schemaHint: string }, abortSignal?: AbortSignal): Promise<SmallSonnetRequest | undefined> {
  if (!supportsSizedAgentRequest(request.model) || !publicBillingPolicyEnabled() || process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS?.trim()) return undefined;
  const grok = request.model === SMALL_GROK_MODEL;
  const provider = grok ? "xai" : "anthropic";
  const outputTokens = grok ? SMALL_GROK_OUTPUT_TOKENS : OUTPUT_TOKENS;
  const payload = smallSonnetPayload(request.text, request.schemaHint);
  const payloadBytes = Buffer.byteLength(payload.prompt) + Buffer.byteLength(payload.system);
  if (payloadBytes > SMALL_SONNET_BYTES) return undefined;
  // Round upward; price the whole bucket, including the redacted system schema.
  const maximumPayloadBytes = [8192, 16384, SMALL_SONNET_BYTES].find(bytes => payloadBytes <= bytes)!;
  try {
    denyIsolatedExternalIO();
    const response = await fetch(`https://ai-gateway.vercel.sh/v1/models/${request.model}/endpoints`, { cache: "no-store", signal: abortSignal ? AbortSignal.any([abortSignal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000) });
    if (!response.ok) return undefined;
    const text = await response.text();
    if (Buffer.byteLength(text) > 128 * 1024) return undefined;
    const data = row(row(JSON.parse(text)).data), reasoning = row(data.reasoning);
    if (data.id !== request.model || reasoning.mandatory === true || (!grok && reasoning.supports_max_tokens !== true) || !Array.isArray(reasoning.supported_efforts) || !reasoning.supported_efforts.includes("none")) return undefined;
    if (!Array.isArray(data.endpoints) || data.endpoints.length > 64) return undefined;
    const eligible = data.endpoints.map(row).filter(endpoint => endpoint.provider_name === provider);
    if (eligible.length !== 1) return undefined;
    const endpoint = eligible[0];
    if (endpoint.status !== 0 || !Number.isSafeInteger(endpoint.max_completion_tokens) || (endpoint.max_completion_tokens as number) < outputTokens || !Array.isArray(endpoint.supported_parameters) || !endpoint.supported_parameters.includes("max_tokens")) return undefined;
    let { input, output } = prices(endpoint.pricing, true, grok);
    if (endpoint.inference_regions !== undefined) {
      if (!Array.isArray(endpoint.inference_regions) || endpoint.inference_regions.length > 64) return undefined;
      for (const region of endpoint.inference_regions) {
        const regional = prices(row(region).pricing, false, grok);
        if (regional.input > input) input = regional.input;
        if (regional.output > output) output = regional.output;
      }
    }
    if (input <= BigInt(0) || output <= BigInt(0)) return undefined;
    // The immutable digest binds this quote to the complete observed payload.
    // Four tokens/byte for its whole bucket plus8192 overhead remains conservative.
    const estimatedInputTokens = maximumPayloadBytes * 4 + 8192;
    const nanoDollars = BigInt(estimatedInputTokens) * input + BigInt(outputTokens) * output;
    const providerCents = Number((nanoDollars + BigInt(9_999_999)) / BigInt(10_000_000));
    if (!Number.isSafeInteger(providerCents)) return undefined;
    const estimatedHold = Math.ceil(applyMargin(providerCents) * 1.5);
    if (!Number.isSafeInteger(estimatedHold) || estimatedHold < 1 || estimatedHold > 100) return undefined; // Never clip required exposure.
    const handle = Object.freeze({}) as SmallSonnetRequest;
    const createdAt = Date.now();
    const evidence: Evidence = Object.freeze({ policy: grok ? "small_grok_free_v1" : "small_sonnet_free_v2", model: request.model, maximumPayloadBytes, maximumOutputTokens: outputTokens, estimatedInputTokens, estimatedProviderCents: providerCents, estimatedHoldCents: estimatedHold, reservedCents: estimatedHold,
      pricingDigest: createHash("sha256").update(JSON.stringify([request.model, provider, input.toString(), output.toString()])).digest("hex"), quotedAt: new Date(createdAt).toISOString() });
    quotes.set(handle, Object.freeze({ model: request.model, provider, scope: Object.freeze({ ...scope }), digest: digest(request.model, payload.prompt, payload.system, outputTokens), createdAt, reservedCents: estimatedHold, evidence }));
    return handle;
  } catch { return undefined; }
}

/** The reservation transaction also verifies public Free enrollment. */
export function smallSonnetReservation(request: SmallSonnetRequest, scope: { organizationId: string; correlationId?: string }): number {
  const quote = quotes.get(request);
  if (!quote || !live(quote) || quote.scope.organizationId !== scope.organizationId || quote.scope.correlationId !== scope.correlationId) deny();
  return quote.reservedCents;
}

/** Server-owned financial evidence contains no prompt, schema or secret. */
export function smallSonnetReservationEvidence(request: SmallSonnetRequest, scope: Scope): Evidence {
  const quote = quotes.get(request);
  if (!quote || !live(quote) || !scopeMatches(quote.scope, scope)) deny();
  return quote.evidence;
}

/** Called only when consuming the existing admission after its durable claim. */
export function authorizeSmallSonnetDispatch(request: SmallSonnetRequest, binding: Scope & { model?: string; maxTokens?: number; text: string; schemaHint: string }): SmallSonnetDispatch {
  const quote = quotes.get(request);
  quotes.delete(request);
  const payload = smallSonnetPayload(binding.text, binding.schemaHint);
  if (!quote || !live(quote) || !scopeMatches(quote.scope, binding) || binding.model !== quote.model || binding.maxTokens !== quote.evidence.maximumOutputTokens || quote.digest !== digest(binding.model, payload.prompt, payload.system, binding.maxTokens)) deny();
  const dispatch = Object.freeze({}) as SmallSonnetDispatch;
  dispatches.set(dispatch, quote);
  return dispatch;
}

/** Final SDK boundary: a copied, forged, changed or reused request cannot use
 * the cheaper admission or silently change its model/routing/output contract. */
export function consumeSmallSonnetDispatch(dispatch: SmallSonnetDispatch, binding: { organizationId?: string; correlationId?: string; model: string; prompt: string; system?: string; maxTokens?: number }) {
  const quote = dispatches.get(dispatch);
  dispatches.delete(dispatch);
  if (!quote || !live(quote) || binding.organizationId !== quote.scope.organizationId || binding.correlationId !== quote.scope.correlationId || binding.model !== quote.model || binding.maxTokens !== quote.evidence.maximumOutputTokens || binding.system === undefined || quote.digest !== digest(binding.model, binding.prompt, binding.system, binding.maxTokens)) deny();
  return quote.provider === "anthropic"
    ? { gateway: { only: ["anthropic"] }, anthropic: { thinking: { type: "disabled" as const } } }
    : { gateway: { only: ["xai"] } };
}
