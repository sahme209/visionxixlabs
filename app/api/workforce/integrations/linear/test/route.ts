/** POST /api/workforce/integrations/linear/test — Phase 648 — fire a test ticket. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { dispatchAction } from "@/lib/workforce/domains/actionExecutor";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const correlationId = `integration_linear_test_${Date.now().toString(36)}` as CorrelationId;
  const upstreamRef = `test_${Date.now().toString(36)}`;

  const { result, executionSlug } = await dispatchAction(org, "linear_ticket", {
    title: "visionxixlabs integration test — please close",
    body: [
      "This is a synthetic ticket fired from the visionxixlabs dashboard to verify",
      "that the Linear action executor can reach your team.",
      "",
      "If you see this ticket, the integration is working — feel free to close it.",
      "",
      `Correlation: \`${correlationId}\``,
    ].join("\n"),
    upstreamRef,
  });

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: result.status === "executed" ? "engineer.action_executed" : "engineer.action_execution_failed",
    outcome: result.status === "executed" ? "success" : "failure",
    entityRef: `integration:linear:test:${executionSlug}`,
    correlationId,
    detail: {
      integration: "linear",
      mode: "test",
      status: result.status,
      externalRef: result.externalRef,
      errorCode: result.errorCode,
    },
  });

  const params = new URLSearchParams();
  if (result.status === "executed") {
    params.set("notice", "test_fired");
  } else {
    params.set("error", `test_${result.errorCode ?? result.status}`);
  }
  return NextResponse.redirect(
    new URL(`/dashboard/workforce/integrations?${params.toString()}`, req.url),
    303,
  );
}
