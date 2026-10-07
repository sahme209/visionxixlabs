export interface ModelPolicy {
  enabled: boolean;
  allowedProviders: string[];
  modelSelections: Record<string, string>;
  fallbackOrder: string[];
}

export interface ProviderModel {
  id: string;
  label: string;
  tier: string;
}

export interface ProviderModels {
  provider: string;
  models: ProviderModel[];
}

export interface AiProviderStatus {
  providers: ProviderModels[];
  policy: ModelPolicy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) return null;
  return [...new Set(value)];
}

/**
 * Desktop releases can temporarily talk to a server running a newer schema.
 * Treat that boundary as untrusted: malformed provider data must show an error,
 * never throw during render and turn the entire Tauri webview blank.
 */
export function normalizeAiProviderStatus(value: unknown): AiProviderStatus | null {
  if (!isRecord(value) || !Array.isArray(value.providers) || !isRecord(value.policy)) return null;

  const providers: ProviderModels[] = [];
  for (const candidate of value.providers) {
    if (!isRecord(candidate) || typeof candidate.provider !== "string" || !Array.isArray(candidate.models)) return null;
    const models: ProviderModel[] = [];
    for (const model of candidate.models) {
      if (!isRecord(model) || typeof model.id !== "string" || typeof model.label !== "string" || typeof model.tier !== "string") return null;
      models.push({ id: model.id, label: model.label, tier: model.tier });
    }
    providers.push({ provider: candidate.provider, models });
  }

  const allowedProviders = stringArray(value.policy.allowedProviders);
  const fallbackOrder = stringArray(value.policy.fallbackOrder);
  if (typeof value.policy.enabled !== "boolean" || !allowedProviders || !fallbackOrder || !isRecord(value.policy.modelSelections)) return null;

  const modelSelections: Record<string, string> = {};
  for (const [provider, model] of Object.entries(value.policy.modelSelections)) {
    if (typeof model !== "string") return null;
    modelSelections[provider] = model;
  }

  return {
    providers,
    policy: {
      enabled: value.policy.enabled,
      allowedProviders,
      modelSelections,
      fallbackOrder,
    },
  };
}
