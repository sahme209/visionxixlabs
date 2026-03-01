/**
 * Plugin system — core platform feature.
 * Plugins: name, permissions, execution, billing impact.
 * Connect via OAuth where possible, store encrypted credentials, execute real actions.
 */

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
