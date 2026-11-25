import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveCorrelationId } from "@/lib/api";
import { currentContext } from "@/lib/auth/currentContext";
import { isSameOriginRequest } from "@/lib/auth/requestOrigin";
import { automaticTopUpSetupRuntime } from "@/lib/billing/automaticAICreditTopUpSetupRuntime";
import {
  disableAutomaticTopUpConsent, readAutomaticTopUpSetupStatus, registerAutomaticTopUpSetup,
} from "@/lib/billing/automaticAICreditTopUpConsentStore";
import { prisma } from "@/lib/db";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const workspace = { organizationId: z.string().min(1).max(256) };
const cents = z.number().int().min(0).max(2_147_483_647);
const expectedRevision = cents.min(1).nullable();
const commandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...workspace, action: z.literal("register"), accepted: z.literal(true), expectedRevision,
    thresholdCents: cents, sku: z.string().min(1).max(80), monthlyCeilingCents: cents.min(1),
  }),
  z.strictObject({ ...workspace, action: z.literal("create"), attemptId: z.uuid() }),
  z.strictObject({ ...workspace, action: z.literal("finish"), attemptId: z.uuid() }),
  z.strictObject({ ...workspace, action: z.literal("disable"), expectedRevision }),
  z.strictObject({ ...workspace, action: z.literal("authenticate_payment"), intentId: z.uuid() }),
  z.strictObject({ ...workspace, action: z.literal("verify_payment"), intentId: z.uuid() }),
  z.strictObject({ ...workspace, action: z.literal("cancel_payment"), intentId: z.uuid() }),
]);

const serializable = { isolationLevel: "Serializable" } as const;
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function ok(data: object) {
  return NextResponse.json({ ok: true, data }, { headers });
}

function failure(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status, headers });
}

export function GET(request: NextRequest) {
  return handle(request, false);
}

export function POST(request: NextRequest) {
  return handle(request, true);
}

async function handle(request: NextRequest, write: boolean) {
  if (write && !isSameOriginRequest(request)) return failure("invalid_request_origin", 403);
  try {
    const context = await currentContext();
    if (!context.isAuthenticated || !context.organizationId || !context.userId) return failure("auth_required", 401);
    const actor = { organizationId: String(context.organizationId), userId: String(context.userId) };
    const setup = automaticTopUpSetupRuntime();
    if (!setup) return failure("automatic_top_up_unavailable", 503);
    if (!write) {
      const view = await prisma.$transaction(tx => readAutomaticTopUpSetupStatus(tx, actor, setup.identity), serializable);
      return view.kind === "ok" ? ok(view.data) : failure("workspace_billing_manager_required", 403);
    }

    const parsed = commandSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return failure("automatic_top_up_invalid", 400);
    const command = parsed.data;
    if (command.organizationId !== actor.organizationId) return failure("automatic_top_up_workspace_changed", 409);
    const correlationId = resolveCorrelationId(request.headers) as CorrelationId;

    if (command.action === "register") {
      if (!setup.providerConfigured) return failure("automatic_top_up_unavailable", 503);
      const result = await prisma.$transaction(tx => registerAutomaticTopUpSetup(tx, actor, setup.identity, command), serializable);
      if (result.kind === "registered") return ok({ organizationId: actor.organizationId, state: "registered", attemptId: result.terms.attemptId });
      if (result.kind === "setup_pending") return ok({ organizationId: actor.organizationId, state: "setup_pending", attemptId: result.attemptId });
      return setupFailure(result.kind);
    }
    if (command.action === "disable") {
      const result = await prisma.$transaction(tx => disableAutomaticTopUpConsent(tx, {
        ...actor, expectedRevision: command.expectedRevision, correlationId,
      }), serializable);
      return result.kind === "off" ? ok({ organizationId: actor.organizationId, state: "off", revision: result.revision }) : setupFailure(result.kind);
    }
    if (command.action === "authenticate_payment" || command.action === "verify_payment" || command.action === "cancel_payment") {
      if (!setup.providerConfigured) return failure("automatic_top_up_unavailable", 503);
      const recovery = setup.recovery();
      const scope = { ...actor, intentId: command.intentId };
      if (command.action === "authenticate_payment") {
        const result = await recovery.authenticate(scope);
        if (result.kind === "authentication_ready") {
          return ok({ organizationId: actor.organizationId, state: result.kind, clientSecret: result.clientSecret });
        }
        return result.kind === "unavailable" ? failure("automatic_top_up_authentication_unavailable", 409)
          : ok({ organizationId: actor.organizationId, state: result.kind });
      }
      const result = command.action === "cancel_payment" ? await recovery.cancel(scope) : await recovery.verify(scope);
      return result.kind === "unavailable" ? failure("automatic_top_up_payment_unavailable", 409)
        : ok({ organizationId: actor.organizationId, state: result.kind });
    }

    const service = setup.service();
    if (command.action === "create") {
      const result = await service.create(actor, command.attemptId);
      return result.kind === "ready"
        ? ok({ organizationId: actor.organizationId, state: "ready", clientSecret: result.clientSecret })
        : setupFailure(result.kind);
    }
    const result = await service.finish(actor, command.attemptId, correlationId);
    return result.kind === "saved"
      ? ok({ organizationId: actor.organizationId, state: "saved", revision: result.revision })
      : setupFailure(result.kind);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return failure("automatic_top_up_changed", 409);
    }
    return failure("automatic_top_up_unavailable", 503);
  }
}

function setupFailure(kind: string) {
  if (kind === "forbidden") return failure("workspace_billing_manager_required", 403);
  if (kind === "invalid_terms") return failure("automatic_top_up_invalid", 400);
  if (kind === "setup_unavailable" || kind === "invalid_customer") return failure("automatic_top_up_unavailable", 503);
  if (kind === "invalid_setup") return failure("automatic_top_up_payment_setup_unverified", 409);
  return failure("automatic_top_up_changed", 409);
}
