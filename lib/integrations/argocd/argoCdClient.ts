import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unsafeAddress } from "@/lib/integrations/airflow/airflowClient";

/**
 * Argo CD read-only observation client (GitOps, parity item 10, step 1).
 *
 * Scoped to ONE Argo CD project fixed at construction. Only GET requests; no sync, rollback,
 * refresh, terminate-op, patch or delete. Returns application identity, destination, sync and health
 * state and the observed revision only; never manifests, parameters, secrets or resource trees.
 * Live acceptance needs a real Argo CD instance and a read-only project token.
 */

export type ArgoCdCredential = { authMode: "bearer"; token: string };
export type ArgoCdSync = "Synced" | "OutOfSync" | "Unknown";
export type ArgoCdHealth = "Healthy" | "Progressing" | "Degraded" | "Suspended" | "Missing" | "Unknown";
export interface ArgoCdApplication {
  name: string;
  project: string;
  destinationNamespace: string | null;
  destinationServer: string | null;
  repoUrl: string | null;
  targetRevision: string | null;
  sync: ArgoCdSync;
  health: ArgoCdHealth;
  observedRevision: string | null;
  operationPhase: string | null;
  reconciledAt: string | null;
}

export const ARGOCD_PAGE_LIMIT = 100;
const NAME = /^[a-z0-9]([-a-z0-9.]{0,251}[a-z0-9])?$/;
const PROJECT = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;
const SYNC = new Set(["Synced", "OutOfSync"]);
const HEALTH = new Set(["Healthy", "Progressing", "Degraded", "Suspended", "Missing"]);
const SHA = /^[0-9a-f]{7,64}$/i;

/** Argo CD server root, or one path segment for an ingress prefix. Public HTTPS only. */
export async function validateArgoCdBaseUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("argocd_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("argocd_https_url_required");
  const raw = value.match(/^https:\/\/[^\\/?#\s]+([^?#\s]*)$/i);
  if (!raw || !/^(?:\/|\/[A-Za-z0-9_-]+\/?)?$/.test(raw[1]) || /^\/api\/?$/i.test(raw[1])) throw new Error("argocd_base_url_invalid");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".svc") || hostname.endsWith(".cluster.local")) throw new Error("argocd_private_host_blocked");
  const allowlist = (process.env.ARGOCD_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(hostname)) throw new Error("argocd_host_not_allowed");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("argocd_private_host_blocked");
  return `${url.origin}${raw[1].replace(/\/$/, "")}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 512): string | null => (typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : null);
const time = (v: unknown): string | null => (typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : null);

export class ArgoCdClient {
  private readonly project: string;
  constructor(private readonly baseUrl: string, project: string, private readonly credential: ArgoCdCredential) {
    if (!PROJECT.test(project)) throw new Error("argocd_project_invalid");
    this.project = project;
  }

  /** Applications in the configured project only; anything outside it means the scope was not honoured. */
  async listApplications(): Promise<ArgoCdApplication[]> {
    const response = await fetch(`${this.baseUrl}/api/v1/applications?projects=${encodeURIComponent(this.project)}`, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json", authorization: `Bearer ${this.credential.token}` },
    });
    if (!response.ok) throw new Error(`argocd_api_failed:${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body) || !(body.items === null || body.items === undefined || Array.isArray(body.items))) throw new Error("argocd_response_invalid");
    const items = (body.items ?? []) as unknown[];
    if (items.length > ARGOCD_PAGE_LIMIT || !items.every(isRecord)) throw new Error("argocd_response_invalid");
    return (items as Record<string, unknown>[]).map((item) => {
      const meta = item.metadata, spec = item.spec, status = item.status;
      if (!isRecord(meta) || typeof meta.name !== "string" || !NAME.test(meta.name) || !isRecord(spec) || spec.project !== this.project) throw new Error("argocd_response_invalid");
      const dest = isRecord(spec.destination) ? spec.destination : {};
      const source = isRecord(spec.source) ? spec.source : {};
      const st = isRecord(status) ? status : {};
      const sync = isRecord(st.sync) ? st.sync : {}, health = isRecord(st.health) ? st.health : {}, op = isRecord(st.operationState) ? st.operationState : {};
      const revision = str(sync.revision, 64);
      return {
        name: meta.name,
        project: this.project,
        destinationNamespace: str(dest.namespace, 63),
        destinationServer: str(dest.server ?? dest.name, 256),
        repoUrl: str(source.repoURL, 512),
        targetRevision: str(source.targetRevision, 256),
        sync: SYNC.has(sync.status as string) ? (sync.status as ArgoCdSync) : "Unknown",
        health: HEALTH.has(health.status as string) ? (health.status as ArgoCdHealth) : "Unknown",
        observedRevision: revision && SHA.test(revision) ? revision.toLowerCase() : null,
        operationPhase: str(op.phase, 32),
        reconciledAt: time(st.reconciledAt),
      };
    });
  }
}
