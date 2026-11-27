/**
 * Public MCP server registry (registry.modelcontextprotocol.io) as V19's plugin catalog, layer 1 of
 * "plugins at scale". Browsing only: entries are untrusted third-party data, shown as text and links.
 * Nothing here connects to a listed server, sends it workspace data or grants an agent any tool.
 */
import { z } from "zod";

export const MCP_REGISTRY_ORIGIN = "https://registry.modelcontextprotocol.io";
const MAX_BYTES = 2_000_000;
const TIMEOUT_MS = 10_000;
export const REGISTRY_PAGE_SIZE = 30;

const remoteSchema = z.object({ type: z.string().max(40), url: z.string().max(2048) }).passthrough();
const packageSchema = z.object({ registryType: z.string().max(40).optional(), identifier: z.string().max(300).optional(), transport: z.object({ type: z.string().max(40) }).passthrough().optional() }).passthrough();
const entrySchema = z.object({
  server: z.object({
    name: z.string().min(1).max(200),
    title: z.string().max(200).optional(),
    description: z.string().max(2000).optional(),
    version: z.string().max(80).optional(),
    websiteUrl: z.string().max(2048).optional(),
    repository: z.object({ url: z.string().max(2048).optional(), source: z.string().max(40).optional() }).passthrough().optional(),
    remotes: z.array(remoteSchema).max(20).optional(),
    packages: z.array(packageSchema).max(20).optional(),
  }).passthrough(),
  _meta: z.record(z.string(), z.unknown()).optional(),
}).passthrough();
const pageSchema = z.object({ servers: z.array(z.unknown()).max(500), metadata: z.object({ nextCursor: z.string().max(400).optional(), count: z.number().optional() }).passthrough().optional() }).passthrough();

export type McpConnection = "remote" | "local_package";
export interface McpRegistryServer {
  name: string; title: string; description: string; version: string | null;
  websiteUrl: string | null; repositoryUrl: string | null;
  /** How the server is reached: a hosted https endpoint, or a package the user would run locally. */
  connections: McpConnection[];
  remoteHosts: string[];
  /** Hosted endpoints (https only, no credentials in the URL) a workspace can add. */
  remotes: Array<{ type: "streamable-http" | "sse"; url: string }>;
  packageTypes: string[];
  status: string | null;
}

const httpsUrl = (v: string | undefined): string | null => {
  if (!v) return null;
  try { const u = new URL(v); return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null; } catch { return null; }
};
const clean = (v: string | undefined, max: number) => (v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** Validates one registry page and keeps only safe, displayable fields. Invalid entries are dropped, not guessed. */
export function parseRegistryPage(raw: unknown): { servers: McpRegistryServer[]; nextCursor: string | null; dropped: number } {
  const page = pageSchema.safeParse(raw);
  if (!page.success) throw new Error("registry_response_invalid");
  const servers: McpRegistryServer[] = []; let dropped = 0;
  for (const item of page.data.servers) {
    const e = entrySchema.safeParse(item);
    if (!e.success) { dropped += 1; continue; }
    const s = e.data.server;
    const meta = e.data._meta?.["io.modelcontextprotocol.registry/official"] as { status?: unknown } | undefined;
    const remotes = (s.remotes ?? []).flatMap((r) => { const u = httpsUrl(r.url); return u && !u.includes("{") && (r.type === "streamable-http" || r.type === "sse") ? [{ type: r.type as "streamable-http" | "sse", url: u }] : []; }).slice(0, 5);
    const remoteHosts = [...new Set(remotes.map((r) => new URL(r.url).host))];
    const packageTypes = [...new Set((s.packages ?? []).map((p) => clean(p.registryType, 40)).filter(Boolean))];
    const connections: McpConnection[] = [...(remoteHosts.length ? ["remote" as const] : []), ...(packageTypes.length ? ["local_package" as const] : [])];
    servers.push({
      name: clean(s.name, 200),
      title: clean(s.title, 200) || clean(s.name, 200),
      description: clean(s.description, 400),
      version: clean(s.version, 80) || null,
      websiteUrl: httpsUrl(s.websiteUrl),
      repositoryUrl: httpsUrl(s.repository?.url),
      connections,
      remoteHosts,
      remotes,
      packageTypes,
      status: typeof meta?.status === "string" ? clean(meta.status, 40) : null,
    });
  }
  return { servers, nextCursor: page.data.metadata?.nextCursor ? clean(page.data.metadata.nextCursor, 400) : null, dropped };
}

export function registryUrl(input: { search?: string | null; cursor?: string | null }): string {
  const u = new URL("/v0/servers", MCP_REGISTRY_ORIGIN);
  u.searchParams.set("limit", String(REGISTRY_PAGE_SIZE));
  u.searchParams.set("version", "latest");
  const search = (input.search ?? "").trim();
  if (search) u.searchParams.set("search", search.slice(0, 100));
  if (input.cursor) u.searchParams.set("cursor", input.cursor.slice(0, 400));
  return u.toString();
}

/** Reads one page from the fixed registry host: no credentials, no redirects, bounded time and size. */
export async function fetchRegistryPage(input: { search?: string | null; cursor?: string | null }, fetchImpl: typeof fetch = fetch): Promise<ReturnType<typeof parseRegistryPage>> {
  const url = registryUrl(input);
  if (!url.startsWith(`${MCP_REGISTRY_ORIGIN}/`)) throw new Error("registry_host_refused");
  const res = await fetchImpl(url, { redirect: "error", credentials: "omit", headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS), next: { revalidate: 600 } } as RequestInit);
  if (!res.ok) throw new Error(`registry_http_${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("registry_response_too_large");
  return parseRegistryPage(JSON.parse(text));
}
