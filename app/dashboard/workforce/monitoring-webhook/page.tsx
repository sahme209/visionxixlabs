/** /dashboard/workforce/monitoring-webhook — Phase 643. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, BellAlertIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import {
  readMonitoringWebhookConfig,
  PROVIDER_LABEL,
  type WebhookProvider,
} from "@/lib/workforce/domains/monitoringWebhookConfig";

export const dynamic = "force-dynamic";

function pickStr(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

function maskSecret(secret: string): string {
  if (secret.length <= 16) return "•".repeat(secret.length);
  return `${secret.slice(0, 12)}…${secret.slice(-4)}`;
}

export default async function MonitoringWebhookPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/monitoring-webhook");
  }
  const sp = searchParams ? await searchParams : {};
  const notice = pickStr(sp.notice);
  const error = pickStr(sp.error);
  const justRotated = pickStr(sp.rotated) === "1";
  const fullSecretShown = pickStr(sp.secret);

  const config = await readMonitoringWebhookConfig(String(ctx.organizationId));
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://visionxixlabs.com";
  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/webhooks/monitoring`;

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">monitoring-webhook</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">inbound alert ingestion</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <BellAlertIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Monitoring webhook
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Point your existing alerting tool at our webhook — every firing alert can auto-fire the
          workload_performance_engineer for a structured analysis (verdict, deviations, root-cause
          hypotheses, recommended actions). Daily cost cap protects against alert storms turning
          into AI invoice blowouts.
        </p>
      </header>

      {notice === "saved" && (
        <section className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200 font-mono">configuration saved</p>
        </section>
      )}
      {notice === "deleted" && (
        <section className="mb-6 rounded-md border border-zinc-500/30 bg-zinc-500/[0.06] p-4">
          <p className="text-[12.5px] text-zinc-300 font-mono">configuration deleted · webhook ingestion off</p>
        </section>
      )}
      {error && (
        <section className="mb-6 rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-4">
          <p className="text-[12.5px] text-rose-200 font-mono">error: {error}</p>
        </section>
      )}
      {justRotated && fullSecretShown && (
        <section className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-300 mb-2">webhook-secret :: minted</p>
          <p className="text-[12px] text-zinc-200 leading-relaxed mb-2 font-mono">
            <span className="text-emerald-300">copy now</span> — full secret will not be shown again. Configure it in your alerting tool as the HMAC-SHA256 signing secret.
          </p>
          <div className="p-3 rounded border border-emerald-500/20 bg-black/40 break-all">
            <p className="text-[11px] font-mono text-emerald-200 select-all">{fullSecretShown}</p>
          </div>
        </section>
      )}

      {/* Current config readback */}
      {config && (
        <section className="mb-8 rounded-md border border-white/[0.06] bg-white/[0.012] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span className="text-emerald-300">current-config</span>
          </p>
          <dl className="space-y-2 text-[12.5px] font-mono">
            <div className="flex gap-3"><dt className="text-zinc-500 shrink-0 min-w-[120px]">webhook url</dt><dd className="text-zinc-200 break-all select-all">{webhookUrl}</dd></div>
            <div className="flex gap-3"><dt className="text-zinc-500 shrink-0 min-w-[120px]">provider</dt><dd className="text-zinc-200">{PROVIDER_LABEL[config.provider].label}</dd></div>
            <div className="flex gap-3"><dt className="text-zinc-500 shrink-0 min-w-[120px]">secret</dt><dd className="text-zinc-400">{maskSecret(config.webhookSecret)}</dd></div>
            <div className="flex gap-3"><dt className="text-zinc-500 shrink-0 min-w-[120px]">enabled</dt><dd className={config.enabled ? "text-emerald-300" : "text-amber-300"}>{config.enabled ? "yes" : "paused"}</dd></div>
            <div className="flex gap-3"><dt className="text-zinc-500 shrink-0 min-w-[120px]">auto-analyze</dt><dd className={config.autoAnalyze ? "text-emerald-300" : "text-zinc-400"}>{config.autoAnalyze ? "yes · auto-fire workload_performance_engineer" : "no · alerts persisted but no AI analysis"}</dd></div>
            <div className="flex gap-3"><dt className="text-zinc-500 shrink-0 min-w-[120px]">daily cost cap</dt><dd className="text-zinc-200">${(config.dailyCostCapCents / 100).toFixed(2)}{config.dailyCostCapCents === 0 ? " (uncapped)" : ""}</dd></div>
          </dl>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <form action="/api/workforce/monitoring-webhook" method="POST">
              <input type="hidden" name="action" value="rotate" />
              <input type="hidden" name="provider" value={config.provider} />
              <input type="hidden" name="enabled" value={config.enabled ? "true" : "false"} />
              <input type="hidden" name="autoAnalyze" value={config.autoAnalyze ? "true" : "false"} />
              <input type="hidden" name="dailyCostCapCents" value={config.dailyCostCapCents.toString()} />
              <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors">
                rotate secret →
              </button>
            </form>
            <form action="/api/workforce/monitoring-webhook" method="POST">
              <input type="hidden" name="action" value="delete" />
              <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-rose-500/30 text-rose-200 hover:text-white hover:border-rose-500/60 hover:bg-rose-500/10 transition-colors">
                delete config
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Config form */}
      <section className="mb-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>{config ? "update-config" : "configure"}</span>
        </p>
        <form action="/api/workforce/monitoring-webhook" method="POST" className="space-y-4">
          <input type="hidden" name="action" value="save" />
          <div>
            <label htmlFor="provider" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">provider</label>
            <select id="provider" name="provider" defaultValue={config?.provider ?? "generic"}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
              {(Object.keys(PROVIDER_LABEL) as WebhookProvider[]).map((p) => (
                <option key={p} value={p}>{PROVIDER_LABEL[p].label}</option>
              ))}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="enabled" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">enabled</label>
              <select id="enabled" name="enabled" defaultValue={config?.enabled === false ? "false" : "true"}
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
                <option value="true">yes · accept inbound</option>
                <option value="false">paused · reject inbound</option>
              </select>
            </div>
            <div>
              <label htmlFor="autoAnalyze" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">auto-analyze</label>
              <select id="autoAnalyze" name="autoAnalyze" defaultValue={config?.autoAnalyze ? "true" : "false"}
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
                <option value="false">no · persist alert only</option>
                <option value="true">yes · auto-fire workload_performance_engineer</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="dailyCostCapCents" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">daily auto-analyze cap (cents · 0 = uncapped)</label>
            <input id="dailyCostCapCents" name="dailyCostCapCents" type="number" min={0} step={100}
              defaultValue={config?.dailyCostCapCents ?? 1000}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors" />
            <p className="text-[10.5px] text-zinc-500 mt-1 font-mono">protects against alert storms · ~30¢ per auto-analyze · default $10/day</p>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <p className="text-[11px] text-zinc-500 font-mono">webhook URL fixed · workspace identified by HMAC signature</p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              {config ? "update" : "create"} →
            </button>
          </div>
        </form>
      </section>

      {/* Integration shape per provider */}
      {config && (
        <section className="rounded-md border border-white/[0.06] bg-white/[0.012] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
            <span className="text-zinc-700">//</span>
            <span className="text-emerald-300">integration-spec</span>
            <span className="text-zinc-700">::</span>
            <span className="text-zinc-500">{config.provider}</span>
          </p>
          <p className="text-[12.5px] text-zinc-300 leading-relaxed mb-2 font-mono">{PROVIDER_LABEL[config.provider].sampleNote}</p>
          <pre className="text-[11px] leading-relaxed text-zinc-200 font-mono bg-black/40 p-3 rounded border border-white/[0.06] overflow-x-auto whitespace-pre">{`POST ${webhookUrl}
${PROVIDER_LABEL[config.provider].signatureHeader}: sha256=<HMAC-SHA256 of raw body using your secret>
Content-Type: application/json

<your alerting tool's standard webhook payload — no changes needed>

200 → { ok: true, alertSlug, analysisSlug }
401 → { error: "signature_mismatch" } — secret doesn't match
400 → { error: "invalid_json" | "body_size_invalid" }`}</pre>
        </section>
      )}
    </div>
  );
}
