import Link from "next/link";
import type { BusinessOverview as Overview } from "@/lib/founder/founderBusiness";
import { roadmapCandidates } from "@/lib/founder/business";
import { AutoRefresh } from "./AutoRefresh";
import { ARR_GOAL_CENTS, REVENUE_MULTIPLE, formatMonths, growthPlan } from "@/lib/founder/growth";

const usd = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents < 10_000 ? 2 : 0 }).format(cents / 100);
const num = (n: number) => n.toLocaleString("en-US");

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | null }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-medium tabular-nums tracking-tight text-zinc-50">{value}</p>
      {sub && <p className={`mt-0.5 text-xs ${tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-zinc-500"}`}>{sub}</p>}
    </div>
  );
}

/** One-series bar chart: bars grow from the baseline, each with a hover title and a table view for assistive tech. */
function Bars({ label, data, format }: { label: string; data: Array<{ key: string; value: number }>; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((t, d) => t + d.value, 0);
  if (total === 0) return <p className="mt-3 rounded-lg border border-dashed border-white/10 px-3 py-6 text-center text-xs text-zinc-500">{label}: nothing recorded yet.</p>;
  return (
    <figure className="mt-3">
      <div role="img" aria-label={`${label}: ${format(total)} in total`} className="flex h-28 items-end gap-[2px] border-b border-white/10">
        {data.map((d) => <div key={d.key} title={`${d.key}: ${format(d.value)}`} className="group relative flex h-full flex-1 items-end"><div className="w-full rounded-t-[3px] bg-sky-400/80 transition group-hover:bg-sky-300" style={{ height: `${Math.max(d.value > 0 ? 3 : 0, (d.value / max) * 100)}%` }} /></div>)}
      </div>
      <figcaption className="mt-1 flex justify-between text-[11px] text-zinc-500"><span>{data[0]?.key}</span><span>{data[data.length - 1]?.key}</span></figcaption>
      <table className="sr-only"><caption>{label}</caption><tbody>{data.map((d) => <tr key={d.key}><th scope="row">{d.key}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </figure>
  );
}

function Section({ id, title, intro, children, unavailable }: { id: string; title: string; intro: string; children: React.ReactNode; unavailable: boolean }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-white/8 bg-[#0f0f0f] p-5">
      <h2 id={id} className="text-base font-medium text-zinc-50">{title}</h2>
      <p className="mt-0.5 text-xs text-zinc-500">{intro}</p>
      {unavailable ? <p role="status" className="mt-4 text-sm text-amber-300">These records could not be read right now. Nothing is shown rather than an estimate.</p> : children}
    </section>
  );
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: Array<Array<string | number>> }) {
  if (!rows.length) return <p className="mt-3 text-sm text-zinc-500">Nothing recorded yet.</p>;
  return (
    <table className="mt-3 w-full text-left text-xs">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-zinc-500"><tr>{head.map((h, i) => <th key={h} scope="col" className={`pb-1.5 font-normal ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
      <tbody className="divide-y divide-white/[0.06]">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => j === 0 ? <th key={j} scope="row" className="py-1.5 pr-3 font-normal text-zinc-200">{c}</th> : <td key={j} className="py-1.5 text-right tabular-nums text-zinc-300">{c}</td>)}</tr>)}</tbody>
    </table>
  );
}

