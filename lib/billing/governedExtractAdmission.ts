import {codingClaimBinding,reserveQuotedCodingCall,dispatchQuotedCodingCall} from "@/lib/workforce/pipelines/codingRunReservation";
import {prepareCodingRequestEnvelope,quoteCodingRequest,consumeCodingManagerQuoteForRequest,type CodingManagerQuote} from "@/lib/ai/codingRequestQuote";
import {reserveCodingCall,dispatchCodingCall,releaseCodingCall,lockCodingFinancial,linkCodingUsage,type CodingRunClaim} from "@/lib/workforce/pipelines/codingRunReservation";
import {recordAttributedUsageV2} from "./newTestSubscription/usageAllocationIO";
import { boundedAIInput, boundedStructuredAIInput } from "@/lib/ai/inputByteBound";
import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { AIStructuredResponse } from "@/lib/ai/AIProvider";
import { prisma } from "@/lib/db";
import { claimLegacyAICreditDispatch, releaseAICreditReservation, reserveAICredits, type AICreditReservationResult } from "./aiCreditReservation";
import { denyIsolatedExternalIO } from "./isolatedApplication/runtime";
import { claimNewTestBillableDispatch } from "./newTestSubscription/usageAllocationIO";
import { recordAIUsageEvent, recordReservedAIUsageEventV2, type RecordAIUsageInput } from "./recordAIUsageEvent";
import { AICreditAdmissionRefusal } from "./aiCreditAdmissionRefusal";
import { prepareSmallSonnetRequest, smallSonnetReservation, smallSonnetReservationEvidence, authorizeSmallSonnetDispatch, type SmallSonnetRequest } from "./smallSonnetRequest";
import { prepareSmallSonnet55Request, smallSonnet55Reservation, smallSonnet55ReservationEvidence, authorizeSmallSonnet55Dispatch, SMALL_SONNET_55_MODEL, type SmallSonnet55Request } from "./smallSonnet55Request";
import { requestReservationCents } from "./requestReservationCents";

type Scope = Readonly<{ organizationId: string; userId: string; correlationId: string; source?: "coding_proposal"; codingRunClaim?: CodingRunClaim; codingPhase?: "initial"|"refinement"; codingModel?: string }>;
declare const admissionBrand: unique symbol;
/** No serializable flag or constructor. Only a committed durable claim mints it. */
export type GovernedExtractAdmission = { readonly [admissionBrand]: true };
export type GovernedAIAdmission = GovernedExtractAdmission;
type Task = "generate_text" | "extract_structured_data";
type AdmissionResult = { ok: true; admission: GovernedAIAdmission } | { ok: false; error: Extract<AICreditReservationResult, { ok: false }>["error"] | "request_already_reserved" };
const admissions = new WeakMap<object, Readonly<{ scope: Scope; reservationId: string; v2: boolean; task: Task; small?: SmallSonnetRequest; small55?: SmallSonnet55Request; codingManager?: CodingManagerQuote }>>();
function deny(): never { throw new Error("governed_extract_admission_unavailable"); }

export function governedExtractReservationKey(scope: Scope): string {
  return "agent_extract_" + createHash("sha256").update(JSON.stringify(["axiom-governed-extract-v1", scope.organizationId, scope.userId, scope.correlationId])).digest("hex");
}

export async function admitGovernedExtract(input: Scope, request?: { model: string; text: string; schemaHint: string }, abortSignal?: AbortSignal): Promise<GovernedExtractAdmission> {
  abortSignal?.throwIfAborted();
  if (request) boundedStructuredAIInput(request.text, request.schemaHint);
  const small55 = request?.model === SMALL_SONNET_55_MODEL ? await prepareSmallSonnet55Request(input, request, abortSignal) : undefined;
  abortSignal?.throwIfAborted();
  // Exact55 uses a separate reviewed wire contract. An invalid quote cannot fall back.
  if (request?.model === SMALL_SONNET_55_MODEL && !small55) deny();
  const small = request && !small55 ? await prepareSmallSonnetRequest(input, request, abortSignal) : undefined;
  abortSignal?.throwIfAborted();
  const result = await reserveAndClaim(input, governedExtractReservationKey(input), "extract_structured_data", small, abortSignal, small55);
  if (!result.ok) {
    if (result.error === "ai_credit_pool_exhausted") throw new AICreditAdmissionRefusal();
    deny();
  }
  return result.admission;
}

