/** POST /api/workforce/on-prem-connectors/delete — Phase 641. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import { deleteOnPremConnector } from "@/lib/workforce/domains/onPremConnectors";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const slug = s(f.get("slug")).trim();
  const correlationId = `onprem_delete_${Date.now().toString(36)}` as CorrelationId;

  if (!slug) {
    return NextResponse.redirect(
      new URL("/dashboard/workforce/on-prem-connectors?error=missing_slug", req.url),
      303,
    );
  }

  await deleteOnPremConnector(org, slug);

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "connector.disconnect",
    outcome: "success",
    entityRef: `on-prem-connector:${slug}`,
    correlationId,
    detail: { action: "onprem_delete", slug },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/on-prem-connectors?notice=deleted", req.url), 303);
}
