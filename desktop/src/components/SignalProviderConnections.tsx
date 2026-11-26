import { useEffect, useRef, useState } from "react";
import { Eye } from "lucide-react";
import { desktopClient, type SignalConnectionState, type SignalProviderId } from "../lib/desktopClient";

/**
 * Read-only signal connections: GitOps controllers, incident tools, error tracking, monitoring and
 * feature flags. Connecting validates with one bounded read on the server and grants observation only:
 * nothing here can sync, page, resolve, mute or toggle. Secret fields are never pre-filled and are cleared
 * after every attempt.
 */
type Field = { name: string; label: string; secret?: boolean; placeholder?: string; options?: ReadonlyArray<{ value: string; label: string }> };
const REGION = [{ value: "us", label: "US" }, { value: "eu", label: "EU" }] as const;
export const SIGNAL_PROVIDER_FORMS: ReadonlyArray<{ id: SignalProviderId; label: string; purpose: string; fields: readonly Field[] }> = [
  { id: "argo_cd", label: "Argo CD", purpose: "Which commit each application applied", fields: [{ name: "baseUrl", label: "Server URL", placeholder: "https://argocd.example.com" }, { name: "project", label: "Project", placeholder: "default" }, { name: "token", label: "Read-only token", secret: true }] },
  { id: "flux", label: "Flux", purpose: "Which revision each Kustomization applied", fields: [{ name: "baseUrl", label: "Kubernetes API URL", placeholder: "https://k8s.example.com" }, { name: "namespace", label: "Namespace", placeholder: "flux-system" }, { name: "token", label: "Read-only service account token", secret: true }] },
  { id: "pagerduty", label: "PagerDuty", purpose: "Open incidents beside deployments", fields: [{ name: "region", label: "Region", options: REGION }, { name: "token", label: "Read-only API key", secret: true }] },
  { id: "opsgenie", label: "Opsgenie", purpose: "Open alerts beside deployments", fields: [{ name: "region", label: "Region", options: REGION }, { name: "apiKey", label: "Read-only API key", secret: true }] },
  { id: "sentry", label: "Sentry", purpose: "New errors first seen in a release", fields: [{ name: "org", label: "Organization slug", placeholder: "acme" }, { name: "project", label: "Project slug", placeholder: "web" }, { name: "region", label: "Region", options: REGION }, { name: "token", label: "Token (project:read, event:read)", secret: true }] },
  { id: "datadog", label: "Datadog", purpose: "Monitor states for a service", fields: [{ name: "site", label: "Site", options: ["datadoghq.com", "us3.datadoghq.com", "us5.datadoghq.com", "datadoghq.eu", "ap1.datadoghq.com", "ddog-gov.com"].map((v) => ({ value: v, label: v })) }, { name: "tag", label: "Monitor tag", placeholder: "service:checkout" }, { name: "apiKey", label: "API key", secret: true }, { name: "appKey", label: "Application key (monitors_read)", secret: true }] },
  { id: "launchdarkly", label: "LaunchDarkly", purpose: "Flag state beside each release", fields: [{ name: "project", label: "Project key", placeholder: "default" }, { name: "environment", label: "Environment key", placeholder: "production" }, { name: "token", label: "Reader access token", secret: true }] },
  { id: "unleash", label: "Unleash", purpose: "Flag state for one environment", fields: [{ name: "baseUrl", label: "Unleash API URL", placeholder: "https://flags.example.com/api" }, { name: "token", label: "Client token", secret: true }] },
];

export function SignalProviderConnections() {
  return (
    <section aria-labelledby="signal-providers-title" className="mt-8 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-6">
      <div className="flex items-center gap-3">
        <Eye className="h-5 w-5 text-zinc-200" aria-hidden="true" />
        <div>
          <h2 id="signal-providers-title" className="text-base font-medium">Release signals</h2>
          <p className="mt-1 text-sm text-zinc-400">Read-only. V19 reads GitOps state, incidents, errors, monitors and flags to show beside releases; it never syncs, pages, resolves, mutes or toggles anything.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">{SIGNAL_PROVIDER_FORMS.map((p) => <SignalCard key={p.id} provider={p} />)}</div>
    </section>
  );
}

function SignalCard({ provider }: { provider: (typeof SIGNAL_PROVIDER_FORMS)[number] }) {
  const [state, setState] = useState<SignalConnectionState | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(provider.fields.filter((f) => f.options).map((f) => [f.name, f.options![0].value])));
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState<string | null>(null);
  const acted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => desktopClient.signalConnection(provider.id)).then((r) => {
      if (cancelled || acted.current || !r.ok) return;
      setState(r.data);
      const saved = r.data.settings ?? {};
      setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(saved).filter(([k]) => provider.fields.some((f) => f.name === k && !f.secret)).map(([k, val]) => [k, String(val === "de" ? "eu" : val)])) }));
    }).catch(() => { /* shown as not connected */ });
    return () => { cancelled = true; };
  }, [provider]);
  const complete = provider.fields.every((f) => (values[f.name] ?? "").trim().length > 0);
  const clearSecrets = () => setValues((v) => Object.fromEntries(Object.entries(v).filter(([k]) => !provider.fields.some((f) => f.name === k && f.secret))));
  async function connect() {
    acted.current = true; setBusy(true); setNotice(null);
    try {
      const r = await desktopClient.saveSignalConnection(provider.id, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()])));
      if (r.ok) { setState(r.data); setNotice(`Connected. ${r.data.inventoryCount ?? 0} found on the first read.`); } else setNotice(`Could not connect (${r.error ?? "error"}).`);
    } finally { clearSecrets(); setBusy(false); }
  }
  async function disconnect() {
    acted.current = true; setBusy(true); setNotice(null);
    try {
      const r = await desktopClient.disconnectSignalConnection(provider.id);
      if (r.ok) { setState({ provider: provider.id, status: "revoked", connected: false, authority: "observation_only" }); setNotice("Disconnected."); } else setNotice(`Could not disconnect (${r.error ?? "error"}).`);
    } finally { setBusy(false); }
  }
  const id = `signal-${provider.id}`;
  return (
    <article aria-labelledby={`${id}-title`} className="rounded-xl border border-white/[0.07] p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={`${id}-title`} className="text-sm font-medium text-zinc-100">{provider.label}</h3>
        <span className={`text-xs ${state?.connected ? "text-emerald-300" : "text-zinc-500"}`}>{state?.connected ? "Connected · read-only" : "Not connected"}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">{provider.purpose}</p>
      {provider.fields.map((f) => (
        <div key={f.name}>
          <label htmlFor={`${id}-${f.name}`} className="mt-3 block text-xs text-zinc-400">{f.label}</label>
          {f.options
            ? <select id={`${id}-${f.name}`} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">{f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input id={`${id}-${f.name}`} type={f.secret ? "password" : "text"} value={values[f.name] ?? ""} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })} placeholder={f.placeholder} autoComplete="off" spellCheck={false} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm" />}
        </div>))}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !complete} onClick={() => void connect()} className="btn-primary">{busy ? "Validating…" : state?.connected ? "Replace" : "Connect read-only"}</button>
        {state?.connected && <button type="button" disabled={busy} onClick={() => void disconnect()} className="btn-secondary">Disconnect</button>}
      </div>
      {notice && <p role="status" className="mt-3 text-xs text-zinc-400">{notice}</p>}
    </article>
  );
}
