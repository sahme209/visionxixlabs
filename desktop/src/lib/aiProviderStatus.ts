export interface GatewayModelSelectionV1 {
  readonly version: 1;
  readonly defaultModelId: string;
  readonly approvedModelIds: readonly string[];
}
export interface ModelPolicy {
  enabled: boolean;
  allowedProviders: string[];
  modelSelections: Record<string, string>;
  fallbackOrder: string[];
  gatewaySelection?: GatewayModelSelectionV1;
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

/** Matches the server's concrete Gateway syntax; no catalog or availability claim. */
export function isConcreteGatewayModelId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200 && !value.startsWith("vmc/") && /^[a-z0-9][a-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}
function gatewaySelection(value: unknown): GatewayModelSelectionV1 | null {
  if (!isRecord(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== 3 || keys.some(key => typeof key !== "string" || !["version", "defaultModelId", "approvedModelIds"].includes(key))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.values(descriptors).some(item => !item.enumerable || !Object.prototype.hasOwnProperty.call(item, "value"))) return null;
  const version = descriptors.version.value, defaultModelId = descriptors.defaultModelId.value, approved = descriptors.approvedModelIds.value;
  if (version !== 1 || !isConcreteGatewayModelId(defaultModelId) || !Array.isArray(approved) || Object.getPrototypeOf(approved) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(approved, "length");
  if (!length || !Object.prototype.hasOwnProperty.call(length, "value") || length.value < 1 || length.value > 32 || Reflect.ownKeys(approved).length !== length.value + 1) return null;
  const ids: string[] = [];
  for (let i = 0; i < length.value; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(approved, String(i));
    if (!descriptor?.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, "value") || !isConcreteGatewayModelId(descriptor.value) || ids.includes(descriptor.value)) return null;
    ids.push(descriptor.value);
  }
  if (!ids.includes(defaultModelId)) return null;
  return Object.freeze({ version: 1, defaultModelId, approvedModelIds: Object.freeze(ids) });
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

  const descriptor = Object.getOwnPropertyDescriptor(value.policy, "gatewaySelection");
  let metadata: GatewayModelSelectionV1 | undefined;
  if (descriptor || "gatewaySelection" in value.policy) {
    if (!descriptor?.enumerable || !Object.prototype.hasOwnProperty.call(descriptor, "value")) return null;
    metadata = gatewaySelection(descriptor.value) ?? undefined;
    if (!metadata || !value.policy.enabled || !allowedProviders.includes("vercel_gateway") || modelSelections.vercel_gateway !== metadata.defaultModelId) return null;
  }

  return {
    providers,
    policy: {
      enabled: value.policy.enabled,
      allowedProviders,
      modelSelections,
      fallbackOrder,
      ...(metadata ? { gatewaySelection: metadata } : {}),
    },
  };
}

/** Approval membership is separate from the default used by current Agent chat. */
export function isModelApproved(policy: ModelPolicy, provider: string, modelId: string): boolean {
  return policy.enabled && policy.allowedProviders.includes(provider) && (provider === "vercel_gateway" && policy.gatewaySelection
    ? policy.gatewaySelection.approvedModelIds.includes(modelId) : policy.modelSelections[provider] === modelId);
}
/** Pure Settings transition; server still verifies admin authority + live catalog. */
export function toggleApprovedModel(input: ModelPolicy, provider: string, modelId: string): ModelPolicy | null {
  const policy = normalizeAiProviderStatus({ providers: [], policy: input })?.policy;
  if (!policy) return null;
  let allowed = [...policy.allowedProviders]; const selections = { ...policy.modelSelections }; let metadata = policy.gatewaySelection;
  const removeProvider = () => { allowed = allowed.filter(item => item !== provider); delete selections[provider]; };
  if (provider === "vercel_gateway" && isConcreteGatewayModelId(modelId)) {
    let approved = metadata ? [...metadata.approvedModelIds] : policy.enabled && allowed.includes(provider) && isConcreteGatewayModelId(selections[provider]) ? [selections[provider]] : [];
    if (approved.includes(modelId)) approved = approved.filter(id => id !== modelId);
    else { if (approved.length >= 32) return null; approved.push(modelId); }
    if (!approved.length) { removeProvider(); metadata = undefined; }
    else {
      const defaultModelId = metadata && approved.includes(metadata.defaultModelId) ? metadata.defaultModelId : approved[0];
      metadata = Object.freeze({ version: 1, defaultModelId, approvedModelIds: Object.freeze(approved) });
      selections[provider] = defaultModelId; if (!allowed.includes(provider)) allowed.push(provider);
    }
  } else {
    if (provider === "vercel_gateway" && (metadata || !isModelApproved(policy, provider, modelId))) return null;
    if (isModelApproved(policy, provider, modelId)) removeProvider();
    else { allowed = [...allowed.filter(item => item !== provider), provider]; selections[provider] = modelId; }
    if (provider === "vercel_gateway") metadata = undefined;
  }
  if (!allowed.length) return { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] };
  return { enabled: true, allowedProviders: allowed, modelSelections: selections,
    fallbackOrder: [...policy.fallbackOrder.filter(item => allowed.includes(item)), ...allowed.filter(item => !policy.fallbackOrder.includes(item))],
    ...(metadata && allowed.includes("vercel_gateway") ? { gatewaySelection: metadata } : {}),
  };
}

/** Changes only the current default within the already approved Gateway set. */
export function setApprovedGatewayDefault(input: ModelPolicy, modelId: string): ModelPolicy | null {
  const policy = normalizeAiProviderStatus({ providers: [], policy: input })?.policy;
  if (!policy?.gatewaySelection || !policy.gatewaySelection.approvedModelIds.includes(modelId)) return null;
  return { ...policy, modelSelections: { ...policy.modelSelections, vercel_gateway: modelId },
    gatewaySelection: Object.freeze({ ...policy.gatewaySelection, defaultModelId: modelId }),
  };
}

/** Explicit admin cleanup only, using a successfully fetched current catalog.
 * Nothing is pruned during decode, load or an unrelated provider toggle. */
export function removeUnavailableGatewayApprovals(input: ModelPolicy, availableModelIds: readonly string[]): ModelPolicy | null {
  let policy = normalizeAiProviderStatus({ providers: [], policy: input })?.policy;
  if (!policy) return null;
  const approved = policy.gatewaySelection?.approvedModelIds ?? (policy.enabled && policy.allowedProviders.includes("vercel_gateway") && policy.modelSelections.vercel_gateway ? [policy.modelSelections.vercel_gateway] : []);
  const available = new Set(availableModelIds);
  for (const id of approved) {
    if (isConcreteGatewayModelId(id) && !available.has(id)) {
      const next = toggleApprovedModel(policy, "vercel_gateway", id);
      if (!next) return null;
      policy = next;
    }
  }
  return policy;
}
