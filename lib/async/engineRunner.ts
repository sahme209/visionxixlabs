import { prisma } from "@/lib/db";
import type { Lead } from "@prisma/client";

type RunAsyncLeadEngineParams<TGenerated> = {
  leadId: string;
  engineName: string;
  expectedSource?: string;
  generateFunction: (args: { lead: Lead; payload: Record<string, unknown> }) => Promise<TGenerated>;
  updatePayloadFunction: (args: {
    lead: Lead;
    payload: Record<string, unknown>;
    generated: TGenerated;
  }) => Record<string, unknown>;
  initialStatus?: string;
  readyStatus?: string;
  failureStatus?: string;
};

/**
 * Shared helper to run an async engine against a lead.
 * - Validates the lead exists (and, optionally, its source).
 * - Sets an interim status (default: "package_generating").
 * - Invokes a caller-provided generateFunction.
 * - Invokes a caller-provided updatePayloadFunction to merge results into fullPayload.
 * - Marks fullPayload.outputStatus as "ready" and status as readyStatus (default: "package_ready").
 * - On error, marks fullPayload.outputStatus as "failed" and status as failureStatus (default: "created").
 */
export async function runAsyncLeadEngine<TGenerated>({
  leadId,
  engineName,
  expectedSource,
  generateFunction,
  updatePayloadFunction,
  initialStatus = "package_generating",
  readyStatus = "package_ready",
  failureStatus = "created",
}: RunAsyncLeadEngineParams<TGenerated>): Promise<{
  lead: Lead;
  generated: TGenerated;
  payload: Record<string, unknown>;
}> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) {
    throw new Error(`[${engineName}] lead not found`);
  }

  if (expectedSource && lead.source !== expectedSource) {
    throw new Error(
      `[${engineName}] invalid lead source: expected "${expectedSource}", got "${lead.source}"`
    );
  }

  const payload = (lead.fullPayload as Record<string, unknown>) || {};

  if (initialStatus) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { status: initialStatus },
    });
  }

  try {
    const generated = await generateFunction({ lead, payload });
    const nextPayload = updatePayloadFunction({ lead, payload, generated });
    const finalPayload: Record<string, unknown> = {
      ...nextPayload,
      outputStatus: "ready",
    };

    const updatedLead = await prisma.lead.update({
      where: { id: leadId },
      data: {
        status: readyStatus,
        fullPayload: finalPayload as object,
      },
    });

    return { lead: updatedLead, generated, payload: finalPayload };
  } catch (error) {
    // Best-effort failure marker, then rethrow for the caller to handle response shape.
    try {
      const latest = await prisma.lead.findUnique({ where: { id: leadId } });
      if (latest) {
        const currentPayload = (latest.fullPayload as Record<string, unknown>) || {};
        const failedPayload: Record<string, unknown> = {
          ...currentPayload,
          outputStatus: "failed",
        };

        await prisma.lead.update({
          where: { id: leadId },
          data: {
            status: failureStatus,
            fullPayload: failedPayload as object,
          },
        });
      }
    } catch {
      // ignore secondary failures
    }

    throw error;
  }
}

