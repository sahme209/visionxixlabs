import { useEffect, useState } from "react";
import { Eye } from "lucide-react";
import { desktopClient, type BatchConnectionState, type BatchProviderId } from "../lib/desktopClient";

/**
 * Read-only Batches connections: Prefect, Dagster, Argo Workflows.
 * One compact card per provider. Connecting validates with one bounded read
 * on the server and grants observation only: nothing here can run a job.
 * The token field is never pre-filled and is cleared after every attempt.
 */
const PROVIDERS: ReadonlyArray<{ id: BatchProviderId; label: string; urlHint: string; tokenLabel: string; namespace?: boolean }> = [
  { id: "prefect", label: "Prefect", urlHint: "https://api.prefect.cloud/api/accounts/…/workspaces/…", tokenLabel: "API key" },
  { id: "dagster", label: "Dagster", urlHint: "https://your-org.dagster.cloud/prod", tokenLabel: "User token" },
  { id: "argo_workflows", label: "Argo Workflows", urlHint: "https://argo.example.com", tokenLabel: "Argo token", namespace: true },
];

export function BatchProviderConnections() {
  return (
    <section aria-labelledby="batch-providers-title" className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6">
      <div className="flex items-center gap-3">
        <Eye className="h-5 w-5 text-sky-200" aria-hidden="true" />
        <div>
          <h2 id="batch-providers-title" className="text-base font-medium">More batch providers</h2>
          <p className="mt-1 text-sm text-zinc-400">Read-only. The Agent can inspect flows, jobs and runs; it cannot start, retry or cancel anything.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{PROVIDERS.map((p) => <ProviderCard key={p.id} provider={p} />)}</div>
    </section>
  );
}

function ProviderCard({ provider }: { provider: (typeof PROVIDERS)[number] }) {
  const [state, setState] = useState<BatchConnectionState | null>(null);
  const [baseUrl, setBaseUrl] = useState(""); const [token, setToken] = useState(""); const [namespace, setNamespace] = useState("");
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => desktopClient.batchConnection(provider.id)).then((r) => {
      if (cancelled) return;
      if (r.ok) { setState(r.data); if (r.data.baseUrl) setBaseUrl(r.data.baseUrl); if (r.data.namespace) setNamespace(r.data.namespace); }
    }).catch(() => { /* shown as not connected */ });
    return () => { cancelled = true; };
  }, [provider.id]);

  const canConnect = baseUrl.startsWith("https://") && token.trim().length > 0 && (!provider.namespace || /^[a-z0-9]([-a-z0-9]{0,61}[a-z0-9])?$/.test(namespace));
  async function connect() {
    setBusy(true); setNotice(null);
    try {
      const r = await desktopClient.saveBatchConnection(provider.id, { baseUrl: baseUrl.trim(), token: token.trim(), ...(provider.namespace ? { namespace } : {}) });
      if (r.ok) { setState(r.data); setNotice(`Connected. ${r.data.inventoryCount ?? 0} found on the first page.`); } else setNotice(`Could not connect (${r.error ?? "error"}).`);
    } finally { setToken(""); setBusy(false); }
  }
  async function disconnect() {
    setBusy(true); setNotice(null);
    try {
      const r = await desktopClient.disconnectBatchConnection(provider.id);
      if (r.ok) { setState({ provider: provider.id, status: "revoked", connected: false, authority: "observation_only" }); setNotice("Disconnected."); } else setNotice(`Could not disconnect (${r.error ?? "error"}).`);
    } finally { setBusy(false); }
  }

  const id = `batch-${provider.id}`;
  return (
    <article aria-labelledby={`${id}-title`} className="rounded-xl border border-white/[0.07] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-medium text-zinc-100">{provider.label}</h3>
        <span className={`text-xs ${state?.connected ? "text-emerald-300" : "text-zinc-500"}`}>{state?.connected ? "Connected · read-only" : "Not connected"}</span>
      </div>
      <label htmlFor={`${id}-url`} className="mt-3 block text-xs text-zinc-400">API URL</label>
      <input id={`${id}-url`} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder={provider.urlHint} autoComplete="off" spellCheck={false} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" />
      {provider.namespace && <>
        <label htmlFor={`${id}-ns`} className="mt-3 block text-xs text-zinc-400">Namespace</label>
        <input id={`${id}-ns`} value={namespace} onChange={(e) => setNamespace(e.target.value.trim())} placeholder="batch" autoComplete="off" spellCheck={false} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" />
      </>}
      <label htmlFor={`${id}-token`} className="mt-3 block text-xs text-zinc-400">{provider.tokenLabel}</label>
      <input id={`${id}-token`} type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" />
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !canConnect} onClick={() => void connect()} className="btn-primary">{busy ? "Validating…" : state?.connected ? "Replace" : "Connect read-only"}</button>
        {state?.connected && <button type="button" disabled={busy} onClick={() => void disconnect()} className="btn-secondary">Disconnect</button>}
      </div>
      {notice && <p role="status" className="mt-3 text-xs text-zinc-400">{notice}</p>}
    </article>
  );
}
