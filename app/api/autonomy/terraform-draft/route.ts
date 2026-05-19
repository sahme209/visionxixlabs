/**
 * POST /api/autonomy/terraform-draft
 *
 * Converts a policy preview JSON to Terraform HCL. Body shape:
 *   {
 *     cloud: "aws" | "azure" | "gcp",
 *     label: string,
 *     policyJson: string
 *   }
 *
 * Pure string templating. No tf init / plan / apply ever.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { draftTerraform, type TerraformCloud } from "@/lib/autonomy/terraformDrafter";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";

const ALLOWED: TerraformCloud[] = ["aws", "azure", "gcp"];

export async function POST(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated) throw AxiomErrors.validation("auth.required", "Sign in required.");
    const body = (await req.json()) as { cloud?: string; label?: string; policyJson?: string } | null;
    if (!body?.cloud || !(ALLOWED as string[]).includes(body.cloud) || !body.label || !body.policyJson) {
      throw AxiomErrors.validation(
        "terraform.required",
        "Body must include cloud (aws|azure|gcp) + label + policyJson.",
      );
    }
    const draft = draftTerraform({
      cloud: body.cloud as TerraformCloud,
      label: body.label,
      policyJson: body.policyJson,
    });
    return apiOk(draft, {
      correlationId,
      safetyContract: "approval_only_no_execution",
      sourceMode: asApiSourceMode("preview"),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "approval_only_no_execution" });
  }
}

export async function GET(req: NextRequest) { return POST(req); }
