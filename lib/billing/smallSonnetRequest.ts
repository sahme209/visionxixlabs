import {assertOnlineAIDispatch} from "@/lib/ai/installationDispatchMode";
import "server-only";
import { readGatewayMetadataText } from "./gatewayMetadataBodyBound";
import { createHash } from "node:crypto";
import { redact } from "@/lib/security/redaction";
import { denyIsolatedExternalIO } from "./isolatedApplication/runtime";
import { applyMargin } from "./aiBillingMargin";
import { publicBillingPolicyEnabled } from "./publicBillingConfig";

export const SMALL_SONNET_MODEL = "anthropic/claude-sonnet-5";
export const SMALL_SONNET_BYTES = 32 * 1024;
const OUTPUT_TOKENS = 4096;
const QUOTE_TTL_MS = 120_000;
type Scope = Readonly<{ organizationId: string; userId: string; correlationId: string }>;
declare const requestBrand: unique symbol;
declare const dispatchBrand: unique symbol;
export type SmallSonnetRequest = { readonly [requestBrand]: true };
export type SmallSonnetDispatch = { readonly [dispatchBrand]: true };
type Evidence = Readonly<{ policy: "small_sonnet_free_v2"; maximumPayloadBytes: number; maximumOutputTokens: number; estimatedInputTokens: number; estimatedProviderCents: number; estimatedHoldCents: number; reservedCents: number; pricingDigest: string; quotedAt: string }>;
type Quote = Readonly<{ scope: Scope; digest: string; createdAt: number; reservedCents: number; evidence: Evidence }>;
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

/** Conservative estimated reservation, NOT a guaranteed provider-cost cap.
 * Existing settlement caps customer debits and retains platform overrun cost.
 * Every step needs its own ordinary durable reservation and dispatch claim. */
export async function prepareSmallSonnetRequest(scope: Scope, request: { model: string; text: string; schemaHint: string }, abortSignal?: AbortSignal): Promise<SmallSonnetRequest | undefined> {
  assertOnlineAIDispatch();
  if (request.model !== SMALL_SONNET_MODEL || !publicBillingPolicyEnabled() || process.env.AXIOM_AI_MAX_REQUEST_CREDITS_CENTS?.trim()) return undefined;
  const payload = smallSonnetPayload(request.text, request.schemaHint);
  const payloadBytes = Buffer.byteLength(payload.prompt) + Buffer.byteLength(payload.system);
  if (payloadBytes > SMALL_SONNET_BYTES) return undefined;
  // Round upward; price the whole bucket, including the redacted system schema.
  const maximumPayloadBytes = [8192, 16384, SMALL_SONNET_BYTES].find(bytes => payloadBytes <= bytes)!;
  try {
    denyIsolatedExternalIO();assertOnlineAIDispatch();
    const metadataSignal = abortSignal ? AbortSignal.any([abortSignal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000);
    const response = await fetch(`https://ai-gateway.vercel.sh/v1/models/${SMALL_SONNET_MODEL}/endpoints`, { cache: "no-store", signal: metadataSignal });
    if (!response.ok) return undefined;
    const text = await readGatewayMetadataText(response, metadataSignal);
    const data = row(row(JSON.parse(text)).data), reasoning = row(data.reasoning);
    if (data.id !== SMALL_SONNET_MODEL || reasoning.mandatory === true || reasoning.supports_max_tokens !== true || !Array.isArray(reasoning.supported_efforts) || !reasoning.supported_efforts.includes("none")) return undefined;
    if (!Array.isArray(data.endpoints) || data.endpoints.length > 64) return undefined;
    const eligible = data.endpoints.map(row).filter(endpoint => endpoint.provider_name === "anthropic");
    if (eligible.length !== 1) return undefined;
    const endpoint = eligible[0];
    if (endpoint.status !== 0 || !Number.isSafeInteger(endpoint.max_completion_tokens) || (endpoint.max_completion_tokens as number) < OUTPUT_TOKENS || !Array.isArray(endpoint.supported_parameters) || !endpoint.supported_parameters.includes("max_tokens")) return undefined;
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
    const handle = Object.freeze({}) as SmallSonnetRequest;
    const createdAt = Date.now();
    const evidence: Evidence = Object.freeze({ policy: "small_sonnet_free_v2", maximumPayloadBytes, maximumOutputTokens: OUTPUT_TOKENS, estimatedInputTokens, estimatedProviderCents: providerCents, estimatedHoldCents: estimatedHold, reservedCents: estimatedHold,
      pricingDigest: createHash("sha256").update(JSON.stringify([SMALL_SONNET_MODEL, "anthropic", input.toString(), output.toString()])).digest("hex"), quotedAt: new Date(createdAt).toISOString() });
    quotes.set(handle, Object.freeze({ scope: Object.freeze({ ...scope }), digest: digest(request.model, payload.prompt, payload.system, OUTPUT_TOKENS), createdAt, reservedCents: estimatedHold, evidence }));
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
  if (!quote || !live(quote) || !scopeMatches(quote.scope, binding) || binding.model !== SMALL_SONNET_MODEL || binding.maxTokens !== OUTPUT_TOKENS || quote.digest !== digest(binding.model, payload.prompt, payload.system, binding.maxTokens)) deny();
  const dispatch = Object.freeze({}) as SmallSonnetDispatch;
  dispatches.set(dispatch, quote);
  return dispatch;
}

/** Final SDK boundary: a copied, forged, changed or reused request cannot use
 * the cheaper admission or silently change its model/routing/output contract. */
export function consumeSmallSonnetDispatch(dispatch: SmallSonnetDispatch, binding: { organizationId?: string; correlationId?: string; model: string; prompt: string; system?: string; maxTokens?: number }) {
  const quote = dispatches.get(dispatch);
  dispatches.delete(dispatch);
  if (!quote || !live(quote) || binding.organizationId !== quote.scope.organizationId || binding.correlationId !== quote.scope.correlationId || binding.model !== SMALL_SONNET_MODEL || binding.maxTokens !== OUTPUT_TOKENS || binding.system === undefined || quote.digest !== digest(binding.model, binding.prompt, binding.system, binding.maxTokens)) deny();
  return { gateway: { only: ["anthropic"] }, anthropic: { thinking: { type: "disabled" } } };
}