/** The founder's back office: how the business is doing right now, across every workspace. */
export function BusinessOverview({ data, autopilot }: { data: Overview; autopilot: { paused: boolean; runs: Array<{ version: number; summary: string; createdAt: string }> } | null }) {
  const { revenue: r, customers: c, ai, product: p, support: s } = data;
  const roadmap = roadmapCandidates({ topUnanswered: s?.topUnanswered ?? [], negativeByPage: p?.negativeByPage ?? [], atRisk: c?.atRisk ?? [] });
  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="text-2xl font-semibold tracking-tight">Company today</h1><p className="mt-1 text-sm text-zinc-400">Revenue, customers, agents, product and support across every workspace. Only you can see this.</p></div>
        <AutoRefresh generatedAt={data.generatedAt} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Revenue, last 30 days" value={r ? usd(r.last30Cents) : "Unavailable"} sub={r ? (r.changePct === null ? "No revenue in the 30 days before" : `${r.changePct >= 0 ? "+" : ""}${r.changePct}% on the 30 days before`) : undefined} tone={r?.changePct == null ? null : r.changePct >= 0 ? "good" : "bad"} />
        <Kpi label="Recurring, from active plans" value={r ? `${usd(r.mrrListCents)}/mo` : "Unavailable"} sub={r ? `${r.paidWorkspaces} paying workspace${r.paidWorkspaces === 1 ? "" : "s"}, at list price` : undefined} />
        <Kpi label="Workspaces" value={c ? num(c.workspaces) : "Unavailable"} sub={c ? `+${c.new30} in 30 days · ${c.funnel.steps[3]?.count ?? 0} active this week` : undefined} />
        <Kpi label="AI margin, 30 days" value={ai ? (ai.marginPct === null ? "No AI billed" : `${ai.marginPct}%`) : "Unavailable"} sub={ai ? `${usd(ai.billedCents)} billed · ${usd(ai.costCents)} cost · ${num(ai.calls30)} calls` : undefined} tone={ai?.marginPct == null ? null : ai.marginPct >= 0 ? "good" : "bad"} />
      </div>

      {r && <GrowthPath plan={growthPlan({ mrrListCents: r.mrrListCents, last30Cents: r.last30Cents, previous30Cents: r.previous30Cents, paidWorkspaces: r.paidWorkspaces, activeWorkspaces: c?.funnel.steps[3]?.count ?? 0, aiCostCents: ai?.costCents ?? 0, aiBilledCents: ai?.billedCents ?? 0 })} />}

      <section aria-labelledby="agents-heading" className="rounded-2xl border border-sky-400/20 bg-sky-400/[0.04] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 id="agents-heading" className="text-base font-medium text-zinc-50">Agents running the company</h2><Link href="/founder/blueprint" className="text-xs text-zinc-300 underline underline-offset-4">Open the operations map</Link></div>
        <p className="mt-0.5 text-xs text-zinc-400">{autopilot === null ? "The autopilot state could not be read." : autopilot.paused ? "The autopilot is paused. Resume it on the operations map." : "The autopilot runs every hour on its own. Steps that spend money or contact people outside the company wait for you."}</p>
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div>
            <h3 className="text-xs font-medium text-zinc-300">What the agents propose next</h3>
            {roadmap.length === 0 ? <p className="mt-2 text-sm text-zinc-400">Nothing to propose from the last 30 days of questions, feedback and accounts.</p> : (
              <ol className="mt-2 space-y-1.5">{roadmap.map((x, i) => <li key={i} className="rounded-lg border border-white/8 bg-black/20 px-3 py-2 text-xs"><span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] ${x.kind === "follow_up" ? "bg-amber-300/15 text-amber-100" : x.kind === "fix_page" ? "bg-rose-400/15 text-rose-100" : "bg-sky-400/15 text-sky-100"}`}>{x.kind === "doc_gap" ? "Answer gap" : x.kind === "fix_page" ? "Fix" : "Follow up"}</span><span className="text-zinc-100">{x.title}</span><span className="block pt-0.5 text-zinc-400">{x.reason}</span></li>)}</ol>)}
          </div>
          <div>
            <h3 className="text-xs font-medium text-zinc-300">What the autopilot did</h3>
            {!autopilot || autopilot.runs.length === 0 ? <p className="mt-2 text-sm text-zinc-400">No changes yet.</p> : <ol className="mt-2 space-y-1 text-xs">{autopilot.runs.slice(0, 6).map((x) => <li key={x.version} className="flex justify-between gap-3"><span className="text-zinc-300">{x.summary}</span><time dateTime={x.createdAt} className="shrink-0 text-zinc-500">{new Date(x.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></li>)}</ol>}
            {ai && ai.pendingAgentRequests > 0 && <p className="mt-3 text-xs text-amber-200">{ai.pendingAgentRequests} customer agent request{ai.pendingAgentRequests === 1 ? " is" : "s are"} waiting for approval in their workspaces.</p>}
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section id="revenue-heading" title="Revenue" intro="Money collected: AI credits and add-ons, usage billing and founding supporters, net of refunds." unavailable={r === null}>
          {r && <>
            <p className="mt-3 text-sm text-zinc-300">This month so far: <span className="tabular-nums text-zinc-50">{usd(r.monthToDateCents)}</span></p>
            <Bars label="Revenue per day, last 30 days" data={r.daily.map((d) => ({ key: d.day.slice(5), value: d.value }))} format={usd} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Table caption="Revenue by source, last 30 days" head={["Source", "30 days"]} rows={r.bySource.map((x) => [x.source, usd(x.cents)])} />
              <Table caption="Top workspaces by revenue, last 30 days" head={["Workspace", "30 days"]} rows={r.topWorkspaces.map((x) => [x.label, usd(x.cents)])} />
            </div>
          </>}
        </Section>

        <Section id="customers-heading" title="Customers" intro="Signups, how far new workspaces get, and paying workspaces that need attention." unavailable={c === null}>
          {c && <>
            <Bars label="Signups per week, last 12 weeks" data={c.signupsWeekly.map((w) => ({ key: w.week.slice(5), value: w.count }))} format={num} />
            <h3 className="mt-4 text-xs font-medium text-zinc-300">Activation</h3>
            <ol className="mt-2 space-y-1.5">{c.funnel.steps.map((st) => <li key={st.label} className="text-xs"><div className="flex justify-between text-zinc-300"><span>{st.label}</span><span className="tabular-nums">{num(st.count)}{st.pct !== null ? ` · ${st.pct}%` : ""}</span></div><div className="mt-0.5 h-1.5 rounded-full bg-white/5"><div className="h-1.5 rounded-full bg-sky-400/70" style={{ width: `${st.pct ?? 0}%` }} /></div></li>)}</ol>
            <h3 className="mt-4 text-xs font-medium text-zinc-300">At risk</h3>
            {c.atRisk.length === 0 ? <p className="mt-1 text-sm text-zinc-500">No paying workspace looks at risk.</p> : <ul className="mt-1 space-y-1 text-xs">{c.atRisk.map((a, i) => <li key={i} className="flex justify-between gap-3"><span className="text-zinc-200">{a.label}</span><span className="text-amber-200">{a.reason}</span></li>)}</ul>}
          </>}
        </Section>

        <Section id="ai-heading" title="Agents and AI" intro="Which models and agent tasks customers use, and what each costs against what it bills." unavailable={ai === null}>
          {ai && <>
            <Table caption="AI usage by model, last 30 days" head={["Model", "Calls", "Cost", "Billed", "Margin"]} rows={ai.byModel.map((m) => [m.model, num(m.calls), usd(m.costCents), usd(m.billedCents), m.marginPct === null ? "—" : `${m.marginPct}%`])} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Table caption="AI usage by kind, last 30 days" head={["Kind", "Calls"]} rows={ai.byKind.map((k) => [k.kind.replaceAll("_", " "), num(k.calls)])} />
              <Table caption="Most active workspaces by AI calls" head={["Workspace", "Calls", "Billed"]} rows={ai.topWorkspaces.map((w) => [w.label, num(w.calls), usd(w.billedCents)])} />
            </div>
          </>}
        </Section>

        <Section id="product-heading" title="Product feedback" intro="What customers told you in the product over the last 30 days." unavailable={p === null}>
          {p && <>
            <p className="mt-3 text-sm text-zinc-300"><span className="tabular-nums text-zinc-50">{num(p.feedback30)}</span> reports · {p.bySentiment.map((x) => `${num(x.count)} ${x.sentiment}`).join(" · ") || "none yet"}</p>
            <Table caption="Pages with the most feedback" head={["Page", "Reports"]} rows={p.topPages.map((x) => [x.page, num(x.count)])} />
            <h3 className="mt-4 text-xs font-medium text-zinc-300">Latest</h3>
            {p.latest.length === 0 ? <p className="mt-1 text-sm text-zinc-500">No feedback yet.</p> : <ul className="mt-1 space-y-1.5 text-xs">{p.latest.map((x, i) => <li key={i}><span className={x.sentiment === "negative" ? "text-rose-300" : x.sentiment === "positive" ? "text-emerald-300" : "text-zinc-400"}>{x.sentiment}</span> <span className="text-zinc-500">{x.page ?? ""}</span><span className="block text-zinc-300">{x.excerpt}</span></li>)}</ul>}
          </>}
        </Section>

        <Section id="support-heading" title="Support" intro="Questions Ask V19 could not answer, and contact requests, over the last 30 days." unavailable={s === null}>
          {s && <>
            <p className="mt-3 text-sm text-zinc-300"><span className="tabular-nums text-zinc-50">{num(s.unanswered30)}</span> unanswered questions · <span className="tabular-nums text-zinc-50">{num(s.leads30)}</span> contact requests</p>
            <Bars label="Unanswered questions per day, last 30 days" data={s.unansweredDaily.map((d) => ({ key: d.day.slice(5), value: d.value }))} format={num} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Table caption="Most asked unanswered questions" head={["Question", "Times"]} rows={s.topUnanswered.map((q) => [q.example, num(q.count)])} />
              <Table caption="Contact requests by source" head={["Source", "Requests"]} rows={s.leadsBySource.map((l) => [l.source.replaceAll("_", " "), num(l.count)])} />
            </div>
          </>}
        </Section>
      </div>
      <p className="text-[11px] text-zinc-500">Workspaces are shown by the end of their id, without names or emails. Recurring revenue uses list prices from active plans; collected revenue comes from payment and billing records.</p>
    </div>
  );
}

function GrowthPath({ plan }: { plan: ReturnType<typeof growthPlan> }) {
  const pct = (f: number | null, digits = 1) => (f === null ? "—" : `${(f * 100).toFixed(digits)}%`);
  return (
    <section aria-labelledby="growth-heading" className="rounded-2xl border border-white/8 bg-[#0f0f0f] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="growth-heading" className="text-base font-medium text-zinc-50">Path to a $2B company</h2>
        <p className="text-xs text-zinc-500">Goal: {usd(ARR_GOAL_CENTS)} a year in revenue, about $2B at {REVENUE_MULTIPLE}× revenue</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/5" role="img" aria-label={`${plan.progressPct.toFixed(3)}% of the way to the annual revenue goal`}><div className="h-2 rounded-full bg-sky-400" style={{ width: `${Math.max(plan.progressPct, plan.arrCents > 0 ? 0.5 : 0)}%` }} /></div>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-xs text-zinc-400">Annual run-rate now</dt><dd className="mt-0.5 text-xl tabular-nums text-zinc-50">{usd(plan.arrCents)}</dd><dd className="text-[11px] text-zinc-500">Recurring plans plus the last 30 days collected, ×12</dd></div>
        <div><dt className="text-xs text-zinc-400">Growth, month on month</dt><dd className={`mt-0.5 text-xl tabular-nums ${plan.monthlyGrowth === null ? "text-zinc-400" : plan.monthlyGrowth >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{plan.monthlyGrowth === null ? "Not enough history" : pct(plan.monthlyGrowth)}</dd></div>
        <div><dt className="text-xs text-zinc-400">Needed to reach the goal in 5 years</dt><dd className="mt-0.5 text-xl tabular-nums text-zinc-50">{plan.neededMonthlyGrowth5y === null ? "First revenue needed" : `${pct(plan.neededMonthlyGrowth5y)} a month`}</dd></div>
        <div><dt className="text-xs text-zinc-400">Unit economics</dt><dd className="mt-0.5 text-sm tabular-nums text-zinc-200">{plan.arpaMonthlyCents === null ? "No paying workspaces yet" : `${usd(plan.arpaMonthlyCents)} a month per paying workspace`}</dd><dd className="text-[11px] text-zinc-500">{plan.aiCostPerActiveWorkspaceCents === null ? "" : `AI cost ${usd(plan.aiCostPerActiveWorkspaceCents)} per active workspace`}{plan.aiGrossMarginPct === null ? "" : ` · AI margin ${plan.aiGrossMarginPct}%`}</dd></div>
      </dl>
      <h3 className="mt-4 text-xs font-medium text-zinc-300">Milestones at the current pace</h3>
      <ol className="mt-2 grid gap-2 sm:grid-cols-4">{plan.milestones.map((m) => <li key={m.arrCents} className={`rounded-lg border px-3 py-2 text-xs ${m.reached ? "border-emerald-400/30 bg-emerald-400/5" : "border-white/8"}`}><p className="tabular-nums text-zinc-100">{usd(m.arrCents)} a year</p><p className={m.reached ? "text-emerald-300" : "text-zinc-400"}>{formatMonths(m.monthsAtCurrentGrowth)}</p></li>)}</ol>
      <p className="mt-3 text-[11px] text-zinc-500">A projection from the last two months of recorded revenue, not a forecast. It changes as revenue comes in.</p>
    </section>
  );
}
