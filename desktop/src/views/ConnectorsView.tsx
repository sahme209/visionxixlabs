import { ViewShell } from "../components/Primitives";
import type { View } from "../App";

const PROVIDERS = [
  {
    id: "aws",
    name: "Amazon Web Services",
    auth: "Cross-account IAM role",
    detail: "Read-only discovery adapter exists. Desktop enrollment requires a scoped connector-management service before this app may accept a role ARN.",
    color: "text-orange-300",
  },
  {
    id: "azure",
    name: "Microsoft Azure",
    auth: "Service principal",
    detail: "Validation adapter exists. This candidate does not accept client secrets because durable desktop enrollment and permission enforcement are not connected.",
    color: "text-blue-300",
  },
  {
    id: "gcp",
    name: "Google Cloud Platform",
    auth: "Service account",
    detail: "Validation adapter exists. This candidate does not accept service-account JSON because durable desktop enrollment and permission enforcement are not connected.",
    color: "text-red-300",
  },
] as const;

export function ConnectorsView({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <ViewShell>
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">integrations · controlled setup</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight">Cloud Connectors</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-500">
          Review released connector capability without handing credentials to an incomplete setup path.
        </p>
      </div>

      <div role="status" className="rounded-xl border border-white/25 bg-white/[0.08] p-4">
        <p className="text-sm font-semibold text-zinc-200">Enrollment unavailable in this candidate</p>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          A scoped, tenant-audited desktop connector-management endpoint is still required. No provider credential is requested, stored, or reported as connected from this screen.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        {PROVIDERS.map((provider) => (
          <article key={provider.id} className="glass-card flex min-h-48 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className={`text-base font-semibold ${provider.color}`}>{provider.name}</h2>
                <p className="mt-1 text-xs font-mono text-zinc-500">{provider.auth}</p>
              </div>
              <span className="rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[9px] font-mono uppercase tracking-wider text-zinc-300">
                setup blocked
              </span>
            </div>
            <p className="mt-5 flex-1 text-xs leading-5 text-zinc-400">{provider.detail}</p>
            <p className="mt-4 text-[10px] font-mono uppercase tracking-wider text-zinc-600">No secret fields enabled</p>
          </article>
        ))}
      </div>

      <div className="glass-card flex items-center justify-between gap-5 p-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-200">Already configured by your workspace?</h2>
          <p className="mt-1 text-xs text-zinc-500">Read the current server-verified provider lifecycle and any actionable failure.</p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate("connector-setup")}
          className="shrink-0 rounded-lg bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500"
        >
          View verified status →
        </button>
      </div>
    </ViewShell>
  );
}
