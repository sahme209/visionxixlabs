/**
 * On-prem connector registry — Phase 641.
 *
 * Lets operators register their on-prem virtualization platforms
 * (VMware vCenter, Red Hat OpenShift, Microsoft System Center VMM)
 * so the workforce can target them once the read-only scanner ships
 * for each platform.
 *
 * HONEST SCOPE: this phase captures the registration intent and
 * surfaces the connector list to the operator. The actual
 * platform-specific scanner integration ships in follow-up phases:
 *   · Phase 642 — VMware vSphere read-only scanner
 *   · Phase 643 — OpenShift read-only scanner
 *   · Phase 644 — Microsoft VMM read-only scanner
 *
 * Each registered connector lives in the synthetic
 * AiRationaleEnrichment row pattern at
 * targetKind=workforce_onprem_connector, targetId=<connectorSlug>.
 * No Prisma migration required; if a real ConnectorRegistry model
 * later lands, this synthetic source can be backfilled into it.
 *
 * Credentials are NOT stored here. Each connector references a
 * placeholder secretReference (e.g. "vault://onprem/vcenter-prod")
 * the customer's secrets-management integration resolves at scan
 * time. Phase 642+ wire the actual secret retrieval.
 *
 * Server-only.
 */

import "server-only";

import { prisma } from "@/lib/db";

export const ONPREM_CONNECTOR_TARGET_KIND = "workforce_onprem_connector";

export type OnPremPlatform =
  | "vmware_vcenter"
  | "redhat_openshift"
  | "microsoft_vmm";

export type OnPremEnvironment = "production" | "staging" | "development";

export type ScannerStatus =
  | "registered_pending_scanner" // platform-specific scanner not yet shipped
  | "registered_ready"            // scanner shipped; awaiting first scan
  | "scanning_active"             // last scan within SLA
  | "scanning_stale";             // last scan past SLA

export interface OnPremConnector {
  slug: string;
  platform: OnPremPlatform;
  displayName: string;
  endpoint: string;
  environment: OnPremEnvironment;
  /** Operator-supplied reference to the credential — actual secret
   *  retrieval happens at scan time via the customer's secrets
   *  store. We never store the credential itself. */
  secretReference: string;
  scannerStatus: ScannerStatus;
  registeredAt: Date;
  registeredBy: string;
}

export interface ConnectorInput {
  platform: OnPremPlatform;
  displayName: string;
  endpoint: string;
  environment: OnPremEnvironment;
  secretReference: string;
}

export const PLATFORM_LABEL: Record<OnPremPlatform, { label: string; tagline: string; scannerPhase: string }> = {
  vmware_vcenter: {
    label: "VMware vCenter",
    tagline: "vSphere API · read-only · VMs / datastores / clusters",
    scannerPhase: "Phase 642",
  },
  redhat_openshift: {
    label: "Red Hat OpenShift",
    tagline: "Kubernetes API + OpenShift CRDs · read-only · pods / projects / routes",
    scannerPhase: "Phase 643",
  },
  microsoft_vmm: {
    label: "Microsoft System Center VMM",
    tagline: "PowerShell + VMM SDK · read-only · VMs / hosts / clouds",
    scannerPhase: "Phase 644",
  },
};

