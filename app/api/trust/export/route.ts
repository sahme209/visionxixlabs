/**
 * POST /api/trust/export
 *
 * Builds and returns an exportable compliance bundle for a given kind
 * (security_review / aws_connection / github_releaseops / desktop_security
 * / execution_approval / audit_trail / ai_safety / tenant_isolation /
 * release_distribution).
 *
 * Body: { kind: ComplianceBundleKind, format?: "json" | "ndjson" }
 *
 * The bundle includes:
 *   - Control statuses for the kind's category set
 *   - Evidence records collected for those controls
 *   - Summary counts
 *   - Limitations / data-handling notice
 *
 * Tenant-scoped. No secrets, no raw stack traces. Honest sourceMode.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { currentContext } from "@/lib/auth/currentContext";
import {
  buildComplianceBundle,
  SUPPORTED_COMPLIANCE_FORMATS,
  serializeComplianceBundle,
  type ComplianceBundleFormat,
  type ComplianceBundleKind,
} from "@/lib/compliance/evidenceBundle";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { apiFailure, apiSuccess } from "@/lib/api/dtoMappers";
import { AxiomErrors, httpStatusFor, toAxiomError } from "@/lib/errors/axiomErrors";
import { asRecord, requireEnum, optionalString } from "@/lib/security/validation";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

const ALLOWED_KINDS = [
  "security_review",
  "aws_connection",
  "github_releaseops",
  "desktop_security",
  "execution_approval",
  "audit_trail",
  "ai_safety",
  "tenant_isolation",
  "release_distribution",
] as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const correlationId = `trust_export_${Date.now().toString(36)}` as CorrelationId;
  try {
    const ctx = await currentContext();
    if (!ctx.isAuthenticated || !ctx.organizationId) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }
    const body = asRecord(await request.json().catch(() => ({})));
    const kind = requireEnum(body.kind, "kind", ALLOWED_KINDS) as ComplianceBundleKind;
    const formatStr = optionalString(body.format, "format", { max: 16 }) ?? "json";
    if (!SUPPORTED_COMPLIANCE_FORMATS.includes(formatStr as ComplianceBundleFormat)) {
      throw AxiomErrors.validation(
        "trust.bad_format",
        `format must be one of ${SUPPORTED_COMPLIANCE_FORMATS.join(", ")}.`,
      );
    }
    const format = formatStr as ComplianceBundleFormat;

    await auditRecord({
      organizationId: ctx.organizationId,
      actorUserId: ctx.userId,
      action: "audit.export",
      outcome: "success",
      entityRef: `trust:${kind}`,
      correlationId,
      detail: { kind, format },
    });

    const bundle = await buildComplianceBundle({
      kind,
      organizationId: ctx.organizationId,
      correlationId,
      source: "live",
    });
    const serialized = serializeComplianceBundle(bundle, format);

    return NextResponse.json(
      apiSuccess({
        kind,
        format,
        bundle,
        serialized,
        generatedAt: new Date().toISOString(),
      }),
      { status: 200 },
    );
  } catch (err) {
    const axiomErr = toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), { status: httpStatusFor(axiomErr.category) });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    apiFailure(AxiomErrors.validation("method.not_allowed", "Use POST with { kind, format } body.")),
    { status: 405 },
  );
}
