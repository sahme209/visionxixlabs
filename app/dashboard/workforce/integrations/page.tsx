/** /dashboard/workforce/integrations — Phase 644 — config + history. */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, BoltIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { prisma } from "@/lib/db";
import {
  readIntegrationConfig,
} from "@/lib/workforce/domains/integrationRegistry";
import { ACTION_EXECUTION_TARGET_KIND } from "@/lib/workforce/domains/actionExecutor";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  executed: "text-emerald-300",
  skipped: "text-zinc-300",
  failed: "text-rose-300",
};

function pickStr(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/integrations");
  }
  const sp = searchParams ? await searchParams : {};
  const notice = pickStr(sp.notice);
  const error = pickStr(sp.error);

  const config = await readIntegrationConfig(String(ctx.organizationId));

  // Recent executions for audit visibility.
  const recentRows = await prisma.aiRationaleEnrichment.findMany({
    where: {
      organizationId: String(ctx.organizationId),
      targetKind: ACTION_EXECUTION_TARGET_KIND,
    },
    orderBy: { updatedAt: "desc" },
    take: 30,
    select: { targetId: true, narrative: true, nextActionsJson: true, updatedAt: true },
  }).catch(() => []);

  const executions = recentRows.map((r) => {
    let status = "";
    let externalRef: string | null = null;
    let upstreamRef: string | null = null;
    let title = "";
    if (Array.isArray(r.nextActionsJson)) {
      for (const e of r.nextActionsJson as unknown[]) {
        if (typeof e !== "string") continue;
        if (e.startsWith("status|")) status = e.slice("status|".length);
        else if (e.startsWith("external_ref|")) externalRef = e.slice("external_ref|".length);
        else if (e.startsWith("upstream_ref|")) upstreamRef = e.slice("upstream_ref|".length);
        else if (e.startsWith("title|")) title = e.slice("title|".length);
      }
    }
    return { targetId: r.targetId, narrative: r.narrative, status, externalRef, upstreamRef, title, updatedAt: r.updatedAt };
  });

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">integrations</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-500">action layer</span>
        </p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <BoltIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          Actions &amp; integrations
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Engineers produce reports today. Configure an integration and they can also DO things —
          open a GitHub issue when the approver_engineer signs a packet, post to Slack when
          council casts a verdict, file a Linear ticket on a critical finding. Every action is
          audit-logged and the credential never lives in our database — we just call your secrets
          manager at action time.
        </p>
      </header>

      {notice === "saved" && (
        <section className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200 font-mono">integration saved</p>
        </section>
      )}
      {notice === "test_fired" && (
        <section className="mb-6 rounded-md border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
          <p className="text-[12.5px] text-emerald-200 font-mono">test issue fired — see recent actions below</p>
        </section>
      )}
      {error && (
        <section className="mb-6 rounded-md border border-rose-500/30 bg-rose-500/[0.06] p-4">
          <p className="text-[12.5px] text-rose-200 font-mono">error: {error}</p>
        </section>
      )}

      {/* GitHub config */}
      <section className="mb-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>github-issue</span>
          <span className="text-zinc-700">::</span>
          <span className={config.github?.enabled ? "text-emerald-300" : "text-zinc-500"}>
            {config.github?.enabled ? "enabled" : "not configured"}
          </span>
        </p>
        <form id="github-test-form" action="/api/workforce/integrations/github/test" method="POST" />
        <form id="github-save-form" action="/api/workforce/integrations/github" method="POST" className="space-y-3">
          <div>
            <label htmlFor="repo" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">repo</label>
            <input
              id="repo"
              name="repo"
              required
              maxLength={200}
              defaultValue={config.github?.repo ?? ""}
              placeholder="owner/repo"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="patReference" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">PAT reference</label>
            <input
              id="patReference"
              name="patReference"
              required
              maxLength={400}
              defaultValue={config.github?.patReference ?? "env://GITHUB_ACTION_PAT"}
              placeholder="env://GITHUB_ACTION_PAT or vault://..."
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
            <p className="text-[10.5px] text-zinc-500 mt-1 font-mono leading-relaxed">
              env://VAR reads process.env · vault://path reads VAULT_ADDR + VAULT_TOKEN (KV v1/v2, .data.value) · secretsmanager://name uses default AWS chain in AWS_REGION · azurekeyvault:// / gcpsecretmanager:// not yet wired
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="issueLabel" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">issue label</label>
              <input
                id="issueLabel"
                name="issueLabel"
                maxLength={64}
                defaultValue={config.github?.issueLabel ?? "axiom-finding"}
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="enabled" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">enabled</label>
              <select
                id="enabled"
                name="enabled"
                defaultValue={config.github?.enabled === false ? "false" : "true"}
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors"
              >
                <option value="true">yes</option>
                <option value="false">paused</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <button type="submit" form="github-test-form" className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors">
              test :: open issue →
            </button>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              save →
            </button>
          </div>
        </form>
      </section>

      {/* Slack actions config */}
      <section className="mb-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>slack-actions</span>
          <span className="text-zinc-700">::</span>
          <span className={config.slackActions?.enabled ? "text-emerald-300" : "text-zinc-500"}>
            {config.slackActions?.enabled ? "enabled" : "not configured"}
          </span>
        </p>
        <p className="text-[11.5px] text-zinc-500 mb-3 font-mono">
          distinct from the daily-digest Slack — this fires on engineer actions (approval signed, council verdict, critical alert)
        </p>
        <form action="/api/workforce/integrations/slack-actions" method="POST" className="space-y-3">
          <div>
            <label htmlFor="webhookUrl" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">webhook url</label>
            <input
              id="webhookUrl"
              name="webhookUrl"
              type="url"
              required
              maxLength={400}
              defaultValue={config.slackActions?.webhookUrl ?? ""}
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="slackEnabled" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">enabled</label>
            <select
              id="slackEnabled"
              name="enabled"
              defaultValue={config.slackActions?.enabled === false ? "false" : "true"}
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors"
            >
              <option value="true">yes</option>
              <option value="false">paused</option>
            </select>
          </div>
          <div className="flex items-center justify-end gap-3 flex-wrap pt-1">
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              save →
            </button>
          </div>
        </form>
      </section>

      {/* Linear config */}
      <form id="linear-test-form" action="/api/workforce/integrations/linear/test" method="POST" />
      <section className="mb-8 rounded-md border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span>linear-ticket</span>
          <span className="text-zinc-700">::</span>
          <span className={config.linear?.enabled ? "text-emerald-300" : "text-zinc-500"}>
            {config.linear?.enabled ? "enabled" : "not configured"}
          </span>
        </p>
        <p className="text-[11.5px] text-zinc-500 mb-3 font-mono">
          fires when council / approver / finops verdicts need to land in a non-engineering tracker (PM, ops, finance)
        </p>
        <form action="/api/workforce/integrations/linear" method="POST" className="space-y-3">
          <div>
            <label htmlFor="teamId" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">team id</label>
            <input
              id="teamId"
              name="teamId"
              required
              maxLength={80}
              defaultValue={config.linear?.teamId ?? ""}
              placeholder="b3c2a1d4-e5f6-... (Linear team UUID)"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="apiKeyReference" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">api key reference</label>
            <input
              id="apiKeyReference"
              name="apiKeyReference"
              required
              maxLength={400}
              defaultValue={config.linear?.apiKeyReference ?? "env://LINEAR_API_KEY"}
              placeholder="env://LINEAR_API_KEY or vault://kv/linear/api or secretsmanager://linear-key"
              className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="labelName" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">label name</label>
              <input
                id="labelName"
                name="labelName"
                maxLength={64}
                defaultValue={config.linear?.labelName ?? "axiom-finding"}
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] font-mono text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="linearEnabled" className="text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-300 mb-1.5 block">enabled</label>
              <select
                id="linearEnabled"
                name="enabled"
                defaultValue={config.linear?.enabled === false ? "false" : "true"}
                className="w-full rounded border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-[13px] text-zinc-200 focus:outline-none focus:border-emerald-500/40 transition-colors"
              >
                <option value="true">yes</option>
                <option value="false">paused</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
            <button type="submit" form="linear-test-form" className="text-[11px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-full border border-emerald-500/30 text-emerald-200 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/10 transition-colors">
              test :: file ticket →
            </button>
            <button type="submit" className="text-[11px] font-mono uppercase tracking-wider px-4 py-2 rounded-full border border-emerald-500/30 text-emerald-100 hover:text-white hover:border-emerald-500/60 hover:bg-emerald-500/15 transition-colors">
              save →
            </button>
          </div>
        </form>
      </section>

      {/* Action history */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500 mb-3 inline-flex items-center gap-2">
          <span className="text-zinc-700">//</span>
          <span className="text-emerald-300">recent-actions</span>
          <span className="text-zinc-700">::</span>
          <span className="text-zinc-400 tabular-nums">{executions.length}</span>
        </p>
        {executions.length === 0 ? (
          <div className="rounded-md border border-white/[0.06] bg-white/[0.012] px-6 py-10 text-center">
            <p className="text-[13px] text-zinc-400">No actions executed yet.</p>
            <p className="text-[11px] text-zinc-500 mt-1 font-mono">configure an integration above + click test → first execution lands here</p>
          </div>
        ) : (
          <ul className="rounded-md border border-white/[0.06] bg-white/[0.012] divide-y divide-white/[0.04] overflow-hidden">
            {executions.map((ex) => (
              <li key={ex.targetId} className="px-5 py-3.5">
                <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                  <span className={STATUS_TONE[ex.status] ?? "text-zinc-400"}>{ex.status || "unknown"}</span>
                  {ex.upstreamRef && (
                    <>
                      <span className="text-zinc-700">::</span>
                      <span className="text-zinc-400">upstream {ex.upstreamRef}</span>
                    </>
                  )}
                  <span className="text-zinc-500 ml-auto">{ex.updatedAt.toISOString().slice(0, 19).replace("T", " ")}</span>
                </div>
                <p className="text-[13px] text-zinc-100 leading-relaxed font-mono">{ex.title || ex.narrative}</p>
                {ex.externalRef && (
                  <p className="text-[11px] text-zinc-500 mt-1 font-mono break-all">
                    <a href={ex.externalRef} target="_blank" rel="noreferrer" className="text-emerald-300 hover:text-white transition-colors underline underline-offset-2">{ex.externalRef}</a>
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
