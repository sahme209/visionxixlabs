"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

type Budget = { monthlyLimitCents: number; warningThresholdCents: number | null };
type Snapshot = {
  organizationId: string;
  revision: string | null;
  budget: (Budget & { remainingCents: number; warningReached: boolean }) | null;
};

const endpoint = "/api/billing/workspace-ai-budget";
const maxCents = 2_147_483_647;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const money = (cents: number) => currency.format(cents / 100);
const toInput = (cents: number | null | undefined) => cents == null ? "" : (cents / 100).toFixed(2);
const isCents = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= maxCents;

function parseDollars(raw: string): number | undefined {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return undefined;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return isCents(cents) ? cents : undefined;
}

function parseSnapshot(value: unknown, organizationId: string): Snapshot | null {
  if (!value || typeof value !== "object") return null;
  const { ok, data } = value as { ok?: unknown; data?: Snapshot };
  if (ok !== true || !data || data.organizationId !== organizationId) return null;
  if (data.budget === null && data.revision === null) return data;
  const budget = data.budget;
  if (!budget || typeof data.revision !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(data.revision)
    || !isCents(budget.monthlyLimitCents) || !isCents(budget.remainingCents) || budget.remainingCents > budget.monthlyLimitCents
    || (budget.warningThresholdCents !== null && (!isCents(budget.warningThresholdCents)
      || budget.warningThresholdCents === 0 || budget.warningThresholdCents > budget.monthlyLimitCents))
    || typeof budget.warningReached !== "boolean") return null;
  return data;
}

const inputClass = "mt-2 w-full rounded-lg border border-white/12 bg-[#121212] px-3 py-2 text-sm text-zinc-100";
const actionClass = "rounded-lg border border-white/12 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-white/8 disabled:opacity-45";

