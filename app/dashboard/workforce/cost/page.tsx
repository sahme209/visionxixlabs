/**
 * /dashboard/workforce/cost — Phase 625.
 *
 * Per-engineer cost panel. Shows the last 30 days of AI spend broken
 * down by engineer (engineName), ranked by total cents. Uses the
 * same computeInvocationCost helper the canonical billing path uses.
 *
 * Operators can see "council_engineer cost $X" / "anomaly_engineer
 * cost $Y" and decide whether to disable an over-spending engineer
 * via the workforce home opt-out (Phase 618).
 */

import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, CurrencyDollarIcon } from "@heroicons/react/24/outline";
import { currentContext } from "@/lib/auth/currentContext";
import { buildEngineerCostRollup } from "@/lib/workforce/domains/engineerCostRollup";

export const dynamic = "force-dynamic";

function fmtUsd(cents: number): string {
  if (cents === 0) return "$0.00";
  if (cents < 100) return `$${(cents / 100).toFixed(4)}`;
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n < 1_000) return String(n);
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

const PROVIDER_TONE: Record<string, string> = {
  anthropic: "text-orange-300",
  openai: "text-emerald-300",
  unknown: "text-zinc-400",
};

function engineerDetailHref(engineName: string): string | null {
  // engineName values look like "engineer_domain:foo_engineer". Strip
  // the prefix when present so we land on the canonical detail page.
  if (engineName.startsWith("engineer_domain:")) {
    return `/dashboard/workforce/${engineName.slice("engineer_domain:".length)}`;
  }
  return null;
}

export default async function EngineerCostPage() {
  const ctx = await currentContext();
  if (!ctx.isAuthenticated || !ctx.organizationId) {
    redirect("/auth/signin?callbackUrl=/dashboard/workforce/cost");
  }

  const rollup = await buildEngineerCostRollup(String(ctx.organizationId), 30);

  return (
    <div className="max-w-3xl mx-auto px-1 -mt-2">
      <Link href="/dashboard/workforce" className="inline-flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-white transition-colors mb-6">
        <ArrowLeftIcon className="h-3.5 w-3.5" />
        Workforce
      </Link>
      <header className="mb-10">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">cost · per engineer · 30d</p>
        <h1 className="text-[28px] sm:text-[34px] leading-[1.1] font-semibold text-white tracking-[-0.02em] mb-3 inline-flex items-baseline gap-3">
          <CurrencyDollarIcon className="h-6 w-6 text-emerald-300 shrink-0 self-center" />
          AI workforce cost
        </h1>
        <p className="text-[14px] text-zinc-400 leading-relaxed max-w-xl">
          Last 30 days of AI spend, broken down by engineer. Same pricing helper as the canonical
          billing path — no parallel cost math. Disable an over-spending engineer from its detail
          page if it isn&apos;t earning its keep.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-8">
        <Stat label="Total · 30d" value={fmtUsd(rollup.totalCents)} tone="text-white" />
        <Stat label="Engineers · 30d" value={String(rollup.rows.length)} tone="text-emerald-300" />
        <Stat label="Calls · 30d" value={String(rollup.totalCalls)} tone="text-violet-300" />
      </section>

      {rollup.rows.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-6 py-12 text-center">
          <p className="text-[13px] text-zinc-400">No AI call activity in the last 30 days.</p>
          <p className="text-[11px] text-zinc-500 mt-1">
            Either the workforce hasn&apos;t fired yet or the workspace is on a quiet window.
          </p>
        </div>
      ) : (
        <section>
          <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-3">ranked · highest cost first</p>
          <ul className="rounded-2xl border border-white/[0.06] bg-white/[0.015] divide-y divide-white/[0.04] overflow-hidden">
            {rollup.rows.map((row) => {
              const detailHref = engineerDetailHref(row.engineName);
              const Tag = detailHref ? Link : "div";
              const tagProps = detailHref ? { href: detailHref } : {};
              return (
                <li key={row.engineName}>
                  <Tag {...(tagProps as { href: string })} className={`block px-5 py-3.5 ${detailHref ? "hover:bg-white/[0.015]" : ""} transition-colors`}>
                    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap text-[10px] font-mono uppercase tracking-wider">
                      <span className={PROVIDER_TONE[row.provider] ?? "text-zinc-400"}>{row.provider}</span>
                      <span className="text-zinc-500">·</span>
                      <span className="text-zinc-400">{row.callCount} call{row.callCount === 1 ? "" : "s"}</span>
                      {row.errorCount > 0 && (
                        <>
                          <span className="text-zinc-500">·</span>
                          <span className="text-rose-300">{row.errorCount} error{row.errorCount === 1 ? "" : "s"}</span>
                        </>
                      )}
                      <span className="text-emerald-300 ml-auto font-semibold">{fmtUsd(row.totalCents)}</span>
                    </div>
                    <p className="text-[13.5px] font-medium text-white">{row.engineName}</p>
                    <p className="text-[11.5px] text-zinc-500 leading-relaxed mt-1">
                      {fmtTokens(row.totalInputTokens)} in · {fmtTokens(row.totalOutputTokens)} out
                      {row.models.length > 0 && (
                        <> · <span className="font-mono text-zinc-400">{row.models.join(", ")}</span></>
                      )}
                    </p>
                  </Tag>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5">
        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-2">how cost is computed</p>
        <p className="text-[12.5px] text-zinc-300 leading-relaxed">
          Reads <span className="font-mono text-zinc-400">AiCallLog</span> rows in the window, infers provider from the
          recorded model id (<span className="font-mono text-orange-300">claude-*</span> → anthropic,
          <span className="font-mono text-emerald-300"> gpt-*/o1/o3/o4</span> → openai), and prices each (provider, model)
          token total through the same <span className="font-mono text-zinc-400">computeInvocationCost</span> helper the canonical billing
          cron uses. Costs are pre-margin — your operator margin multiplier applies on top.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-3">
      <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1">{label}</p>
      <p className={`text-[22px] font-semibold tracking-tight ${tone}`}>{value}</p>
    </div>
  );
}
