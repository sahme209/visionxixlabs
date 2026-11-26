import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { unsafeAddress } from "@/lib/integrations/airflow/airflowClient";

/**
 * Flux read-only observation client (GitOps, parity item 10, step 1).
 *
 * Flux has no API of its own: its state lives in Kubernetes custom resources. This client reads
 * Kustomization objects in ONE namespace through the Kubernetes API with a bearer token that should be
 * bound to a read-only Role. Only GET requests; no reconcile annotation, suspend/resume, patch or delete.
 * Returns readiness, the applied/attempted revisions and the source reference; never manifests,
 * substitutions, decryption settings or secrets. Live acceptance needs a real cluster.
 */

export type FluxCredential = { authMode: "bearer"; token: string };
export type FluxReady = "Ready" | "NotReady" | "Progressing" | "Unknown";
export interface FluxKustomization {
  name: string;
  namespace: string;
  path: string | null;
  sourceKind: string | null;
  sourceName: string | null;
  suspended: boolean;
  ready: FluxReady;
  reason: string | null;
  appliedRevision: string | null;
  attemptedRevision: string | null;
  lastTransition: string | null;
}

export const FLUX_PAGE_LIMIT = 100;
export const FLUX_KUSTOMIZE_API = "kustomize.toolkit.fluxcd.io/v1";
const DNS_LABEL = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;
const NAME = /^[a-z0-9]([-a-z0-9.]{0,251}[a-z0-9])?$/;
const SOURCE_KINDS = new Set(["GitRepository", "OCIRepository", "Bucket", "HelmRepository"]);
// Flux revisions look like "main@sha1:<40 hex>" or "sha256:<64 hex>"; keep only that bounded shape.
const REVISION = /^(?:[A-Za-z0-9._\/-]{1,128}@)?(?:sha1:[0-9a-f]{40}|sha256:[0-9a-f]{64}|[0-9a-f]{40})$/;

/** Kubernetes API server root. Public HTTPS only; in-cluster and private addresses are refused. */
export async function validateFluxApiBaseUrl(value: string): Promise<string> {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("flux_url_invalid"); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("flux_https_url_required");
  if (!/^https:\/\/[^\\/?#\s]+\/?$/i.test(value)) throw new Error("flux_base_url_invalid");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal") || hostname.endsWith(".svc") || hostname.endsWith(".cluster.local")) throw new Error("flux_private_host_blocked");
  const allowlist = (process.env.FLUX_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  if (allowlist.length > 0 && !allowlist.includes(hostname)) throw new Error("flux_host_not_allowed");
  const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => unsafeAddress(address))) throw new Error("flux_private_host_blocked");
  return url.origin;
}

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max = 256): string | null => (typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : null);
const rev = (v: unknown): string | null => (typeof v === "string" && REVISION.test(v) ? v : null);

function readyOf(conditions: unknown): { ready: FluxReady; reason: string | null; at: string | null } {
  const ready = Array.isArray(conditions) ? conditions.find((c) => isRecord(c) && c.type === "Ready") : undefined;
  if (!isRecord(ready)) return { ready: "Unknown", reason: null, at: null };
  const reason = str(ready.reason, 64);
  const at = typeof ready.lastTransitionTime === "string" && !Number.isNaN(Date.parse(ready.lastTransitionTime)) ? ready.lastTransitionTime : null;
  if (ready.status === "True") return { ready: "Ready", reason, at };
  if (ready.status === "False") return { ready: "NotReady", reason, at };
  return { ready: reason === "Progressing" ? "Progressing" : "Unknown", reason, at };
}

export class FluxClient {
  private readonly namespace: string;
  constructor(private readonly baseUrl: string, namespace: string, private readonly credential: FluxCredential) {
    if (!DNS_LABEL.test(namespace)) throw new Error("flux_namespace_invalid");
    this.namespace = namespace;
  }

  /** Kustomizations in the configured namespace only; an item from another namespace is refused. */
  async listKustomizations(): Promise<FluxKustomization[]> {
    const response = await fetch(`${this.baseUrl}/apis/${FLUX_KUSTOMIZE_API}/namespaces/${this.namespace}/kustomizations?limit=${FLUX_PAGE_LIMIT}`, {
      method: "GET",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      headers: { accept: "application/json", authorization: `Bearer ${this.credential.token}` },
    });
    if (!response.ok) throw new Error(`flux_api_failed:${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.items) || body.items.length > FLUX_PAGE_LIMIT || !body.items.every(isRecord)) throw new Error("flux_response_invalid");
    return (body.items as Record<string, unknown>[]).map((item) => {
      const meta = item.metadata, spec = item.spec;
      if (!isRecord(meta) || typeof meta.name !== "string" || !NAME.test(meta.name) || meta.namespace !== this.namespace || !isRecord(spec)) throw new Error("flux_response_invalid");
      const status = isRecord(item.status) ? item.status : {};
      const source = isRecord(spec.sourceRef) ? spec.sourceRef : {};
      const { ready, reason, at } = readyOf(status.conditions);
      return {
        name: meta.name,
        namespace: this.namespace,
        path: str(spec.path, 512),
        sourceKind: SOURCE_KINDS.has(source.kind as string) ? (source.kind as string) : null,
        sourceName: typeof source.name === "string" && NAME.test(source.name) ? source.name : null,
        suspended: spec.suspend === true,
        ready,
        reason,
        appliedRevision: rev(status.lastAppliedRevision),
        attemptedRevision: rev(status.lastAttemptedRevision),
        lastTransition: at,
      };
    });
  }
}
