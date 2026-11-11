'use client';
import { useEffect, useRef, useState } from 'react';
import type { UsageAnalytics, UsageTotals } from '@/lib/cockpit/usageAnalytics';
const control = 'inline-flex min-h-8 items-center rounded-full border border-white/15 px-3.5 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40';
const usd = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const count = (value: number) => value.toLocaleString();
function validTotals(value: unknown): value is UsageTotals {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return Number.isSafeInteger(Number(row.inputTokens) + Number(row.outputTokens)) && ['calls', 'inputTokens', 'outputTokens', 'settledCents', 'pendingCalls'].every(key => Number.isSafeInteger(row[key]) && (row[key] as number) >= 0) && (row.pendingCalls as number) <= (row.calls as number);
}
export function UsageChart({ month, status, revision }: { month: string; status: string; revision: number }) {
  const dayButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [group, setGroup] = useState('model');
  const [metric, setMetric] = useState<'tokens' | 'debit'>('tokens');
  const [selected, setSelected] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<UsageAnalytics | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ view: 'analytics', group });
    if (month) query.set('month', month);
    if (status) query.set('status', status);
    setBusy(true); setData(null); setError(false); setSelected(null);
    void (async () => {
      try {
        const response = await fetch(`/api/control/usage-records?${query}`, { credentials: 'include', cache: 'no-store', signal: controller.signal });
        const body = await response.json(); const page = body?.data;
        if (!response.ok || body?.ok !== true || !page || !/^\d{4}-(0[1-9]|1[0-2])$/.test(page.month) || page.group !== group || !validTotals(page.totals) || !Array.isArray(page.days) || page.days.length > 31 || !Array.isArray(page.groups) || page.groups.length > 12 || typeof page.groupsLimited !== 'boolean' || page.days.some((day: Record<string, unknown>) => !validTotals(day) || typeof day.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day.day)) || page.groups.some((row: Record<string, unknown>) => !validTotals(row) || row.label !== null && typeof row.label !== 'string')) throw Error('usage_analytics_unverified');
        if (!controller.signal.aborted) setData(page as UsageAnalytics);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [month, status, group, revision, attempt]);
  const value = (day: UsageTotals) => metric === 'tokens' ? day.inputTokens + day.outputTokens : day.settledCents;
  const maximum = data ? Math.max(0, ...data.days.map(value)) : 0;
  const activeDay = selected ?? data?.days.find(day => value(day) > 0)?.day ?? data?.days[0]?.day;
  const inspected = data?.days.find(day => day.day === selected);
  return <section aria-label="Monthly usage analytics" className="mt-5 rounded-xl border border-white/10 bg-[#111111] p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-medium">Activity by day</h3><p className="mt-1 text-xs text-zinc-400">{data?.month || month || 'Current month'} · UTC · full selected month{status ? ` · ${status}` : ''}</p></div><button className={control} disabled={busy} onClick={() => setAttempt(value => value + 1)}>Refresh chart</button></div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div aria-label="Chart measure" className="flex gap-1">{([['tokens', 'Tokens'], ['debit', 'Settled debit']] as const).map(([key, label]) => <button key={key} aria-pressed={metric === key} onClick={() => setMetric(key)} className={`min-h-8 rounded-full px-3 text-xs ${metric === key ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>{label}</button>)}</div><label className="flex items-center gap-2 text-xs text-zinc-400">Group by<select aria-label="Group usage by" value={group} onChange={event => setGroup(event.target.value)} className="min-h-8 rounded-lg border border-white/10 bg-[#171717] px-3 text-xs text-zinc-200"><option value="model">Model</option><option value="provider">Provider</option></select></label></div>
    {busy && <p role="status" className="py-8 text-sm text-zinc-400">Loading usage chart…</p>}
    {error && <p role="alert" className="mt-4 text-sm text-amber-200">Usage chart is unavailable. Refresh to verify activity; the records below are loaded separately.</p>}
    {data && !busy && <><dl className="mt-5 grid grid-cols-3 gap-3"><div><dt className="text-[11px] text-zinc-400">Recorded tokens</dt><dd className="mt-1 text-lg tabular-nums">{count(data.totals.inputTokens + data.totals.outputTokens)}</dd></div><div><dt className="text-[11px] text-zinc-400">Requests</dt><dd className="mt-1 text-lg tabular-nums">{count(data.totals.calls)}</dd>{data.totals.pendingCalls > 0 && <p className="mt-1 text-[11px] text-zinc-400">{count(data.totals.pendingCalls)} awaiting settlement</p>}</div><div><dt className="text-[11px] text-zinc-400">Settled debit</dt><dd className="mt-1 text-lg tabular-nums">{usd(data.totals.settledCents)}</dd></div></dl>

      {data.totals.calls === 0 ? <p className="py-8 text-sm text-zinc-400">No usage matches this selection.</p> : maximum === 0 ? <p className="py-8 text-sm text-zinc-400">{metric === 'debit' ? 'No settled charges recorded for this selection.' : 'No tokens recorded for this selection.'}</p> : <div className="mt-4"><div aria-label={metric === 'tokens' ? 'Daily recorded tokens' : 'Daily settled debit'} className="flex h-32 items-end gap-0.5 border-b border-white/10">{data.days.map((day, index) => <button ref={node => { dayButtons.current[index] = node; }} tabIndex={day.day === activeDay ? 0 : -1} onKeyDown={event => { let next = index; if (event.key === 'ArrowRight') next = (index + 1) % data.days.length; else if (event.key === 'ArrowLeft') next = (index + data.days.length - 1) % data.days.length; else if (event.key === 'Home') next = 0; else if (event.key === 'End') next = data.days.length - 1; else return; event.preventDefault(); setSelected(data.days[next].day); dayButtons.current[next]?.focus(); }} key={day.day} aria-label={`Inspect usage for ${day.day}`} aria-pressed={selected === day.day} title={`${day.day}: ${metric === 'tokens' ? `${count(value(day))} tokens` : usd(value(day))}`} onClick={() => setSelected(day.day)} className="flex h-full min-w-0 flex-1 items-end rounded-xs focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-orange-400"><span aria-hidden className={`block w-full rounded-t-sm ${selected === day.day ? 'bg-orange-400/80' : 'bg-zinc-500/60 hover:bg-zinc-400'}`} style={{ height: `${value(day) / maximum * 100}%` }}/></button>)}</div><div className="mt-2 flex justify-between text-[10px] text-zinc-500"><span>{data.days[0]?.day.slice(5)}</span><span>{data.days[Math.floor(data.days.length / 2)]?.day.slice(5)}</span><span>{data.days.at(-1)?.day.slice(5)}</span></div></div>}
      {inspected && <p role="status" className="mt-4 text-xs leading-5 text-zinc-300">{inspected.day} · {count(inspected.inputTokens + inspected.outputTokens)} tokens · {count(inspected.calls)} requests · {usd(inspected.settledCents)} settled · {count(inspected.pendingCalls)} awaiting settlement</p>}
      <div className="mt-5 border-t border-white/10 pt-4"><h4 className="text-xs font-medium text-zinc-300">{group === 'model' ? 'Models' : 'Providers'} by recorded tokens</h4>{data.groupsLimited && <p className="mt-2 text-[11px] text-zinc-400">Top 12 shown. Daily totals include all groups in this selection.</p>}<div className="mt-2 divide-y divide-white/5">{data.groups.map((row, index) => <div key={`${row.label}:${index}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"><span className="min-w-0 break-all text-zinc-300">{row.label || 'Not recorded'}</span><span className="text-zinc-400">{count(row.inputTokens + row.outputTokens)} tokens · {usd(row.settledCents)} settled{row.pendingCalls > 0 ? ` · ${count(row.pendingCalls)} awaiting settlement` : ''}</span></div>)}</div></div>
    </>}
  </section>;
}