function slugify(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function isValidPlatform(p: string): p is OnPremPlatform {
  return p === "vmware_vcenter" || p === "redhat_openshift" || p === "microsoft_vmm";
}

function isValidEnvironment(e: string): e is OnPremEnvironment {
  return e === "production" || e === "staging" || e === "development";
}

/**
 * Validate that the endpoint is shaped like a host or URL the
 * scanner will be able to reach. Rejects obviously malformed strings
 * but accepts both URL (https://vcenter.corp/) and host:port
 * (vmm.corp:8100) styles.
 */
export function isValidEndpoint(endpoint: string): boolean {
  if (typeof endpoint !== "string" || endpoint.length === 0 || endpoint.length > 400) return false;
  // Accept full URL.
  if (endpoint.startsWith("https://") || endpoint.startsWith("http://")) {
    try {
      const u = new URL(endpoint);
      return Boolean(u.hostname);
    } catch {
      return false;
    }
  }
  // Accept host or host:port.
  return /^[a-zA-Z0-9][\w.-]*(:[0-9]{1,5})?$/.test(endpoint);
}

/**
 * Validate that the secret reference uses a recognized prefix.
 * Operators integrate with their own secrets manager — we just
 * verify the shape.
 */
export function isValidSecretReference(ref: string): boolean {
  if (typeof ref !== "string" || ref.length === 0 || ref.length > 400) return false;
  return /^(vault|secretsmanager|azurekeyvault|gcpsecretmanager|env):\/?\/?[\w\-/.]+$/i.test(ref);
}

/** Validate every field on a ConnectorInput. Returns the first
 *  problem found, or null when OK. */
export function validateConnectorInput(input: ConnectorInput): string | null {
  if (!isValidPlatform(input.platform)) return "invalid_platform";
  if (!input.displayName || input.displayName.length > 80) return "invalid_display_name";
  if (!isValidEndpoint(input.endpoint)) return "invalid_endpoint";
  if (!isValidEnvironment(input.environment)) return "invalid_environment";
  if (!isValidSecretReference(input.secretReference)) return "invalid_secret_reference";
  return null;
}

function buildSlug(platform: OnPremPlatform, displayName: string): string {
  const platformShort =
    platform === "vmware_vcenter" ? "vmware" :
    platform === "redhat_openshift" ? "openshift" : "vmm";
  return `${platformShort}_${slugify(displayName) || Date.now().toString(36)}`;
}

export async function registerOnPremConnector(
  organizationId: string,
  registeredBy: string,
  input: ConnectorInput,
): Promise<{ ok: boolean; slug: string | null; error: string | null }> {
  const err = validateConnectorInput(input);
  if (err) return { ok: false, slug: null, error: err };

  const slug = buildSlug(input.platform, input.displayName);
  // Scanner-status defaults to registered_pending_scanner until the
  // platform-specific scanner ships. Phase 642+ flips to
  // registered_ready when each scanner lands.
  const payload: string[] = [
    `platform|${input.platform}`,
    `display_name|${input.displayName}`,
    `endpoint|${input.endpoint}`,
    `environment|${input.environment}`,
    `secret_reference|${input.secretReference}`,
    `scanner_status|registered_pending_scanner`,
    `registered_at|${new Date().toISOString()}`,
    `registered_by|${registeredBy}`,
  ];

  const narrative = `On-prem connector registered: ${PLATFORM_LABEL[input.platform].label} (${input.environment}) at ${input.endpoint}. Scanner integration pending per ${PLATFORM_LABEL[input.platform].scannerPhase}.`;

  try {
    await prisma.aiRationaleEnrichment.upsert({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: ONPREM_CONNECTOR_TARGET_KIND,
          targetId: slug,
        },
      },
      create: {
        organizationId,
        targetKind: ONPREM_CONNECTOR_TARGET_KIND,
        targetId: slug,
        narrative,
        riskFactorsJson: [] as unknown as string[],
        nextActionsJson: payload as unknown as string[],
        outcome: "ai_generated",
        errorMessage: null,
        modelHint: null,
        engineVersion: "onprem-connector-registry-v1",
      },
      update: {
        narrative,
        nextActionsJson: payload as unknown as string[],
      },
    });
    return { ok: true, slug, error: null };
  } catch (e) {
    return {
      ok: false,
      slug: null,
      error: e instanceof Error ? e.message : "persist_failed",
    };
  }
}

export async function listOnPremConnectors(
  organizationId: string,
): Promise<OnPremConnector[]> {
  try {
    const rows = await prisma.aiRationaleEnrichment.findMany({
      where: { organizationId, targetKind: ONPREM_CONNECTOR_TARGET_KIND },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: { targetId: true, nextActionsJson: true, updatedAt: true },
    });
    return rows.map((r) => {
      const tags = new Map<string, string>();
      if (Array.isArray(r.nextActionsJson)) {
        for (const e of r.nextActionsJson as unknown[]) {
          if (typeof e !== "string") continue;
          const idx = e.indexOf("|");
          if (idx === -1) continue;
          tags.set(e.slice(0, idx), e.slice(idx + 1));
        }
      }
      const platformRaw = tags.get("platform") ?? "";
      const platform: OnPremPlatform = isValidPlatform(platformRaw) ? platformRaw : "vmware_vcenter";
      const envRaw = tags.get("environment") ?? "production";
      const environment: OnPremEnvironment = isValidEnvironment(envRaw) ? envRaw : "production";
      const statusRaw = tags.get("scanner_status") ?? "registered_pending_scanner";
      const scannerStatus: ScannerStatus =
        statusRaw === "registered_pending_scanner" ||
        statusRaw === "registered_ready" ||
        statusRaw === "scanning_active" ||
        statusRaw === "scanning_stale"
          ? statusRaw
          : "registered_pending_scanner";
      const registeredAtRaw = tags.get("registered_at");
      const registeredAt = registeredAtRaw ? new Date(registeredAtRaw) : r.updatedAt;
      return {
        slug: r.targetId,
        platform,
        displayName: tags.get("display_name") ?? r.targetId,
        endpoint: tags.get("endpoint") ?? "",
        environment,
        secretReference: tags.get("secret_reference") ?? "",
        scannerStatus,
        registeredAt,
        registeredBy: tags.get("registered_by") ?? "",
      };
    });
  } catch {
    return [];
  }
}

export async function deleteOnPremConnector(
  organizationId: string,
  slug: string,
): Promise<void> {
  try {
    await prisma.aiRationaleEnrichment.delete({
      where: {
        organizationId_targetKind_targetId: {
          organizationId,
          targetKind: ONPREM_CONNECTOR_TARGET_KIND,
          targetId: slug,
        },
      },
    });
  } catch {
    // Row doesn't exist — that's the desired state.
  }
}
