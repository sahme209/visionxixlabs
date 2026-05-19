/**
 * GET /api/cloud/aws-services
 *
 * Returns the canonical AwsServiceInventoryReport — Lambda + RDS +
 * IAM + S3 in one consolidated typed envelope. Pure read-only.
 */

import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import { buildAwsServiceInventory } from "@/lib/cloud/aws/awsServiceInventoryExtractor";
import { apiOk, apiErr, asApiSourceMode, resolveCorrelationId } from "@/lib/api";
import { AxiomErrors } from "@/lib/errors/axiomErrors";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const correlationId = resolveCorrelationId(req.headers);
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const report = await buildAwsServiceInventory({
      tenantId: ctx.organizationId,
      actorUserId: ctx.userId,
    });
    return apiOk(report, {
      correlationId,
      safetyContract: "aws_service_inventory_read_only",
      sourceMode: asApiSourceMode(report.overallSourceMode),
    });
  } catch (err) {
    return apiErr(err, { correlationId, safetyContract: "aws_service_inventory_read_only" });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
