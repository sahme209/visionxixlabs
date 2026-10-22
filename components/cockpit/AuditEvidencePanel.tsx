"use client";

import { useMemo, useState } from "react";

export type AuditEvidenceRecord = {
  id: string;
  action: string;
  outcome: string;
  actorKind: string;
  actorUserId: string | null;
  entityRef: string | null;
  correlationId: string;
  source: string;
  occurredAt: string;
  errorCode: string | null;
};
const PAGE_SIZE = 20;
const tones: Record<string, string> = { success: "text-emerald-300", failure: "text-rose-300", blocked: "text-amber-300" };
function timestamp(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date) : "Time unavailable";
}

export function AuditEvidencePanel({ records }: { records: AuditEvidenceRecord[] }) {
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState("all");
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const search = query.trim().toLowerCase();
    return records.filter(record => (outcome === "all" || record.outcome === outcome)
      && (!search || [record.action, record.correlationId, record.entityRef, record.actorUserId, record.actorKind, record.errorCode, record.source].some(value => value?.toLowerCase().includes(search))));
  }, [records, query, outcome]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const buttonClass = "h-8 rounded-lg border border-white/10 px-3 text-xs text-zinc-300 hover:bg-white/5 disabled:opacity-40";

  return <section className="mt-6 rounded-xl border border-white/[0.08] bg-white/[0.015] p-5" aria-labelledby="audit-events-heading">
    <h2 id="audit-events-heading" className="text-sm font-medium text-zinc-100">Recent audit evidence</h2>
    <p className="mt-2 text-xs leading-5 text-zinc-500">Latest 100 workspace records. Filters apply to these loaded records. Times shown in UTC.</p>
    <div className="mt-4 flex flex-wrap items-end gap-3">
      <label className="min-w-0 grow text-xs text-zinc-400">Search loaded audit records
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Action, actor, reference, or correlation ID" className="mt-1.5 block h-9 w-full rounded-lg border border-white/10 bg-[#171717] px-3 text-xs text-zinc-200 placeholder:text-zinc-600" />
      </label>
      <label className="text-xs text-zinc-400">Audit outcome
        <select value={outcome} onChange={event => { setOutcome(event.target.value); setPage(0); }} className="mt-1.5 block h-9 rounded-lg border border-white/10 bg-[#171717] px-3 text-xs text-zinc-200">
          <option value="all">All outcomes</option><option value="success">Success</option><option value="failure">Failure</option><option value="blocked">Blocked</option>
        </select>
      </label>
      <button type="button" disabled={!query && outcome === "all"} onClick={() => { setQuery(""); setOutcome("all"); setPage(0); }} className={buttonClass}>Clear audit filters</button>
    </div>
    {records.length === 0 ? <p className="mt-5 text-sm text-zinc-500">No audit records have been written for this organization.</p> : filtered.length === 0 ? <p className="mt-5 text-sm text-zinc-500">No matching audit records.</p> : <ul className="mt-4 divide-y divide-white/[0.06] border-y border-white/[0.06]">
      {visible.map(record => <li key={record.id} className="py-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span className={Object.prototype.hasOwnProperty.call(tones, record.outcome) ? tones[record.outcome] : "text-zinc-400"}>{record.outcome}</span>
            <span className="break-all text-zinc-200">{record.action}</span>
            {record.errorCode && <span className="break-all text-rose-300">{record.errorCode}</span>}
          </div>
          <time dateTime={record.occurredAt} className="text-[11px] text-zinc-500">{timestamp(record.occurredAt)}</time>
        </div>
        <details className="mt-2 text-xs text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">Evidence details</summary>
          <dl className="mt-2 grid gap-2 rounded-lg bg-white/[0.025] p-3 sm:grid-cols-[105px_minmax(0,1fr)]">
            <dt>Reference</dt><dd className="break-all text-zinc-300">{record.entityRef ?? "Organization"}</dd>
            <dt>Correlation ID</dt><dd className="break-all font-mono text-[11px] text-zinc-300">{record.correlationId}</dd>
            <dt>Actor</dt><dd className="break-all text-zinc-300">{record.actorKind}{record.actorUserId ? ` · ${record.actorUserId}` : ""}</dd>
            <dt>Source</dt><dd className="break-all text-zinc-300">{record.source}</dd>
          </dl>
        </details>
      </li>)}
    </ul>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="text-xs tabular-nums text-zinc-500">{filtered.length ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)}` : "0"} of {filtered.length} matching records · {records.length} loaded</p>
      <div className="flex gap-2">
        <button type="button" aria-label="Previous audit page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className={buttonClass}>Previous</button>
        <button type="button" aria-label="Next audit page" disabled={currentPage + 1 >= pages} onClick={() => setPage(currentPage + 1)} className={buttonClass}>Next</button>
      </div>
    </div>
  </section>;
}