/** The generic route retains its validated public header key and error mapping.
 * Task selection and v2 classification are server-owned, never body flags. */
export function admitAIText(input: Scope & { idempotencyKey: string }, payload?: { prompt: string; system?: string }): Promise<AdmissionResult> {
  if (payload) boundedAIInput(payload.prompt, payload.system);
  return reserveAndClaim(input, input.idempotencyKey, "generate_text");
}

/** Separate server-owned mode. Unqualified quotes refuse before any hold; never
 * silently fall back to the default fixed-hold entry point. */
export async function admitQuotedAIText(input: Scope & { idempotencyKey: string }, payload: {prompt:string;system?:string}): Promise<AdmissionResult> {
  if(input.source !== "coding_proposal") deny();
  const binding = codingClaimBinding(input.codingRunClaim,input);
  const preparedPayload=boundedAIInput(payload.prompt,payload.system);
  const prepared=prepareCodingRequestEnvelope({organizationId:binding.organizationId,userId:binding.actorId,correlationId:binding.correlationId,runId:binding.runId,stageRunId:binding.stageRunId,claimGeneration:binding.generation,phase:input.codingPhase,idempotencyKey:input.idempotencyKey,task:"generate_text",model:input.codingModel,...preparedPayload,temperature:0.2,maxOutputTokens:4096,maxRetries:0,adapterContract:"coding_gateway_text_v1",routing:{only:["anthropic"],thinking:"disabled",region:"default",cache:"none"}});
  const quote=quoteCodingRequest(prepared);
  const scope=Object.freeze({organizationId:input.organizationId,userId:input.userId,correlationId:input.correlationId,source:"coding_proposal" as const});
  const reserved=await reserveQuotedCodingCall(prisma,input.codingRunClaim,scope,{idempotencyKey:input.idempotencyKey,phase:input.codingPhase!,prepared,quote});
  if(reserved.reused)deny();
  try { denyIsolatedExternalIO(); } catch(error) { await releaseCodingCall(prisma,input.codingRunClaim,scope,reserved.callId);throw error; }
  const {managerQuote}=await dispatchQuotedCodingCall(prisma,input.codingRunClaim,scope,reserved.callId,prepared,reserved.quoteReservation);
  const capability=Object.freeze({}) as GovernedAIAdmission;
  admissions.set(capability,Object.freeze({scope,reservationId:reserved.reservation.id,v2:reserved.allocationPolicy === "axiom_test_anniversary_v2",task:"generate_text",codingManager:managerQuote}));
  return {ok:true,admission:capability};
}

