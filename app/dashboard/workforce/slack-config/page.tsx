/** /dashboard/workforce/slack-config — Phase 635. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { readSlackConfig } from "@/lib/workforce/domains/slackNotify";

export const dynamic = "force-dynamic";

function pickStr(v: string | string[] | undefined, max: number): string {
  if (typeof v !== "string") return "";
  return v.slice(0, max);
}

function maskWebhook(url: string): string {
  // Show only the first 40 chars + last 6 to keep the secret out of casual view.
  if (url.length <= 50) return url;
  return `${url.slice(0, 40)}…${url.slice(-6)}`;
}

export default async function SlackConfigPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/slack-config");
  }
  const sp = searchParams ? await searchParams : {};
  const saved = pickStr(sp.saved, 4) === "1";
  const deleted = pickStr(sp.deleted, 4) === "1";
  const testResult = pickStr(sp.test, 80);
  const error = pickStr(sp.error, 80);

  const config = await readSlackConfig(String(ctx.organizationId));

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">notifications · slack</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Slack digest notifications
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Paste a Slack incoming-webhook URL. The daily-digest cron will POST a single message to
          your channel each day when your workspace crosses the threshold you set. Hard SSRF
          protection: only <span className="font-mono text-zinc-300">hooks.slack.com</span> URLs are accepted.
        </p>
      </header>

      {saved && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200">Configuration saved. Click test below to confirm the webhook works.</p>
        </div>
      )}
      {deleted && (
        <div className="mb-6 rounded-2xl border border-zinc-500/20 bg-zinc-500/[0.04] p-4">
          <p className="text-[12.5px] text-zinc-300">Configuration deleted. Slack notifications are now off.</p>
        </div>
      )}
      {testResult === "ok" && (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200">Test message delivered. Check your Slack channel.</p>
        </div>
      )}
      {testResult && testResult !== "ok" && testResult !== "no_config" && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-4">
          <p className="text-[12.5px] text-rose-200">Test failed: {decodeURIComponent(testResult)}</p>
        </div>
      )}
      {testResult === "no_config" && (
        <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
          <p className="text-[12.5px] text-amber-200">No configuration to test — save a webhook URL first.</p>
        </div>
      )}
      {error === "invalid_webhook_url" && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/[0.06] p-4">
          <p className="text-[12.5px] text-rose-200">Invalid URL. Webhooks must look like <span className="font-mono">https://hooks.slack.com/services/...</span></p>
        </div>
      )}

      {config && (
        <section className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-3">current config</p>
          <dl className="space-y-2 text-[13px]">
            <div className="flex items-baseline gap-3">
              <dt className="w-32 font-mono text-zinc-500 text-[11px] uppercase tracking-wider shrink-0">webhook url</dt>
              <dd className="font-mono text-zinc-200 truncate">{maskWebhook(config.webhookUrl)}</dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="w-32 font-mono text-zinc-500 text-[11px] uppercase tracking-wider shrink-0">enabled</dt>
              <dd className={config.enabled ? "text-emerald-300" : "text-amber-300"}>{config.enabled ? "yes" : "paused"}</dd>
            </div>
            <div className="flex items-baseline gap-3">
              <dt className="w-32 font-mono text-zinc-500 text-[11px] uppercase tracking-wider shrink-0">threshold</dt>
              <dd className="text-zinc-200">
                {config.minOutcome === "critical" ? "critical only (recommended)" : "active + critical (more chatty)"}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <form action="/api/workforce/slack-config" method="POST">
              <input type="hidden" name="action" value="test" />
              <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors">
                send test →
              </button>
            </form>
            <form action="/api/workforce/slack-config" method="POST">
              <input type="hidden" name="action" value="delete" />
              <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-rose-500/30 text-rose-200 hover:text-white hover:border-rose-500/60 hover:bg-rose-500/10 transition-colors">
                delete config
              </button>
            </form>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-3">{config ? "update configuration" : "configure"}</p>
        <form action="/api/workforce/slack-config" method="POST" className="space-y-4">
          <div>
            <label htmlFor="webhookUrl" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">webhook url</label>
            <input
              id="webhookUrl" name="webhookUrl" type="url" required maxLength={500}
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              defaultValue={config?.webhookUrl ?? ""}
              className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[12.5px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
            <p className="text-[10.5px] text-zinc-500 mt-1.5 leading-snug">
              Create an incoming webhook at <span className="font-mono">api.slack.com/apps</span> → your app → Incoming Webhooks → Activate → Add New Webhook.
              Copy the URL and paste here. Only hooks.slack.com URLs are accepted.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="enabled" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">enabled</label>
              <select id="enabled" name="enabled" defaultValue={config?.enabled === false ? "false" : "true"}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
                <option value="true">yes · post to slack</option>
                <option value="false">paused · keep config, no posts</option>
              </select>
            </div>
            <div>
              <label htmlFor="minOutcome" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-2 block">notification threshold</label>
              <select id="minOutcome" name="minOutcome" defaultValue={config?.minOutcome ?? "critical"}
                className="w-full rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors">
                <option value="critical">critical only (recommended)</option>
                <option value="active">active + critical (chatty)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
            <p className="text-[11px] text-zinc-500">
              Fires once per day per workspace via <span className="font-mono">workforce-daily-digest</span> at 13:00 UTC.
            </p>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              {config ? "update" : "save"} →
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
