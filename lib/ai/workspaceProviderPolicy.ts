import "server-only";

import { prisma } from "@/lib/db";
import { isAIProviderName, type AIProviderName } from "./AIProvider";
import { defaultModelFor, isKnownModel } from "./AIModelRegistry";
import { isCustomerHostedModelId } from "./customerHostedConfig";
import { isGatewayModelId } from "./gatewayModelCatalog";

export interface GatewayModelSelectionV1 {
  readonly version: 1;
  readonly defaultModelId: string;
  readonly approvedModelIds: readonly string[];
}

export interface WorkspaceAIProviderPolicy {
  /** False is an explicit workspace-level governed-AI kill switch. */
  enabled: boolean;
  allowedProviders: AIProviderName[];
  /** Legacy/default model per provider. Never a credential or account ID. */
  modelSelections: Partial<Record<AIProviderName, string>>;
  fallbackOrder: AIProviderName[];
  /** Stored-reader metadata only; existing callers still use the string default. */
  gatewaySelection?: GatewayModelSelectionV1;
}

interface PolicyRow {
  enabled?: unknown;
  allowedProviders: unknown;
  modelSelections: unknown;
  fallbackOrder: unknown;
}

interface PolicyRepo {
  organizationAIProviderPolicy: {
    findUnique(args: { where: { organizationId: string }; select: { enabled: true; allowedProviders: true; modelSelections: true; fallbackOrder: true } }): Promise<PolicyRow | null>;
    upsert(args: {
      where: { organizationId: string };
      create: { organizationId: string; enabled: boolean; allowedProviders: object; modelSelections: object; fallbackOrder: object; updatedBy: string };
      update: { enabled: boolean; allowedProviders: object; modelSelections: object; fallbackOrder: object; updatedBy: string };
    }): Promise<unknown>;
  };
}

export type WorkspaceAIProviderPolicyStorageState = "ready" | "migration_pending" | "unavailable";

export function workspaceAIProviderPolicyStorageState(error: unknown): WorkspaceAIProviderPolicyStorageState {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "P2021" || code === "P2022") return "migration_pending";
  return "unavailable";
}

function providerList(value: unknown): AIProviderName[] {
  if (!Array.isArray(value)) return [];
  const out: AIProviderName[] = [];
  for (const item of value) {
    if (isAIProviderName(item) && item !== "mock" && !out.includes(item)) out.push(item);
  }
  return out;
}

function modelSelections(value: unknown, allowedProviders: readonly AIProviderName[]): Partial<Record<AIProviderName, string>> | null {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) return null;
  const selections: Partial<Record<AIProviderName, string>> = {};
  for (const [provider, model] of Object.entries(value)) {
    if (!isAIProviderName(provider) || provider === "mock" || !allowedProviders.includes(provider) || typeof model !== "string") return null;
    if (provider === "vercel_gateway" ? !isGatewayModelId(model) : provider === "customer_hosted" ? !isCustomerHostedModelId(model) : !isKnownModel(provider, model)) return null;
    selections[provider] = model;
  }
  return selections;
}

/** Descriptor-safe JSON records only; never invoke stored getters/toJSON. */
function storedRecord(value: unknown, maximum: number): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const keys = Reflect.ownKeys(value); if (keys.length > maximum || keys.some(key => typeof key !== "string")) return null;
  const out: Record<string, unknown> = Object.create(null);
  for (const key of keys as string[]) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) return null;
    Object.defineProperty(out, key, { value: descriptor.value, enumerable: true });
  }
  return out;
}
function storedArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length");
  if (!length || !Object.hasOwn(length, "value") || !Number.isSafeInteger(length.value) || length.value < 0 || length.value > 32 || Reflect.ownKeys(value).length !== length.value + 1) return null;
  const out: unknown[] = [];
  for (let i = 0; i < length.value; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor?.enumerable || !Object.hasOwn(descriptor, "value")) return null;
    out.push(descriptor.value);
  }
  return out;
}
function storedGatewaySelection(value: unknown): GatewayModelSelectionV1 | null {
  const row = storedRecord(value, 3);
  if (!row || Object.keys(row).sort().join("|") !== "approvedModelIds|defaultModelId|version" || row.version !== 1) return null;
  const ids = storedArray(row.approvedModelIds);
  const concrete = (id: unknown): id is string => typeof id === "string" && id.length <= 200 && id !== "service-default" && !id.startsWith("vmc/") && isGatewayModelId(id);
  if (!concrete(row.defaultModelId) || !ids?.length || !ids.every(concrete) || new Set(ids).size !== ids.length || !ids.includes(row.defaultModelId)) return null;
  return Object.freeze({ version: 1, defaultModelId: row.defaultModelId, approvedModelIds: Object.freeze(ids as string[]) });
}
/** Storage compatibility only. Public normalization deliberately remains the
 * string-only write boundary until separate admin/API enablement is reviewed. */