async function reserveAndClaim(input: Scope, idempotencyKey: string, task: Task, small?: SmallSonnetRequest, abortSignal?: AbortSignal, small55?: SmallSonnet55Request): Promise<AdmissionResult> {
  const scope = Object.freeze({ organizationId: input.organizationId, userId: input.userId, correlationId: input.correlationId, ...(input.source === "coding_proposal" ? { source: input.source } : {}) });
  if (![scope.organizationId, scope.userId, scope.correlationId].every(v => typeof v === "string" && v.length > 0 && v.length <= 1024)) deny();
  const reserved = input.source === "coding_proposal"
    ? await reserveCodingCall(prisma,input.codingRunClaim,scope,{idempotencyKey,phase:input.codingPhase!,model:input.codingModel!,estimatedCents:requestReservationCents()})
    : await reserveAICredits(prisma, { organizationId: scope.organizationId, idempotencyKey, reservedCents: small55 ? smallSonnet55Reservation(small55, scope) : small ? smallSonnetReservation(small, scope) : requestReservationCents(), correlationId: scope.correlationId, ...(small ? { smallAgentRequest: small } : {}), ...(small55 ? { smallAgent55Request: small55 } : {}) });
  if (!reserved.ok) return reserved;
  if (reserved.reused) return { ok: false, error: "request_already_reserved" };
  if (small55 && !reserved.small55RequestApplied) deny();
  try {
    // This denial is before any durable dispatch claim or possible SDK byte.
    // It is the sole safe release path, preserving the isolated app contract.
    abortSignal?.throwIfAborted();
    denyIsolatedExternalIO();
  } catch (error) {
    if ("callId" in reserved && typeof reserved.callId === "string") await releaseCodingCall(prisma,input.codingRunClaim,scope,reserved.callId);
    else await releaseAICreditReservation(prisma, scope.organizationId, reserved.reservation.id);
    throw error;
  }
  const v2 = reserved.allocationPolicy === "axiom_test_anniversary_v2";
  const claimed = "callId" in reserved && typeof reserved.callId === "string" ? await dispatchCodingCall(prisma,input.codingRunClaim,scope,reserved.callId,input.codingModel!) : await prisma.$transaction(tx => v2
    ? claimNewTestBillableDispatch(tx, scope, reserved.reservation.id)
    : claimLegacyAICreditDispatch(tx, scope, reserved.reservation.id), { isolationLevel: "Serializable" });
  if (!claimed) deny();
  const capability = Object.freeze({}) as GovernedExtractAdmission;
  admissions.set(capability, Object.freeze({ scope, reservationId: reserved.reservation.id, v2, task, ...(small && reserved.smallRequestApplied ? { small } : {}), ...(small55 ? { small55 } : {}) }));
  return { ok: true, admission: capability };
}

type ExtractUsage = Pick<AIStructuredResponse<unknown>, "provider" | "model" | "usage" | "gatewayGenerationId">;
/** Manager consumes before the first SDK call. Scope mismatch burns authority;
 * a copied/forged/reused handle can never disable its ordinary eager writer. */
export function consumeGovernedExtractAdmission(capability: GovernedExtractAdmission, binding: { organizationId?: string; correlationId?: string; model?: string; maxTokens?: number }, payload?: { text: string; schemaHint: string }) {
  return consumeAdmission(capability, binding, "extract_structured_data", payload);
}

export function consumeGovernedTextAdmission(capability: GovernedAIAdmission, binding: { organizationId?: string; correlationId?: string;model?:string;maxTokens?:number;temperature?:number }, payload?: {prompt:string;system?:string}) {
  return consumeAdmission(capability, binding, "generate_text", payload);
}

