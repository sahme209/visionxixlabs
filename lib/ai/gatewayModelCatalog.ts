import { denyIsolatedExternalIO } from "@/lib/billing/isolatedApplication/runtime";
import "server-only";

export interface GatewayModelOption {
  id: string;
  label: string;
  tier: "preferred" | "balanced" | "fast";
}

export function isGatewayModelId(value: string): boolean {
  return value === "service-default" || /^([a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*|vmc\/[A-Za-z0-9][A-Za-z0-9._-]*)$/.test(value);
}

/** Live, server-side catalog. Failure returns no choices instead of stale fabricated models. */
export async function loadGatewayModelCatalog(): Promise<GatewayModelOption[]> {
  denyIsolatedExternalIO();
  const response = await fetch("https://ai-gateway.vercel.sh/v1/models", { next: { revalidate: 900 } });
  if (!response.ok) throw new Error("gateway_model_catalog_unavailable");
  const body = await response.json() as { data?: Array<{ id?: unknown; name?: unknown; type?: unknown; tags?: unknown }> };
  const configuredAllowlist = new Set((process.env.AI_GATEWAY_MODEL_ALLOWLIST ?? "").split(",").map((item) => item.trim()).filter(Boolean));
  return (body.data ?? [])
    .filter((model) => typeof model.id === "string" && isGatewayModelId(model.id) && (!model.type || model.type === "language"))
    .filter((model) => configuredAllowlist.size === 0 || configuredAllowlist.has(model.id as string))
    .map((model) => {
      const tags = Array.isArray(model.tags) ? model.tags : [];
      return {
        id: model.id as string,
        label: typeof model.name === "string" ? model.name : model.id as string,
        tier: tags.includes("fast") ? "fast" as const : tags.includes("reasoning") || tags.includes("tool-use") ? "preferred" as const : "balanced" as const,
      };
    });
}