export function normalizeStoredWorkspaceAIProviderPolicy(value: unknown): WorkspaceAIProviderPolicy | null {
  const row = storedRecord(value, 4);
  if (!row || Object.keys(row).some(key => !["enabled", "allowedProviders", "modelSelections", "fallbackOrder"].includes(key))) return null;
  // Preserve legacy providerList handling for null/primitive/non-array values;
  // only actual arrays need descriptor validation before normalization iterates.
  const allowedIsArray = Array.isArray(row.allowedProviders), fallbackIsArray = Array.isArray(row.fallbackOrder);
  const allowed = allowedIsArray ? storedArray(row.allowedProviders) : row.allowedProviders;
  const fallback = fallbackIsArray ? storedArray(row.fallbackOrder) : row.fallbackOrder;
  if (allowedIsArray && allowed === null || fallbackIsArray && fallback === null) return null;
  const selections = row.modelSelections === undefined || row.modelSelections === null ? {} : storedRecord(row.modelSelections, 32);
  if (!selections) return null;
  let gatewaySelection: GatewayModelSelectionV1 | undefined;
  const normalized: Record<string, unknown> = {};
  for (const [provider, model] of Object.entries(selections)) {
    let selected = model;
    if (provider === "vercel_gateway" && typeof model !== "string") {
      gatewaySelection = storedGatewaySelection(model) ?? undefined;
      if (!gatewaySelection) return null;
      selected = gatewaySelection.defaultModelId;
    }
    Object.defineProperty(normalized, provider, { value: selected, enumerable: true });
  }
  const policy = normalizeWorkspaceAIProviderPolicy({ enabled: row.enabled, allowedProviders: allowed, modelSelections: normalized, fallbackOrder: fallback });
  return policy && gatewaySelection ? { ...policy, gatewaySelection } : policy;
}

/** Reviewed admin write boundary for versioned selections. Legacy callers may
 * continue sending string models; routing still uses only the default string. */
export function normalizeWorkspaceAIProviderPolicyUpdate(input: unknown): WorkspaceAIProviderPolicy | null {
  const row = storedRecord(input, 32);
  if (!row) return null;
  const policy = normalizeStoredWorkspaceAIProviderPolicy({
    enabled: row.enabled, allowedProviders: row.allowedProviders,
    modelSelections: row.modelSelections, fallbackOrder: row.fallbackOrder,
  });
  if (!policy) return null;
  // GET responses expose the default string plus separate metadata. Preserve
  // that canonical API shape on edits; refuse ambiguous dual representations.
  if (row.gatewaySelection !== undefined) {
    const metadata = storedGatewaySelection(row.gatewaySelection);
    if (!metadata || policy.gatewaySelection || !policy.enabled
      || !policy.allowedProviders.includes("vercel_gateway")
      || policy.modelSelections.vercel_gateway !== metadata.defaultModelId) return null;
    return { ...policy, gatewaySelection: metadata };
  }
  if (policy.gatewaySelection && (!policy.enabled || !policy.allowedProviders.includes("vercel_gateway"))) return null;
  return policy;
}

/** Every explicitly approved Gateway ID must pass the current service catalog.
 * The legacy service-managed default remains a server-owned routing decision. */
export function gatewayPolicyModelIds(policy: WorkspaceAIProviderPolicy): readonly string[] {
  if (!policy.enabled || !policy.allowedProviders.includes("vercel_gateway")) return [];
  if (policy.gatewaySelection) return policy.gatewaySelection.approvedModelIds;
  const selected = policy.modelSelections.vercel_gateway;
  return selected && selected !== "service-default" ? [selected] : [];
}

export function normalizeWorkspaceAIProviderPolicy(input: {
  enabled?: unknown;
  allowedProviders?: unknown;
  modelSelections?: unknown;
  fallbackOrder?: unknown;
}): WorkspaceAIProviderPolicy | null {
  const enabled = input.enabled === undefined ? true : input.enabled;
  if (typeof enabled !== "boolean") return null;
  const allowedProviders = providerList(input.allowedProviders);
  const fallbackOrder = providerList(input.fallbackOrder);
  const selections = modelSelections(input.modelSelections, allowedProviders);
  if (!selections) return null;
  if (!enabled) {
    if (allowedProviders.length !== 0 || fallbackOrder.length !== 0 || Object.keys(selections).length !== 0) return null;
    return { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] };
  }
  if (allowedProviders.length === 0) return null;
  if (fallbackOrder.some((provider) => !allowedProviders.includes(provider))) return null;
  return { enabled: true, allowedProviders, modelSelections: selections, fallbackOrder };
}

