/**
 * V19 plugin manifest, version 1 (plugins at scale, layer 3). A vendor or customer describes a plugin in
 * one JSON file: who publishes it, how V19 reaches it (a hosted MCP server over https), the tools it
 * offers with whether each one only reads, the webhook events it wants and the API scopes it asks for.
 * Validation only: a valid manifest grants nothing. Every tool that can write still goes through the
 * agent gateway and a person's approval, and scopes are limited to the self-service set.
 */
import { z } from "zod";
import { SELF_SERVICE_SCOPES } from "@/lib/security/selfServiceApiKeyPolicy";
import { isWebhookEventKind } from "@/lib/webhooks/webhookEventKinds";

export const PLUGIN_MANIFEST_KIND = "v19.plugin";
export const PLUGIN_MANIFEST_VERSION = 1;

const slug = z.string().regex(/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/, "lowercase letters, digits and hyphens, 3 to 64 characters");
const text = (max: number) => z.string().trim().min(1).max(max).refine((v) => !/[\u0000-\u001f]/.test(v), "no control characters");
const https = z.string().max(2048).refine((v) => { try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password && !["localhost", "127.0.0.1", "[::1]"].includes(u.hostname); } catch { return false; } }, "use a public https URL");

const toolSchema = z.object({
  name: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, "lowercase snake_case, 2 to 64 characters"),
  description: text(400),
  /** true only when the tool never changes anything outside the plugin. Writes always need approval. */
  readOnly: z.boolean(),
  /** What a write can touch, shown to the approver. Required when readOnly is false. */
  effect: text(200).optional(),
}).strict().refine((t) => t.readOnly || Boolean(t.effect), { message: "tools that write must describe their effect", path: ["effect"] });

export const pluginManifestSchema = z.object({
  kind: z.literal(PLUGIN_MANIFEST_KIND),
  version: z.literal(PLUGIN_MANIFEST_VERSION),
  id: slug,
  name: text(80),
  pluginVersion: z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]{1,40})?$/, "use semantic versioning, for example 1.2.0"),
  publisher: z.object({ name: text(80), website: https, securityContact: z.string().email().max(200) }).strict(),
  description: text(600),
  categories: z.array(z.enum(["release", "incident", "observability", "security", "cloud", "data", "collaboration", "documentation", "other"])).min(1).max(3),
  transport: z.object({ type: z.literal("mcp_streamable_http"), url: https }).strict(),
  tools: z.array(toolSchema).min(1).max(50),
  webhookEvents: z.array(z.string().max(80)).max(20).default([]),
  apiScopes: z.array(z.string().max(40)).max(8).default([]),
}).strict();

export type PluginManifest = z.infer<typeof pluginManifestSchema>;
export interface ManifestReview { readOnlyTools: number; writeTools: Array<{ name: string; effect: string }>; host: string; scopes: string[]; events: string[] }

export function validatePluginManifest(input: unknown): { ok: true; manifest: PluginManifest; review: ManifestReview } | { ok: false; errors: string[] } {
  const parsed = pluginManifestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "manifest"}: ${i.message}`) };
  const m = parsed.data; const errors: string[] = [];
  const names = new Set<string>();
  m.tools.forEach((t, i) => { if (names.has(t.name)) errors.push(`tools.${i}.name: "${t.name}" appears twice`); names.add(t.name); });
  m.webhookEvents.forEach((e, i) => { if (!isWebhookEventKind(e)) errors.push(`webhookEvents.${i}: "${e}" is not a V19 event`); });
  m.apiScopes.forEach((s, i) => { if (!(SELF_SERVICE_SCOPES as readonly string[]).includes(s)) errors.push(`apiScopes.${i}: "${s}" cannot be requested by a plugin`); });
  if (errors.length) return { ok: false, errors };
  return { ok: true, manifest: m, review: { readOnlyTools: m.tools.filter((t) => t.readOnly).length, writeTools: m.tools.filter((t) => !t.readOnly).map((t) => ({ name: t.name, effect: t.effect! })), host: new URL(m.transport.url).host, scopes: [...new Set(m.apiScopes)].sort(), events: [...new Set(m.webhookEvents)].sort() } };
}

/** A complete example a publisher can copy. */
export const EXAMPLE_PLUGIN_MANIFEST = {
  kind: PLUGIN_MANIFEST_KIND, version: PLUGIN_MANIFEST_VERSION,
  id: "example-status-page", name: "Example status page", pluginVersion: "1.0.0",
  publisher: { name: "Example Inc.", website: "https://example.com", securityContact: "security@example.com" },
  description: "Reads current incidents from the status page and can post a maintenance notice after a person approves it.",
  categories: ["incident"],
  transport: { type: "mcp_streamable_http", url: "https://mcp.example.com/v1" },
  tools: [
    { name: "list_incidents", description: "List open incidents on the status page.", readOnly: true },
    { name: "post_maintenance_notice", description: "Post a scheduled maintenance notice.", readOnly: false, effect: "Publishes a notice on the public status page." },
  ],
  webhookEvents: ["deployment.freeze_started", "deployment.freeze_ended"],
  apiScopes: ["release_gate:read"],
} as const;
