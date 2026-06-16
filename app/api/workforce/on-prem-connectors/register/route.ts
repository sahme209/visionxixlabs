/** POST /api/workforce/on-prem-connectors/register — Phase 641. */

import { NextResponse } from "next/server";
import { requireContext } from "@/lib/auth/currentContext";
import {
  registerOnPremConnector,
  type OnPremPlatform,
  type OnPremEnvironment,
} from "@/lib/workforce/domains/onPremConnectors";
import { record as auditRecord } from "@/lib/audit/secureAudit";
import { id as ids } from "@/lib/domain/ids";
import type { CorrelationId } from "@/lib/domain/ids";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function s(v: FormDataEntryValue | null): string { return typeof v === "string" ? v : ""; }

function parsePlatform(raw: string): OnPremPlatform {
  if (raw === "vmware_vcenter" || raw === "redhat_openshift" || raw === "microsoft_vmm") return raw;
  return "vmware_vcenter";
}

function parseEnvironment(raw: string): OnPremEnvironment {
  if (raw === "production" || raw === "staging" || raw === "development") return raw;
  return "production";
}

export async function POST(req: Request) {
  const ctx = await requireContext();
  const org = String(ctx.organizationId);
  const f = await req.formData();
  const correlationId = `onprem_register_${Date.now().toString(36)}` as CorrelationId;

  const result = await registerOnPremConnector(
    org,
    String(ctx.userId ?? "system"),
    {
      platform: parsePlatform(s(f.get("platform"))),
      displayName: s(f.get("displayName")).trim(),
      endpoint: s(f.get("endpoint")).trim(),
      environment: parseEnvironment(s(f.get("environment"))),
      secretReference: s(f.get("secretReference")).trim(),
    },
  );

  if (!result.ok) {
    void auditRecord({
      organizationId: ids.organization(org),
      actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
      action: "connector.connect",
      outcome: "failure",
      entityRef: "on-prem-connector",
      correlationId,
      detail: { action: "onprem_register", error: result.error },
    });
    return NextResponse.redirect(
      new URL(`/dashboard/workforce/on-prem-connectors?error=${encodeURIComponent(result.error ?? "register_failed")}`, req.url),
      303,
    );
  }

  void auditRecord({
    organizationId: ids.organization(org),
    actorUserId: ctx.userId ? ids.user(String(ctx.userId)) : undefined,
    action: "connector.connect",
    outcome: "success",
    entityRef: `on-prem-connector:${result.slug}`,
    correlationId,
    detail: { action: "onprem_register", slug: result.slug },
  });

  return NextResponse.redirect(new URL("/dashboard/workforce/on-prem-connectors?notice=registered", req.url), 303);
}