export function resolveWorkspaceAIProviderPolicy(input: {
  stored: WorkspaceAIProviderPolicy | null;
  serviceEnabled: readonly AIProviderName[];
}): WorkspaceAIProviderPolicy {
  const serviceEnabled = providerList(input.serviceEnabled);
  // AI is opt-in, not opt-out: a workspace that has never explicitly
  // configured this policy (no row at all — e.g. every brand-new
  // workspace) must default to disabled, not to every service-enabled
  // provider allowed. Flipping this the other way would mean AI calls
  // start flowing for a tenant the moment any provider is turned on
  // service-wide, with no admin ever having opted in for that specific
  // workspace — unacceptable for a product treating workspace data as
  // potentially sensitive by default.
  if (!input.stored || !input.stored.enabled) {
    return { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] };
  }
  const gatewaySelection = input.stored.gatewaySelection === undefined ? undefined : storedGatewaySelection(input.stored.gatewaySelection);
  if (input.stored.gatewaySelection !== undefined && (!gatewaySelection || gatewaySelection.defaultModelId !== input.stored.modelSelections.vercel_gateway || !input.stored.allowedProviders.includes("vercel_gateway"))) {
    return { enabled: false, allowedProviders: [], modelSelections: {}, fallbackOrder: [] };
  }
  const allowedProviders = input.stored.allowedProviders.filter((provider) => serviceEnabled.includes(provider));
  const fallbackOrder = input.stored.fallbackOrder.filter((provider) => allowedProviders.includes(provider));
  const selected = Object.fromEntries(
    Object.entries(input.stored.modelSelections).filter(([provider, model]) => isAIProviderName(provider) && allowedProviders.includes(provider) && (provider === "vercel_gateway" ? isGatewayModelId(model) : provider === "customer_hosted" ? isCustomerHostedModelId(model) : isKnownModel(provider, model))),
  ) as Partial<Record<AIProviderName, string>>;
  for (const provider of allowedProviders) if (provider !== "customer_hosted") selected[provider] ??= defaultModelFor(provider);
  return {
    enabled: true,
    allowedProviders,
    modelSelections: selected,
    fallbackOrder: [...fallbackOrder, ...allowedProviders.filter((provider) => !fallbackOrder.includes(provider))],
    ...(gatewaySelection && allowedProviders.includes("vercel_gateway") ? { gatewaySelection } : {}),
  };
}

export async function loadWorkspaceAIProviderPolicyWithState(organizationId: string): Promise<{
  policy: WorkspaceAIProviderPolicy | null;
  storageState: WorkspaceAIProviderPolicyStorageState;
}> {
  try {
    const row = await (prisma as unknown as PolicyRepo).organizationAIProviderPolicy.findUnique({
      where: { organizationId },
      select: { enabled: true, allowedProviders: true, modelSelections: true, fallbackOrder: true },
    });
    return { policy: row ? normalizeStoredWorkspaceAIProviderPolicy(row) : null, storageState: "ready" };
  } catch (error) {
    return { policy: null, storageState: workspaceAIProviderPolicyStorageState(error) };
  }
}

export async function loadWorkspaceAIProviderPolicy(organizationId: string): Promise<WorkspaceAIProviderPolicy | null> {
  return (await loadWorkspaceAIProviderPolicyWithState(organizationId)).policy;
}

export async function saveWorkspaceAIProviderPolicy(input: {
  organizationId: string;
  policy: WorkspaceAIProviderPolicy;
  updatedBy: string;
}): Promise<void> {
  let selections: object = input.policy.modelSelections;
  if (input.policy.gatewaySelection !== undefined) {
    const metadata = storedGatewaySelection(input.policy.gatewaySelection);
    if (!metadata || !input.policy.enabled || !input.policy.allowedProviders.includes("vercel_gateway") || input.policy.modelSelections.vercel_gateway !== metadata.defaultModelId) throw new Error("workspace_gateway_policy_invalid");
    selections = { ...input.policy.modelSelections, vercel_gateway: metadata };
  }
  await (prisma as unknown as PolicyRepo).organizationAIProviderPolicy.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      enabled: input.policy.enabled,
      allowedProviders: input.policy.allowedProviders as unknown as object,
      modelSelections: selections,
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
    update: {
      enabled: input.policy.enabled,
      allowedProviders: input.policy.allowedProviders as unknown as object,
      modelSelections: selections,
      fallbackOrder: input.policy.fallbackOrder as unknown as object,
      updatedBy: input.updatedBy,
    },
  });
}
