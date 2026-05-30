/**
 * GET /api/approvals/[id]/plan
 *
 * Streams a copy-paste-ready Terraform HCL plan for an approved
 * AxiomApprovalItem. Auth-gated and tenant-scoped. Returns
 * text/plain with Content-Disposition: attachment so browsers
 * download the .tf file rather than render it.
 *
 * The plan is generated on the fly from the approval row's
 * actionType + provider + region + resourceIds — no plan is stored
 * anywhere, so re-downloading after edits to the row always
 * reflects current state.
 */

import { type NextRequest } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import { renderTerraformPlan } from "@/lib/executor/terraformPlanRenderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireContext();
  const { id } = await params;

  const item = await prisma.axiomApprovalItem.findUnique({
    where: { id },
    select: {
      id: true,
      organizationId: true,
      title: true,
      actionType: true,
      provider: true,
      region: true,
      resourceIds: true,
      currentState: true,
      recommendedState: true,
      riskLevel: true,
      dispositionReason: true,
      status: true,
    },
  });

  if (!item || item.organizationId !== ctx.organizationId) {
    return new Response("Not found", { status: 404 });
  }

  // Only approved items get a plan — pending items haven't passed
  // human review yet, and rejected/expired items shouldn't be
  // executed at all.
  if (item.status !== "approved" && item.status !== "applied") {
    return new Response("Plan available only after approval.", { status: 409 });
  }

  const resourceIds = Array.isArray(item.resourceIds)
    ? (item.resourceIds as unknown[]).filter((r): r is string => typeof r === "string")
    : [];

  const hcl = renderTerraformPlan({
    id: item.id,
    title: item.title,
    actionType: item.actionType,
    provider: item.provider as "aws" | "azure" | "gcp",
    region: item.region,
    resourceIds,
    currentState: item.currentState,
    recommendedState: item.recommendedState,
    riskLevel: item.riskLevel,
    dispositionReason: item.dispositionReason,
  });

  const filename = `axiom-${item.id.slice(0, 10)}.tf`;
  return new Response(hcl, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
