'use client';
import { useEffect, useState } from 'react';
import { UsageChart } from './UsageChart';
import type { UsageRecordsPage } from '@/lib/cockpit/usageRecords';
const button = 'inline-flex min-h-8 items-center rounded-full border border-white/15 px-3.5 text-xs text-zinc-200 hover:bg-white/5 disabled:opacity-40';
const field = 'min-h-8 rounded-lg border border-white/10 bg-[#171717] px-3 text-[13px] text-zinc-200';
export function UsageRecords() {
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const [offset, setOffset] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<UsageRecordsPage | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const query = new URLSearchParams();
  if (month) query.set('month', month);
  if (status) query.set('status', status);
  if (offset) query.set('offset', String(offset));
  const selection = query.toString();
  const exportQuery = new URLSearchParams(selection);
  if (data) exportQuery.set('month', data.month);
  exportQuery.set('format', 'csv');
  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setData(null); setError(false);
    void (async () => {
      try {
        const response = await fetch(`/api/control/usage-records${selection ? `?${selection}` : ''}`, { credentials: 'include', cache: 'no-store', signal: controller.signal });
        const body = await response.json(); const page = body?.data;
        if (!response.ok || body?.ok !== true || !page || !/^\d{4}-(0[1-9]|1[0-2])$/.test(page.month) || !Number.isSafeInteger(page.offset) || typeof page.hasMore !== 'boolean' || !Array.isArray(page.rows) || page.rows.length > 50 || page.rows.some((row: Record<string, unknown>) => !row || typeof row.id !== 'string' || typeof row.createdAt !== 'string' || typeof row.status !== 'string' || !Number.isSafeInteger(row.inputTokens) || !Number.isSafeInteger(row.outputTokens) || row.settledCents !== null && !Number.isSafeInteger(row.settledCents))) throw Error('usage_unverified');
        if (!controller.signal.aborted) setData(page as UsageRecordsPage);
      } catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setBusy(false); }
    })();
    return () => controller.abort();
  }, [selection, revision]);
  return <section className="mt-6" aria-labelledby="usage-records-heading">
    <h2 id="usage-records-heading" className="text-base font-medium">Usage records</h2>
    <p className="mt-2 text-xs leading-5 text-zinc-400">Workspace AI activity, newest first. Times use UTC. Pending and failed requests do not show a settled debit. Browse the last 12 months, 50 records per page.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-xs text-zinc-400">Month<input type="month" aria-label="Usage month" value={month} onChange={event => { setMonth(event.target.value); setOffset(0); }} className={field}/></label>
      <label className="flex items-center gap-2 text-xs text-zinc-400">Settlement<select aria-label="Usage settlement" value={status} onChange={event => { setStatus(event.target.value); setOffset(0); }} className={field}><option value="">All statuses</option><option value="settled">Settled</option><option value="pending">Pending</option><option value="failed">Failed</option></select></label>
      <button className={button} disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh usage</button>
      {data && !busy && <a className={button} download href={`/api/control/usage-records?${exportQuery}`}>Export this page</a>}
    </div>
    {!month && data && <p className="mt-3 text-xs text-zinc-500">Current month · {data.month}</p>}
    {busy && <p role="status" className="mt-5 text-sm text-zinc-400">Loading usage records…</p>}
    {error && <p role="alert" className="mt-5 rounded-xl border border-amber-400/20 p-4 text-sm text-amber-200">Usage records could not be verified. Check the selected month and refresh.</p>}
    <UsageChart month={month} status={status} revision={revision}/>
    {data && !busy && <>{data.rows.length === 0 ? <p className="mt-5 text-sm text-zinc-400">No usage records match these filters.</p> : <div className="mt-5 overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-xs"><caption className="sr-only">Workspace AI usage records</caption><thead className="text-zinc-400"><tr>{['Date (UTC)', 'Model / provider', 'Status', 'Tokens in / out', 'Settled debit'].map(label => <th key={label} className="px-3 py-3 font-normal">{label}</th>)}</tr></thead><tbody>{data.rows.map(row => <tr key={row.id} className="border-t border-white/10"><td className="whitespace-nowrap px-3 py-4 text-zinc-400">{row.createdAt.slice(0, 16).replace('T', ' ')}</td><td className="max-w-56 wrap-break-word px-3 py-4"><p className="text-zinc-200">{row.model || 'Not recorded'}</p><p className="mt-1 text-zinc-500">{row.provider || 'Not recorded'}</p></td><td className="px-3 py-4 text-zinc-300">{row.status}</td><td className="whitespace-nowrap px-3 py-4 tabular-nums text-zinc-300">{row.inputTokens.toLocaleString()} / {row.outputTokens.toLocaleString()}</td><td className="whitespace-nowrap px-3 py-4 tabular-nums text-zinc-200">{row.settledCents === null ? row.status === 'pending' ? 'Awaiting settlement' : 'Not settled' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(row.settledCents / 100)}</td></tr>)}</tbody></table></div>}
      <div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs text-zinc-500">Page {offset / 50 + 1}{offset === 10000 ? ' · Narrow the month or status to browse further.' : ''}</p><div className="flex gap-2"><button className={button} disabled={busy || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Newer records</button><button className={button} disabled={busy || !data.hasMore} onClick={() => setOffset(value => value + 50)}>Older records</button></div></div>
    </>}
  </section>;
}