function consumeAdmission(capability: GovernedAIAdmission, binding: { organizationId?: string; correlationId?: string; model?: string; maxTokens?: number;temperature?:number }, task: Task, payload?: { text: string; schemaHint: string }|{prompt:string;system?:string}) {
  const admission = admissions.get(capability);
  admissions.delete(capability);
  if (!admission || admission.task !== task || binding.organizationId !== admission.scope.organizationId || binding.correlationId !== admission.scope.correlationId) deny();
  const { scope, reservationId, v2 } = admission;
  const codingDispatch=admission.codingManager
    ? consumeCodingManagerQuoteForRequest(admission.codingManager,{...binding,...(payload && "prompt" in payload ? payload : deny()),model:binding.model ?? deny()},Date.now())
    : undefined;
  const reservationEvidence = admission.small55 ? smallSonnet55ReservationEvidence(admission.small55, scope) : admission.small ? smallSonnetReservationEvidence(admission.small, scope) : undefined;
  const smallAgentDispatch = admission.small
    ? authorizeSmallSonnetDispatch(admission.small, { ...scope, model: binding.model, maxTokens: binding.maxTokens, ...((payload && "text" in payload ? payload : undefined) ?? deny()) })
    : undefined;
  const smallAgent55Dispatch = admission.small55
    ? authorizeSmallSonnet55Dispatch(admission.small55, { ...scope, model: binding.model, maxTokens: binding.maxTokens, ...((payload && "text" in payload ? payload : undefined) ?? deny()) })
    : undefined;
  let recorded = false;
  return Object.freeze({
    ...(codingDispatch ? {codingDispatch} : {}),
    ...(smallAgentDispatch ? { smallAgentDispatch } : {}),
    ...(smallAgent55Dispatch ? { smallAgent55Dispatch } : {}),
    async record(result: ExtractUsage): Promise<void> {
      if (recorded) deny();
      recorded = true;
      // Current production inference is Gateway-only. Missing/uncertain usage,
      // SDK/write errors and unsupported providers retain dispatch_unknown.
      if (admission.small55 && result.model !== SMALL_SONNET_55_MODEL) deny();
      const usage = result.usage;
      if (result.provider !== "vercel_gateway" || !result.model || !result.gatewayGenerationId || !usage || ![usage.promptTokens, usage.completionTokens].every(n => Number.isSafeInteger(n) && n! >= 0)) deny();
      const input: RecordAIUsageInput = {
        organizationId: scope.organizationId, triggeredBy: scope.userId, correlationId: scope.correlationId,
        provider: result.provider, model: result.model, externalUsageId: result.gatewayGenerationId,
        inputTokens: usage.promptTokens!, outputTokens: usage.completionTokens!, metadata: { ...(task === "generate_text" ? { route: scope.source === "coding_proposal" ? "pipeline/code_propose" : "api/ai/generate" } : { task: "extract_structured_data" }), ...(reservationEvidence ? { reservationPolicy: reservationEvidence } : {}) },
      };
      if (v2) {
        const saved = scope.source === "coding_proposal" ? await prisma.$transaction(async tx => {
          await lockCodingFinancial(tx,reservationId);
          const saved = await recordAttributedUsageV2(tx,reservationId,input,null);
          if(!saved.recorded || !saved.usageEventId)deny();
          await linkCodingUsage(tx,reservationId,saved.usageEventId,input.externalUsageId!);
          return saved;
        },{isolationLevel:"Serializable"}) : await recordReservedAIUsageEventV2(input, reservationId);
        if (!saved.recorded || !saved.usageEventId) deny();
      } else {
        await prisma.$transaction(async tx => {
          if(scope.source === "coding_proposal")await lockCodingFinancial(tx,reservationId);
          const holds = await tx.$queryRawUnsafe<Array<{ id: string; organizationId: string; status: string; usageEventId: string | null }>>('SELECT id,"organizationId",status,"usageEventId" FROM "AIUsageReservation" WHERE id=$1 AND "organizationId"=$2 FOR UPDATE', reservationId, scope.organizationId);
          const hold = holds[0];
          if (holds.length !== 1 || !hold || hold.id !== reservationId || hold.organizationId !== scope.organizationId || hold.status !== "dispatch_unknown" || hold.usageEventId !== null) deny();
          // Never claim an existing generation, including a same-tenant unbound
          // or previously billed event. Unique CREATE below also fences races.
          if (await tx.usageEvent.findUnique({ where: { externalUsageId: input.externalUsageId } })) deny();
          const writer = { usageEvent: {
            upsert: (args: Prisma.UsageEventUpsertArgs) => tx.usageEvent.create({ data: args.create }),
          } } as unknown as Pick<Prisma.TransactionClient, "usageEvent">;
          const saved = await recordAIUsageEvent(input, writer);
          if (!saved.recorded || !saved.usageEventId) deny();
          const linked = await tx.aIUsageReservation.updateMany({ where: { id: reservationId, organizationId: scope.organizationId, status: "dispatch_unknown", usageEventId: null }, data: { status: "pending_settlement", usageEventId: saved.usageEventId } });
          if (linked.count !== 1) deny();
          if(scope.source === "coding_proposal")await linkCodingUsage(tx,reservationId,saved.usageEventId,input.externalUsageId!);
        }, { isolationLevel: "Serializable" });
      }
    },
  });
}
