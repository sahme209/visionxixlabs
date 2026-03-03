/**
 * Plugin system — core platform feature.
 * Plugins: name, permissions, execution, billing impact.
 * Connect via OAuth where possible, store encrypted credentials, execute real actions.
 */

// --- Execution Plugin Layer (Axiom automation) ---

export type ExecutionScope = "cloud:aws" | "cloud:azure" | "cloud:gcp" | "cloud:read" | "cloud:write";

export type PluginEntitlements = {
  plan?: string | null;
  purchasedPlugins?: string[];
};

export interface ExecutionPluginLogger {
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface ExecutionPluginContext {
  userId: string;
  projectId?: string;
  leadId?: string;
  dryRun: boolean;
  entitlements: PluginEntitlements;
  logger: ExecutionPluginLogger;
  /** Encrypted credential key — never store raw secrets */
  credentialsKey?: string;
}

export interface PluginResult {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  summary?: string;
  rollbackHints?: string[];
}

export interface ExecutionPlugin {
  id: string;
  name: string;
  description: string;
  scopesRequired: ExecutionScope[];
  planRequired?: string;
  /** Read-only plugins may only run in dryRun */
  readOnly?: boolean;
  /** When true, apply execution requires explicit user confirmation (CONFIRM APPLY) */
  modifiesInfrastructure?: boolean;
  run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult>;
}

// --- Builder/Axiom Plugin Layer (existing) ---

export type PluginPermission =
  | "cloud:read"
  | "cloud:write"
  | "deploy"
  | "domain:dns"
  | "analytics:read"
  | "analytics:write"
  | "crm:read"
  | "crm:write"
  | "monitoring:read"
  | "monitoring:write"
  | "storage"
  | "email";

export type PluginContext = {
  userId: string;
  projectId?: string;
  params: Record<string, unknown>;
  /** Encrypted credentials key (fetched by plugin runtime, not passed in) */
  credentialsKey?: string;
};

export type PluginExecuteResult =
  | { ok: true; data: unknown }
  | { ok: false; error: string };

export interface PluginDefinition {
  id: string;
  name: string;
  description: string;
  permissions: PluginPermission[];
  /** Monthly add-on price in cents, 0 = included in tier */
  billingImpactCents: number;
  /** Product tracks that can attach this plugin */
  productTracks: ("builder" | "axiom")[];
  /** Execute real action (not text suggestion) */
  execute: (ctx: PluginContext) => Promise<PluginExecuteResult>;
}