export function WorkspaceAIUsageBudgetPanel({ organizationId }: { organizationId: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [limit, setLimit] = useState("");
  const [warning, setWarning] = useState("");
  const [busy, setBusy] = useState(true);
  const [confirmRemoval, setConfirmRemoval] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef<AbortController | null>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const limitInput = useRef<HTMLInputElement>(null);
  const reloadButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<"remove" | "limit" | "reload" | null>(null);

  const sync = useCallback(async (update?: { expectedRevision: string | null; budget: Budget | null }) => {
    if (pending.current) return;
    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(endpoint, {
        cache: "no-store", signal: request.signal,
        ...(update && {
          method: "PUT", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ organizationId, ...update }),
        }),
      });
      const loaded = response.ok ? parseSnapshot(await response.json(), organizationId) : null;
      if (pending.current !== request) return;
      if (!loaded) {
        if (update) returnFocus.current = "reload";
        setSnapshot(null);
        if (response.status === 409) setError("Budget settings changed. Reload the saved budget before making another edit.");
        else if (response.status === 401 || response.status === 403) setError("A current workspace owner or admin is required.");
        else setError(update ? "The budget change could not be confirmed. Reload the saved budget before retrying." : "Workspace AI budget is unavailable.");
        return;
      }
      setSnapshot(loaded);
      setLimit(toInput(loaded.budget?.monthlyLimitCents));
      setWarning(toInput(loaded.budget?.warningThresholdCents));
      if (update) {
        if (!update.budget) returnFocus.current = "limit";
        setNotice(update.budget ? "AI budget saved." : "AI budget removed.");
      }
    } catch {
      if (pending.current === request) {
        if (update) returnFocus.current = "reload";
        setSnapshot(null);
        setError(update ? "The budget change could not be confirmed. Reload the saved budget before retrying." : "Workspace AI budget is unavailable.");
      }
    } finally {
      if (pending.current === request) {
        pending.current = null;
        setConfirmRemoval(false);
        setBusy(false);
      }
    }
  }, [organizationId]);

  useEffect(() => {
    setSnapshot(null);
    void sync();
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
  }, [sync]);

  useEffect(() => {
    if (busy) return;
    if (confirmRemoval) confirmButton.current?.focus();
    else if (returnFocus.current === "remove") removeButton.current?.focus();
    else if (returnFocus.current === "limit") (limitInput.current ?? reloadButton.current)?.focus();
    else if (returnFocus.current === "reload") reloadButton.current?.focus();
    returnFocus.current = null;
  }, [busy, confirmRemoval]);

  const current = snapshot?.organizationId === organizationId ? snapshot : null;
  const saved = current?.budget;
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current || busy || confirmRemoval) return;
    const monthlyLimitCents = parseDollars(limit);
    const warningThresholdCents = warning.trim() ? parseDollars(warning) : null;
    if (monthlyLimitCents === undefined || warningThresholdCents === undefined || warningThresholdCents === 0
      || (warningThresholdCents !== null && warningThresholdCents > monthlyLimitCents)) {
      setNotice("");
      setError("Enter a valid monthly limit and an optional warning greater than $0 and no higher than the limit.");
      return;
    }
    void sync({ expectedRevision: current.revision, budget: { monthlyLimitCents, warningThresholdCents } });
  }

  return (
    <section className="mt-6 rounded-2xl border border-white/8 bg-[#171717] p-5 sm:p-7" aria-labelledby="workspace-ai-budget-heading">
      <h2 id="workspace-ai-budget-heading" className="text-lg font-medium text-zinc-100">Workspace AI budget</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">Limit how much AI usage this workspace can reserve each calendar month in UTC. The limit is separate from your prepaid credit balance.</p>
      {current ? <>
        {saved ? (
          <div className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-xl font-medium tabular-nums text-zinc-100">{money(saved.remainingCents)} remaining</p>
            <p className="text-xs text-zinc-400">of {money(saved.monthlyLimitCents)} monthly limit</p>
            {saved.warningReached && <p className="w-full text-sm text-[#d1ad78]">Warning threshold reached.</p>}
          </div>
        ) : <p className="mt-5 text-sm text-zinc-300">No additional monthly AI limit is set.</p>}
        <form className="mt-4" onSubmit={save}>
          <fieldset disabled={busy || confirmRemoval} className="grid gap-4 disabled:opacity-60 sm:grid-cols-2">
            <label className="text-sm text-zinc-300">Monthly limit (USD)
              <input ref={limitInput} className={inputClass} inputMode="decimal" required value={limit} onChange={event => setLimit(event.target.value)} />
            </label>
            <label className="text-sm text-zinc-300">Warning threshold (USD, optional)
              <input className={inputClass} inputMode="decimal" value={warning} onChange={event => setWarning(event.target.value)} />
            </label>
          </fieldset>
          <p className="mt-2 text-xs text-zinc-400">A saved threshold shows an in-app warning to workspace owners and admins when reached.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="submit" disabled={busy || confirmRemoval} className="rounded-lg bg-zinc-100 px-4 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-45">Save budget</button>
            {saved && !confirmRemoval && <button ref={removeButton} type="button" className={actionClass} disabled={busy} onClick={() => setConfirmRemoval(true)}>Remove budget</button>}
          </div>
        </form>
        {confirmRemoval && <div className="mt-4 rounded-lg border border-white/10 p-4">
          <p className="text-sm text-zinc-300">Remove the monthly limit? Available prepaid credits will still limit AI use.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button ref={confirmButton} type="button" className={actionClass} disabled={busy} onClick={() => void sync({ expectedRevision: current.revision, budget: null })}>Confirm removal</button>
            <button type="button" className={actionClass} disabled={busy} onClick={() => { returnFocus.current = "remove"; setConfirmRemoval(false); }}>Cancel</button>
          </div>
        </div>}
      </> : !busy && <button ref={reloadButton} type="button" onClick={() => { returnFocus.current = "limit"; void sync(); }} className={`mt-4 ${actionClass}`}>Reload saved budget</button>}
      {error && <p role="alert" className="mt-3 text-sm text-rose-200">{error}</p>}
      <p role="status" className="mt-3 text-sm text-zinc-300">{busy ? (current ? "Saving AI budget…" : "Loading AI budget…") : notice}</p>
    </section>
  );
}
