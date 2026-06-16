/** /dashboard/workforce/on-prem-connectors — Phase 641. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ServerStackIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import {
  listOnPremConnectors,
  PLATFORM_LABEL,
  type OnPremPlatform,
  type ScannerStatus,
} from "@/lib/workforce/domains/onPremConnectors";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<ScannerStatus, string> = {
  registered_pending_scanner: "text-amber-300",
  registered_ready: "text-sky-300",
  scanning_active: "text-emerald-300",
  scanning_stale: "text-rose-300",
};

const STATUS_LABEL: Record<ScannerStatus, string> = {
  registered_pending_scanner: "pending scanner",
  registered_ready: "ready",
  scanning_active: "scanning",
  scanning_stale: "stale",
};

function pickStr(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function OnPremConnectorsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/on-prem-connectors");
  }

  const sp = searchParams ? await searchParams : {};
  const notice = pickStr(sp.notice);
  const error = pickStr(sp.error);

  const connectors = await listOnPremConnectors(String(ctx.organizationId));

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">on-prem-connectors</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">vmware / openshift / vmm</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ServerStackIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          On-prem connector registry
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Register the on-prem virtualization platforms the workforce will scan. Read-only
          credentials only — actual secret retrieval happens at scan time via your secrets
          manager (vault / AWS Secrets Manager / Azure Key Vault / GCP Secret Manager).
        </p>
        <p className="text-[12px] text-amber-300/80 leading-relaxed max-w-xl mt-3 font-mono">
          honest scope :: registrations land today; platform-specific scanners ship per phase
        </p>
      </header>

      {notice === "registered" && (
        <section className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200 font-mono">connector registered · scanner integration tracked in your engagement scope</p>
        </section>
      )}
      {notice === "deleted" && (
        <section className="mb-6 rounded-md border border-zinc-500/30 bg-zinc-500/[0.06] p-4">
          <p className="text-[12.5px] text-zinc-300 font-mono">connector removed</p>
        </section>
      )}
      {error && (
        <section className="mb-6 rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-4">
          <p className="text-[12.5px] text-rose-200 font-mono">error: {error}</p>
        </section>
      )}

      {/* Registration form */}
      <section className="mb-10 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>register connector</span>
        </p>
        <form action="/api/workforce/on-prem-connectors/register" method="POST" className="space-y-4">
          <div>
            <label htmlFor="platform" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">platform</label>
            <select id="platform" name="platform" required defaultValue="vmware_vcenter"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
              {(Object.keys(PLATFORM_LABEL) as OnPremPlatform[]).map((p) => (
                <option key={p} value={p}>{PLATFORM_LABEL[p].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="displayName" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">display name</label>
            <input id="displayName" name="displayName" required maxLength={80}
              placeholder="e.g. Production vCenter — us-east-1 datacenter"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="endpoint" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">endpoint</label>
              <input id="endpoint" name="endpoint" required maxLength={400}
                placeholder="https://vcenter.corp.local"
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
              <p className="text-[10px] text-zinc-500 mt-1 font-mono">URL or host:port</p>
            </div>
            <div>
              <label htmlFor="environment" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">environment</label>
              <select id="environment" name="environment" required defaultValue="production"
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="secretReference" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">credential reference</label>
            <input id="secretReference" name="secretReference" required maxLength={400}
              placeholder="vault://onprem/vcenter-prod"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors" />
            <p className="text-[10px] text-zinc-500 mt-1 font-mono leading-relaxed">
              vault:// · secretsmanager:// · azurekeyvault:// · gcpsecretmanager:// · env:// — we never store the credential itself
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-zinc-500 font-mono">no metered AI · registration only · scan-side ships per engagement</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              register →
            </button>
          </div>
        </form>
      </section>

      {/* Connector list */}
      <section className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">registered</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400 tabular-nums">{connectors.length}</span>
        </p>
        {connectors.length === 0 ? (
          <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-10 text-center">
            <p className="text-[13px] text-zinc-400">No on-prem connectors registered yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1 font-mono">register your first vCenter / OpenShift / VMM endpoint above</p>
          </div>
        ) : (
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {connectors.map((c) => (
              <li key={c.slug} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-medium text-white">{c.displayName}</p>
                    <p className="text-[11.5px] font-mono text-zinc-500 mt-0.5">{PLATFORM_LABEL[c.platform].label}</p>
                  </div>
                  <span className={`font-mono text-[10px] uppercase tracking-wider ${STATUS_TONE[c.scannerStatus]}`}>
                    {STATUS_LABEL[c.scannerStatus]}
                  </span>
                </div>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-[11.5px] font-mono">
                  <div className="flex gap-2">
                    <dt className="text-zinc-500 shrink-0">endpoint</dt>
                    <dd className="text-zinc-200 truncate">{c.endpoint}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500 shrink-0">env</dt>
                    <dd className="text-zinc-200">{c.environment}</dd>
                  </div>
                  <div className="flex gap-2 sm:col-span-2">
                    <dt className="text-zinc-500 shrink-0">secret</dt>
                    <dd className="text-zinc-400 truncate">{c.secretReference}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-zinc-500 shrink-0">registered</dt>
                    <dd className="text-zinc-400">{c.registeredAt.toISOString().slice(0, 19).replace("T", " ")}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex items-center gap-3 flex-wrap">
                  <Link
                    href={`/dashboard/workforce/on-prem-connectors/${encodeURIComponent(c.slug)}`}
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors"
                  >
                    open · mint token →
                  </Link>
                  <form action="/api/workforce/on-prem-connectors/delete" method="POST">
                    <input type="hidden" name="slug" value={c.slug} />
                    <button type="submit" className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-rose-500/30 text-rose-200 hover:text-white hover:border-rose-500/60 hover:bg-rose-500/10 transition-colors">
                      delete
                    </button>
                  </form>
                  <span className="text-[10.5px] font-mono text-zinc-500 ml-auto">
                    scanner :: {PLATFORM_LABEL[c.platform].scannerPhase}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Platform catalog */}
      <section className="rounded-md border border-white/[0.06] bg-white/[0.012] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">platform-catalog</span>
        </p>
        <dl className="space-y-3">
          {(Object.keys(PLATFORM_LABEL) as OnPremPlatform[]).map((p) => (
            <div key={p} className="flex gap-3 items-baseline">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-emerald-300 shrink-0 min-w-[180px]">
                {p}
              </dt>
              <dd className="text-[12.5px] text-zinc-300 leading-relaxed flex-1 min-w-0">
                <span className="font-semibold">{PLATFORM_LABEL[p].label}</span>{" — "}
                <span className="text-zinc-400">{PLATFORM_LABEL[p].tagline}</span>
                <span className="ml-1 text-zinc-500 font-mono text-[11px]">({PLATFORM_LABEL[p].scannerPhase})</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
