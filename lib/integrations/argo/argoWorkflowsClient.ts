import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unsafeAddress } from "@/lib/integrations/airflow/airflowClient";

/**
 * Argo Workflows read-only inventory client (A8, third new Batches provider).
 *
 * Observation only, scoped to ONE namespace fixed at construction (tenant /
 * namespace-scoped discovery before any governed execution). Only GET requests;
 * no submit, resubmit, retry, stop, terminate, suspend, resume or delete.
 * Never returns logs, artifacts, parameters, pod specs or secrets.
 * Distinct from Argo CD (deployment reconciliation), which is not covered here.
 */

export type ArgoCredential = { authMode: "bearer"; token: string };
export interface ArgoWorkflowTemplate { name: string; createdAt: string | null }
export interface ArgoWorkflow { name: string; uid: string; template: string | null; phase: string; startedAt: string | null; finishedAt: string | null; progress: string | null }

export const ARGO_PAGE_LIMIT = 50;
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;
const DNS_SUBDOMAIN = /^[a-z0-9]([-a-z0-9.]{0,251}[a-z0-9])?$/;
const UID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHASES = new Set(["Pending", "Running", "Succeeded", "Failed", "Error"]);

/** Argo Server root, or one path segment for an ingress prefix. Public HTTPS only. */
export async function validateArgoBaseUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("argo_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("argo_https_url_required");
  const raw = value.match(/^https:\/\/[^\\/?#\s]+([^?#\s]*)$/i);
  if (!raw || !/^(?:\/|\/[A-Za-z0-9_-]+\/?)?$/.test(raw[1]) || /^\/api\/?$/i.test(raw[1])) throw new Error("argo_base_url_invalid");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".svc") || hostname.endsWith(".cluster.local")) throw new Error("argo_private_host_blocked");
  const allowlist = (process.env.ARGO_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(hostname)) throw new Error("argo_host_not_allowed");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("argo_private_host_blocked");
  return `${url.origin}${raw[1].replace(/\/$/, "")}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const time = (v: unknown): string | null => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : null);

export class ArgoWorkflowsClient {
  private readonly namespace: string;
  constructor(private readonly baseUrl: string, namespace: string, private readonly credential: ArgoCredential) {
    if (!DNS_LABEL.test(namespace)) throw new Error("argo_namespace_invalid");
    this.namespace = namespace;
  }

  private async get(resource: "workflows" | "workflow-templates", query: string): Promise<Record<string, unknown>[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/${resource}/${this.namespace}?${query}`, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json", authorization: `Bearer ${this.credential.token}` },
    });
    if (!response.ok) throw new Error(`argo_api_failed:${response.status}`);
    const body: unknown = await response.json();
    // Argo returns `items: null` for an empty list.
    if (!isRecord(body) || !(body.items === null || body.items === undefined || Array.isArray(body.items))) throw new Error("argo_response_invalid");
    const items = (body.items ?? []) as unknown[];
    if (items.length > ARGO_PAGE_LIMIT || !items.every(isRecord)) throw new Error("argo_response_invalid");
    return items as Record<string, unknown>[];
  }

  /** Item metadata must name our namespace; anything else means the scope was not honoured. */
  private meta(item: Record<string, unknown>): Record<string, unknown> {
    const m = item.metadata;
    if (!isRecord(m) || m.namespace !== this.namespace || typeof m.name !== "string" || !DNS_SUBDOMAIN.test(m.name)) throw new Error("argo_response_invalid");
    return m;
  }

  async listTemplates(): Promise<ArgoWorkflowTemplate[]> {
    const items = await this.get("workflow-templates", `listOptions.limit=${ARGO_PAGE_LIMIT}`);
    const seen = new Set<string>();
    return items.map((item) => {
      const m = this.meta(item);
      const name = m.name as string;
      if (seen.has(name)) throw new Error("argo_response_invalid");
      seen.add(name);
      return { name, createdAt: time(m.creationTimestamp) };
    });
  }

  async listWorkflows(): Promise<ArgoWorkflow[]> {
    const items = await this.get("workflows", `listOptions.limit=${ARGO_PAGE_LIMIT}&fields=items.metadata.name,items.metadata.namespace,items.metadata.uid,items.spec.workflowTemplateRef,items.status.phase,items.status.startedAt,items.status.finishedAt,items.status.progress`);
    const seen = new Set<string>();
    return items.map((item) => {
      const m = this.meta(item);
      if (typeof m.uid !== "string" || !UID.test(m.uid) || seen.has(m.uid)) throw new Error("argo_response_invalid");
      seen.add(m.uid);
      const spec = isRecord(item.spec) ? item.spec : {};
      const ref = isRecord(spec.workflowTemplateRef) && typeof spec.workflowTemplateRef.name === "string" && DNS_SUBDOMAIN.test(spec.workflowTemplateRef.name) ? spec.workflowTemplateRef.name : null;
      const status = isRecord(item.status) ? item.status : {};
      return {
        name: m.name as string, uid: m.uid, template: ref,
        phase: typeof status.phase === "string" && PHASES.has(status.phase) ? status.phase : "Unknown",
        startedAt: time(status.startedAt), finishedAt: time(status.finishedAt),
        progress: typeof status.progress === "string" && /^\d{1,6}\/\d{1,6}$/.test(status.progress) ? status.progress : null,
      };
    });
  }
}
