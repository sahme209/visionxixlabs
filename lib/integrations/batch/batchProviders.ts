import "server-only";

import { PrefectClient, validatePrefectApiUrl } from "@/lib/integrations/prefect/prefectClient";
import { DagsterClient, validateDagsterBaseUrl } from "@/lib/integrations/dagster/dagsterClient";
import { ArgoWorkflowsClient, validateArgoBaseUrl } from "@/lib/integrations/argo/argoWorkflowsClient";

/**
 * Read-only Batches providers (A8): Prefect, Dagster, Argo Workflows.
 * One closed union and one descriptor per provider, so the connection route,
 * loader and observation tools never branch on free-form strings.
 * Every client here is observation only; none has a mutation method.
 */
export const BATCH_PROVIDERS = ["prefect", "dagster", "argo_workflows"] as const;
export type BatchProvider = (typeof BATCH_PROVIDERS)[number];
export const isBatchProvider = (v: unknown): v is BatchProvider => typeof v === "string" && (BATCH_PROVIDERS as readonly string[]).includes(v);

export type BatchClient = PrefectClient | DagsterClient | ArgoWorkflowsClient;
/** Non-secret metadata saved beside the encrypted credential. */
export type BatchMetadata = { baseUrl: string; namespace?: string; inventoryCount: number };

const DNS_LABEL = /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/;
const secret = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length <= 4096 && v.trim() === v ? v : null);

type Descriptor = {
  label: string;
  /** Parses untrusted connect input into a validated base URL, secret and optional namespace. */
  parse(input: Record<string, unknown>): Promise<{ baseUrl: string; token: string; namespace?: string }>;
  client(baseUrl: string, token: string, namespace?: string): BatchClient;
  /** A bounded read proving the credential works; returns an inventory count. */
  probe(client: BatchClient): Promise<number>;
};

export const BATCH_DESCRIPTORS: Readonly<Record<BatchProvider, Descriptor>> = Object.freeze({
  prefect: {
    label: "Prefect",
    async parse(i) { const token = secret(i.token); if (!token) throw new Error("credentials_required"); return { baseUrl: await validatePrefectApiUrl(String(i.baseUrl ?? "").trim()), token }; },
    client: (baseUrl, token) => new PrefectClient(baseUrl, { authMode: "api_key", apiKey: token }),
    async probe(c) { return (await (c as PrefectClient).listFlows()).length; },
  },
  dagster: {
    label: "Dagster",
    async parse(i) { const token = secret(i.token); if (!token) throw new Error("credentials_required"); return { baseUrl: await validateDagsterBaseUrl(String(i.baseUrl ?? "").trim()), token }; },
    client: (baseUrl, token) => new DagsterClient(baseUrl, { authMode: "api_token", token }),
    async probe(c) { return (await (c as DagsterClient).listJobs()).length; },
  },
  argo_workflows: {
    label: "Argo Workflows",
    async parse(i) {
      const token = secret(i.token); const namespace = typeof i.namespace === "string" ? i.namespace.trim() : "";
      if (!token) throw new Error("credentials_required");
      if (!DNS_LABEL.test(namespace)) throw new Error("argo_namespace_invalid");
      return { baseUrl: await validateArgoBaseUrl(String(i.baseUrl ?? "").trim()), token, namespace };
    },
    client: (baseUrl, token, namespace) => new ArgoWorkflowsClient(baseUrl, namespace ?? "", { authMode: "bearer", token }),
    async probe(c) { return (await (c as ArgoWorkflowsClient).listTemplates()).length; },
  },
});

/** Error codes safe to return to the desktop; anything else collapses to a generic code. */
export function publicBatchError(provider: BatchProvider, error: unknown): string {
  const code = error instanceof Error ? error.message.split(":")[0] : "";
  const prefix = provider === "argo_workflows" ? "argo_" : `${provider}_`;
  return code === "credentials_required" || (code.startsWith(prefix) && /^[a-z_]{3,60}$/.test(code)) ? code : `${provider}_connection_failed`;
}
