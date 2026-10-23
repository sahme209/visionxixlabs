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
import { requestReservationCents } from "./requestReservationCents";

type Scope = Readonly<{ organizationId: string; userId: string; correlationId: string }>;
declare const admissionBrand: unique symbol;
/** No serializable flag or constructor. Only a committed durable claim mints it. */
export type GovernedExtractAdmission = { readonly [admissionBrand]: true };
export type GovernedAIAdmission = GovernedExtractAdmission;
type Task = "generate_text" | "extract_structured_data";
type AdmissionResult = { ok: true; admission: GovernedAIAdmission } | { ok: false; error: Extract<AICreditReservationResult, { ok: false }>["error"] | "request_already_reserved" };
const admissions = new WeakMap<object, Readonly<{ scope: Scope; reservationId: string; v2: boolean; task: Task }>>();
function deny(): never { throw new Error("governed_extract_admission_unavailable"); }

export function governedExtractReservationKey(scope: Scope): string {
  return "agent_extract_" + createHash("sha256").update(JSON.stringify(["axiom-governed-extract-v1", scope.organizationId, scope.userId, scope.correlationId])).digest("hex");
}

export async function admitGovernedExtract(input: Scope): Promise<GovernedExtractAdmission> {
  const result = await reserveAndClaim(input, governedExtractReservationKey(input), "extract_structured_data");
  if (!result.ok) {
    if (result.error === "ai_credit_pool_exhausted") throw new AICreditAdmissionRefusal();
    deny();
  }
  return result.admission;
}

/** The generic route retains its validated public header key and error mapping.
 * Task selection and v2 classification are server-owned, never body flags. */
export function admitAIText(input: Scope & { idempotencyKey: string }): Promise<AdmissionResult> {
  return reserveAndClaim(input, input.idempotencyKey, "generate_text");
}

async function reserveAndClaim(input: Scope, idempotencyKey: string, task: Task): Promise<AdmissionResult> {
  const scope = Object.freeze({ organizationId: input.organizationId, userId: input.userId, correlationId: input.correlationId });
  if (![scope.organizationId, scope.userId, scope.correlationId].every(v => typeof v === "string" && v.length > 0 && v.length <= 1024)) deny();
  const reserved = await reserveAICredits(prisma, { organizationId: scope.organizationId, idempotencyKey, reservedCents: requestReservationCents(), correlationId: scope.correlationId });
  if (!reserved.ok) return reserved;
  if (reserved.reused) return { ok: false, error: "request_already_reserved" };
  try {
    // This denial is before any durable dispatch claim or possible SDK byte.
    // It is the sole safe release path, preserving the isolated app contract.
    denyIsolatedExternalIO();
  } catch (error) {
    await releaseAICreditReservation(prisma, scope.organizationId, reserved.reservation.id);
    throw error;
  }
  const v2 = reserved.allocationPolicy === "axiom_test_anniversary_v2";
  const claimed = await prisma.$transaction(tx => v2
    ? claimNewTestBillableDispatch(tx, scope, reserved.reservation.id)
    : claimLegacyAICreditDispatch(tx, scope, reserved.reservation.id), { isolationLevel: "Serializable" });
  if (!claimed) deny();
  const capability = Object.freeze({}) as GovernedExtractAdmission;
  admissions.set(capability, Object.freeze({ scope, reservationId: reserved.reservation.id, v2, task }));
  return { ok: true, admission: capability };
}

type ExtractUsage = Pick<AIStructuredResponse<unknown>, "provider" | "model" | "usage" | "gatewayGenerationId">;
/** Manager consumes before the first SDK call. Scope mismatch burns authority;
 * a copied/forged/reused handle can never disable its ordinary eager writer. */
export function consumeGovernedExtractAdmission(capability: GovernedExtractAdmission, binding: { organizationId?: string; correlationId?: string }) {
  return consumeAdmission(capability, binding, "extract_structured_data");
}

export function consumeGovernedTextAdmission(capability: GovernedAIAdmission, binding: { organizationId?: string; correlationId?: string }) {
  return consumeAdmission(capability, binding, "generate_text");
}

function consumeAdmission(capability: GovernedAIAdmission, binding: { organizationId?: string; correlationId?: string }, task: Task) {
  const admission = admissions.get(capability);
  admissions.delete(capability);
  if (!admission || admission.task !== task || binding.organizationId !== admission.scope.organizationId || binding.correlationId !== admission.scope.correlationId) deny();
  const { scope, reservationId, v2 } = admission;
  let recorded = false;
  return Object.freeze({
    async record(result: ExtractUsage): Promise<void> {
      if (recorded) deny();
      recorded = true;
      // Current production inference is Gateway-only. Missing/uncertain usage,
      // SDK/write errors and unsupported providers retain dispatch_unknown.
      const usage = result.usage;
      if (result.provider !== "vercel_gateway" || !result.model || !result.gatewayGenerationId || !usage || ![usage.promptTokens, usage.completionTokens].every(n => Number.isSafeInteger(n) && n! >= 0)) deny();
      const input: RecordAIUsageInput = {
        organizationId: scope.organizationId, triggeredBy: scope.userId, correlationId: scope.correlationId,
        provider: result.provider, model: result.model, externalUsageId: result.gatewayGenerationId,
        inputTokens: usage.promptTokens!, outputTokens: usage.completionTokens!, metadata: task === "generate_text" ? { route: "api/ai/generate" } : { task: "extract_structured_data" },
      };
      if (v2) {
        const saved = await recordReservedAIUsageEventV2(input, reservationId);
        if (!saved.recorded || !saved.usageEventId) deny();
      } else {
        await prisma.$transaction(async tx => {
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
        }, { isolationLevel: "Serializable" });
      }
    },
  });
}
