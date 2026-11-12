import { isConcreteGatewayModelId, type AiProviderStatus } from "./aiProviderStatus";

export interface AgentModelChoice {
  key: string;
  provider: string;
  modelId: string;
  label: string;
  vendor: string;
  preferredModel?: string;
  unavailableReason?: string;
}

const vendorNames: Record<string, string> = {
  customer_hosted: "Customer-hosted",
  xai: "xAI",
  spacexai: "xAI",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  meta: "Meta",
  mistral: "Mistral",
};

export function agentModelChoices(status: AiProviderStatus): AgentModelChoice[] {
  if (!status.policy.enabled) return [];

  return status.policy.allowedProviders.flatMap(provider => {
    const catalog = status.providers.find(item => item.provider === provider);
    if (!catalog) return [];

    const ids = provider === "vercel_gateway" && status.policy.gatewaySelection
      ? status.policy.gatewaySelection.approvedModelIds
      : [status.policy.modelSelections[provider]];

    return ids.flatMap(modelId => {
      if (!modelId) return [];
      const model = catalog.models.find(item => item.id === modelId);
      const managed = provider === "vercel_gateway"
        && (modelId === "service-default" || modelId.startsWith("vmc/"));
      if (!model && !managed) return [];

      const vendor = provider === "vercel_gateway" && !managed
        ? modelId.split("/")[0]
        : provider;

      return [{
        key: JSON.stringify([provider, modelId]),
        provider,
        modelId,
        label: model?.label ?? "Service-managed default",
        vendor: managed ? "Managed Gateway" : vendorNames[vendor] ?? vendor,
        // Local readiness hint only; the service independently enforces admission.
        ...(provider === "vercel_gateway" && /(?:^|\/)grok-4\.20-multi-agent(?:$|[-:])/.test(modelId)
          ? { unavailableReason: "This model is unavailable because its output budget cannot be enforced. Choose another approved model; your draft is kept." }
          : {}),
        ...((provider === "vercel_gateway" && isConcreteGatewayModelId(modelId) || provider === "customer_hosted")
          ? { preferredModel: modelId }
          : {}),
      }];
    });
  });
}

/** Only verified workspace identity scopes this non-authoritative local choice. */
export function modelPreferenceKey(apiBase: string, organizationId: string): string | null {
  try {
    const url = new URL(apiBase);
    if (!organizationId || organizationId.length > 200 || url.username || url.password
      || url.search || url.hash || !["https:", "http:"].includes(url.protocol)) return null;

    return `axiom.workspace.model.v1:${encodeURIComponent(url.origin + url.pathname)}:${encodeURIComponent(organizationId)}`;
  } catch {
    return null;
  }
}
