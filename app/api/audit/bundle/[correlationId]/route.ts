/**
 * GET /api/audit/bundle/[correlationId]?format=json|csv|ndjson&kind=…
 *
 * Returns a compliance-ready audit bundle for one correlation id. The
 * bundle engine handles the heavy lifting — this route is the typed
 * boundary around it.
 *
 * Authentication / RBAC are enforced via the apiGuard pattern documented
 * in `lib/security/apiGuard.ts`. While the canonical NextAuth session
 * doesn't yet carry an organizationId in production, this route resolves
 * a tenant scope from the session and rejects anonymous requests outright.
 *
 * No real records are wired yet (the SecureAuditStore is in-memory until
 * Prisma is migrated). In that state we return an honest empty bundle
 * so the API contract is stable for downstream consumers to integrate.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { tenantScopeFromSession } from "@/lib/security/tenantScope";
import { AxiomErrors, httpStatusFor, isAxiomError, toAxiomError } from "@/lib/errors/axiomErrors";
import { apiFailure } from "@/lib/api/dtoMappers";
import { buildAuditStory } from "@/lib/audit/auditIntelligence";
import type { AuditRecord } from "@/lib/audit/secureAudit";
import {
  BUNDLE_KIND_LABEL,
  SUPPORTED_FORMATS,
  buildAuditBundle,
  serializeBundle,
} from "@/lib/audit/auditBundle";
import type { AuditBundleKind, AuditBundleFormat } from "@/lib/audit/auditBundle";
import { id } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ correlationId: string }> }
): Promise<NextResponse> {
  const correlationId = (await context.params).correlationId;
  try {
    // Auth
    const session = await getServerSession(authOptions);
    const scope = tenantScopeFromSession(session as never);
    if (!scope) {
      throw AxiomErrors.validation("auth.required", "Sign in required.");
    }

    // Inputs
    const url = new URL(request.url);
    const format = parseFormat(url.searchParams.get("format"));
    const kind = parseKind(url.searchParams.get("kind"));

    if (!correlationId || typeof correlationId !== "string") {
      throw AxiomErrors.validation("validation.correlation_id", "Correlation id required.");
    }

    // Load records — placeholder until SecureAuditStore is Prisma-backed.
    // We return an empty story rather than fabricate audit rows.
    const records: AuditRecord[] = [];
    const story = buildAuditStory(records);
    if (!story) {
      // Honest: no rows mean no bundle. Surface a 404 with a stable code.
      throw AxiomErrors.notFound("audit.bundle_empty", "No audit records found for this correlation id.", {
        correlationId,
      });
    }

    const bundle = buildAuditBundle({
      kind,
      story,
      artifacts: [],
      policies: [],
      approvals: [],
      resources: [],
      source: "preview",
    });
    const serialised = serializeBundle(bundle, format);

    return new NextResponse(serialised.body, {
      status: 200,
      headers: {
        "Content-Type": serialised.contentType,
        "Content-Disposition": `attachment; filename="${serialised.filename}"`,
        "X-Correlation-Id": correlationId,
        "X-Bundle-Kind": kind,
        "X-Bundle-Source": "preview",
      },
    });
  } catch (err) {
    const axiomErr = isAxiomError(err) ? err : toAxiomError(err);
    return NextResponse.json(apiFailure(axiomErr), {
      status: httpStatusFor(axiomErr.category),
      headers: { "X-Correlation-Id": correlationId },
    });
  }
}

function parseFormat(value: string | null): AuditBundleFormat {
  if (!value) return "json";
  const lc = value.toLowerCase();
  if ((SUPPORTED_FORMATS as string[]).includes(lc)) return lc as AuditBundleFormat;
  throw AxiomErrors.validation("validation.format", `Unsupported format. Use one of: ${SUPPORTED_FORMATS.join(", ")}.`);
}

function parseKind(value: string | null): AuditBundleKind {
  if (!value) return "policy_decision";
  if (value in BUNDLE_KIND_LABEL) return value as AuditBundleKind;
  throw AxiomErrors.validation("validation.bundle_kind", `Unknown bundle kind: ${value}.`);
}

// Silence unused-var TS complaints — id is reserved for future tenant scoping.
void id;
