"use client";
import { useCallback, useEffect, useState } from "react";
import { CHECK_KINDS, CHECK_STAGES, KIND_LABEL, STAGE_LABEL, type CheckKind, type CheckStage } from "@/lib/releaseops/deploymentChecks";

interface Check { key: string; name: string; kind: CheckKind; stage: CheckStage; mode: "blocking" | "advisory"; spec: Record<string, unknown>; enabled: boolean; version: number }
interface LatestResult { status: string; checkVersion: number; runUrl: string | null; reportedAt: string }
interface Board { canEdit: boolean; latestResults?: Record<string, LatestResult> | null; checks: Check[]; coverage: { stages: Array<{ stage: CheckStage; blocking: number; advisory: number }>; uncovered: CheckStage[] } }
interface Draft { key: string; name: string; kind: CheckKind; stage: CheckStage; mode: "blocking" | "advisory"; fields: Record<string, string>; enabled: boolean; expectedVersion?: number }

const FIELDS: Record<CheckKind, Array<{ name: string; label: string; placeholder: string; numeric?: boolean; multiline?: boolean; options?: string[] }>> = {
  smoke_test: [{ name: "url", label: "URL", placeholder: "https://app.example.com/health" }, { name: "expectStatus", label: "Expected status", placeholder: "200", numeric: true }, { name: "maxLatencyMs", label: "Max latency (ms)", placeholder: "500", numeric: true }],
  health_check: [{ name: "metric", label: "Metric", placeholder: "http.5xx_rate" }, { name: "comparison", label: "Passes when value is", placeholder: "below", options: ["below", "above"] }, { name: "threshold", label: "Threshold", placeholder: "0.01", numeric: true }, { name: "windowMinutes", label: "Window (minutes)", placeholder: "10", numeric: true }],
  migration_dry_run: [{ name: "workflowPath", label: "Workflow file", placeholder: ".github/workflows/migrate.yml" }, { name: "job", label: "Job", placeholder: "dry-run" }],
  custom_script: [{ name: "scriptPath", label: "Script path in the repository", placeholder: "scripts/smoke.sh" }, { name: "runner", label: "Runs on", placeholder: "github_actions", options: ["github_actions", "customer_runner"] }],
  manual_checklist: [{ name: "items", label: "Items (one per line)", placeholder: "Status page updated\nOn-call notified", multiline: true }],
  security_scan: [{ name: "tool", label: "Scanner", placeholder: "Snyk, Trivy, CodeQL…" }, { name: "maxCritical", label: "Max critical findings", placeholder: "0", numeric: true }, { name: "maxHigh", label: "Max high findings", placeholder: "0", numeric: true }],
};
const EMPTY: Draft = { key: "", name: "", kind: "smoke_test", stage: "verify", mode: "blocking", fields: {}, enabled: true };
const ERRORS: Record<string, string> = {
  workspace_admin_required: "Only workspace owners and admins can change checks.",
  check_exists: "A check with this key already exists. Edit it instead.",
  check_changed: "Someone changed or removed this check after you loaded it. The list has been reloaded.",
  check_limit_reached: "This workspace has reached its check limit.",
};

function specFrom(d: Draft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[d.kind]) {
    const raw = d.fields[f.name] ?? "";
    out[f.name] = f.multiline ? raw.split("\n").map((s) => s.trim()).filter(Boolean) : f.numeric ? Number(raw) : raw.trim();
  }
  return out;
}
function fieldsFrom(c: Check): Record<string, string> {
  return Object.fromEntries(FIELDS[c.kind].map((f) => [f.name, Array.isArray(c.spec[f.name]) ? (c.spec[f.name] as string[]).join("\n") : String(c.spec[f.name] ?? "")]));
}
function summary(c: Check): string {
  const s = c.spec;
  switch (c.kind) {
    case "smoke_test": return `${s.url} → ${s.expectStatus} within ${s.maxLatencyMs} ms`;
    case "health_check": return `${s.metric} ${s.comparison} ${s.threshold} over ${s.windowMinutes} min`;
    case "migration_dry_run": return `${s.workflowPath} · job ${s.job}`;
    case "custom_script": return `${s.scriptPath} on ${s.runner === "github_actions" ? "GitHub Actions" : "your runner"}`;
    case "manual_checklist": return `${(s.items as string[]).length} items`;
    case "security_scan": return `${s.tool} · at most ${s.maxCritical} critical, ${s.maxHigh} high`;
  }
}

export function ChecksBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [messages, setMessages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try { const res = await fetch("/api/control/checks", { cache: "no-store" }); const body = await res.json(); if (!res.ok || !body.ok) throw new Error(); setBoard(body.data); setLoadError(false); }
    catch { setLoadError(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function send(method: "POST" | "DELETE", payload: unknown) {
    setBusy(true); setMessages([]);
    try {
      const res = await fetch("/api/control/checks", { method, body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string; issues?: string[] } | null;
      if (res.ok && body?.ok) { setDraft(EMPTY); await load(); return; }
      setMessages(body?.issues?.length ? body.issues : [ERRORS[body?.error ?? ""] ?? "The change could not be saved. Try again."]);
      if (body?.error === "check_changed") await load();
    } catch { setMessages(["The change could not be reached. Try again."]); }
    finally { setBusy(false); }
  }

  if (loadError) return <p role="alert" className="mt-8 text-sm text-amber-300">Checks could not be loaded. Refresh to try again.</p>;
  if (!board) return <p className="mt-8 text-sm text-zinc-400">Loading checks…</p>;
  const editing = draft.expectedVersion !== undefined;
  const input = "mt-1 block w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-zinc-100";

  return (
    <div className="mt-8 space-y-8">
      <ol aria-label="Checks per release stage" className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {board.coverage.stages.map((s) => (
          <li key={s.stage} className="rounded-xl border border-white/8 bg-[#111111] p-4">
            <p className="text-xs text-zinc-400">{STAGE_LABEL[s.stage]}</p>
            <p className="mt-2 text-sm text-zinc-100">{s.blocking + s.advisory === 0 ? "No checks" : `${s.blocking} blocking · ${s.advisory} advisory`}</p>
          </li>))}
      </ol>
      {board.coverage.uncovered.includes("verify") && <p className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">Nothing is checked at Verify, so a release can be marked complete without any recorded proof that it works.</p>}

      {board.checks.length === 0 ? <p className="text-sm text-zinc-400">No checks yet.{board.canEdit ? " Add one below." : ""}</p> : (
        <ul className="divide-y divide-white/[0.07] rounded-xl border border-white/8">
          {board.checks.map((c) => (
            <li key={c.key} className="flex flex-wrap items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-100">{c.name} <span className="font-mono text-xs text-zinc-400">{c.key} · v{c.version}</span></p>
                <p className="mt-1 text-xs text-zinc-400">{STAGE_LABEL[c.stage]} · {KIND_LABEL[c.kind]} · {c.mode}{c.enabled ? "" : " · disabled"}</p>
                <p className="mt-1 break-all font-mono text-xs text-zinc-300">{summary(c)}</p>
                <LatestResultLine check={c} latest={board.latestResults === null ? "unavailable" : board.latestResults?.[c.key]} />
                {c.kind === "manual_checklist" && c.enabled && <ConfirmChecklist check={c} onRecorded={() => void load()} />}
              </div>
              {board.canEdit && <div className="flex gap-3 text-xs">
                <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" aria-label={`Edit ${c.name}`} onClick={() => setDraft({ key: c.key, name: c.name, kind: c.kind, stage: c.stage, mode: c.mode, fields: fieldsFrom(c), enabled: c.enabled, expectedVersion: c.version })}>Edit</button>
                <button type="button" className="text-zinc-300 underline-offset-2 hover:underline" aria-label={`Remove ${c.name}`} disabled={busy} onClick={() => void send("DELETE", { key: c.key, expectedVersion: c.version })}>Remove</button>
              </div>}
            </li>))}
        </ul>)}

      {board.canEdit ? (
        <form className="rounded-xl border border-white/8 bg-[#111111] p-5" onSubmit={(e) => { e.preventDefault(); void send("POST", { check: { key: draft.key.trim(), name: draft.name.trim(), kind: draft.kind, stage: draft.stage, mode: draft.mode, spec: specFrom(draft) }, enabled: draft.enabled, ...(editing ? { expectedVersion: draft.expectedVersion } : {}) }); }}>
          <h2 className="text-base font-medium">{editing ? `Edit ${draft.name}` : "Add a check"}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">Name<input required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={input} /></label>
            <label className="text-xs text-zinc-400">Key<input required value={draft.key} readOnly={editing} onChange={(e) => setDraft({ ...draft, key: e.target.value.toLowerCase() })} placeholder="health-probe" className={`${input} font-mono`} /></label>
            <label className="text-xs text-zinc-400">Kind<select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as CheckKind, fields: {} })} className={input}>{CHECK_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
            <label className="text-xs text-zinc-400">Stage<select value={draft.stage} onChange={(e) => setDraft({ ...draft, stage: e.target.value as CheckStage })} className={input}>{CHECK_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
            <label className="text-xs text-zinc-400">Mode<select value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value as Draft["mode"] })} className={input}><option value="blocking">Blocking</option><option value="advisory">Advisory</option></select></label>
            <label className="flex items-center gap-2 self-end pb-2 text-xs text-zinc-300"><input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} />Enabled</label>
            {FIELDS[draft.kind].map((f) => (
              <label key={f.name} className={`text-xs text-zinc-400 ${f.multiline ? "sm:col-span-2" : ""}`}>{f.label}
                {f.options ? <select value={draft.fields[f.name] ?? f.options[0]} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, [f.name]: e.target.value } })} className={input}>{f.options.map((o) => <option key={o} value={o}>{o.replaceAll("_", " ")}</option>)}</select>
                  : f.multiline ? <textarea rows={4} value={draft.fields[f.name] ?? ""} placeholder={f.placeholder} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, [f.name]: e.target.value } })} className={input} />
                  : <input value={draft.fields[f.name] ?? ""} placeholder={f.placeholder} inputMode={f.numeric ? "decimal" : undefined} onChange={(e) => setDraft({ ...draft, fields: { ...draft.fields, [f.name]: e.target.value } })} className={`${input} font-mono`} />}
              </label>))}
          </div>
          <div className="mt-4 flex gap-3">
            <button type="submit" disabled={busy} className="inline-flex min-h-9 items-center rounded-lg bg-zinc-100 px-3 text-sm font-medium text-zinc-950 disabled:opacity-50">{busy ? "Saving…" : editing ? "Save change" : "Add check"}</button>
            {editing && <button type="button" onClick={() => { setDraft(EMPTY); setMessages([]); }} className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-sm text-zinc-200">Cancel</button>}
          </div>
          <div aria-live="polite">{messages.length > 0 && <ul className="mt-3 list-disc pl-5 text-sm text-amber-300">{messages.map((m) => <li key={m}>{m}</li>)}</ul>}</div>
        </form>
      ) : <p className="text-sm text-zinc-400">Only workspace owners and admins can change checks.</p>}
      {board.checks.length > 0 && <WorkflowPreview revision={board.checks.map((c) => `${c.key}@${c.version}:${c.enabled}`).join(",")} />}
      <p className="text-xs leading-5 text-zinc-400">Checks are recorded configuration in this step. The CI workflow below is generated for you to review and merge in your repository; collecting results and enforcing blocking checks at stage transitions come next. Nothing on this page runs a check or changes a release.</p>
    </div>);
}

function WorkflowPreview({ revision }: { revision: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<{ kind: "idle" | "loading" | "error" } | { kind: "ready"; yaml: string; path: string; skipped: Array<{ key: string; reason: string }> }>({ kind: "idle" });
  const [copied, setCopied] = useState(false);
  useEffect(() => { setState({ kind: "idle" }); }, [revision]);
  useEffect(() => {
    if (!open || state.kind !== "idle") return;
    setState({ kind: "loading" });
    fetch("/api/control/checks/workflow", { cache: "no-store" }).then((r) => r.json()).then((b) => b?.ok ? setState({ kind: "ready", yaml: b.data.yaml, path: b.data.path, skipped: b.data.skipped }) : setState({ kind: "error" })).catch(() => setState({ kind: "error" }));
  }, [open, state.kind]);
  return (
    <details className="rounded-xl border border-white/8 bg-[#111111] p-5" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-base font-medium">CI workflow for these checks</summary>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">A GitHub Actions workflow that runs the CI-runnable checks in your repository when you start it for a stage. Review it and add it through a pull request; V19 does not write it to your repository.</p>
      {state.kind === "loading" && <p className="mt-3 text-sm text-zinc-400">Generating…</p>}
      {state.kind === "error" && <p className="mt-3 text-sm text-amber-300">The workflow could not be generated. Try again.</p>}
      {state.kind === "ready" && <div className="mt-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <code className="font-mono text-xs text-zinc-300">{state.path}</code>
          <button type="button" className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-zinc-200" onClick={() => { void navigator.clipboard?.writeText(state.yaml).then(() => setCopied(true), () => setCopied(false)); }}>{copied ? "Copied" : "Copy"}</button>
          <a href="/api/control/checks/workflow?format=yaml" className="inline-flex min-h-9 items-center rounded-lg border border-white/12 px-3 text-zinc-200">Download</a>
        </div>
        {state.skipped.length > 0 && <ul className="mt-3 list-disc pl-5 text-xs leading-5 text-zinc-400">{state.skipped.map((s) => <li key={s.key}><span className="font-mono">{s.key}</span>: not in this file, {s.reason}.</li>)}</ul>}
        <pre tabIndex={0} aria-label="Generated workflow" className="mt-3 max-h-96 overflow-auto rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-xs leading-5 text-zinc-200">{state.yaml}</pre>
      </div>}
    </details>);
}

function LatestResultLine({ check, latest }: { check: Check; latest: LatestResult | "unavailable" | undefined }) {
  if (latest === "unavailable") return <p className="mt-1 text-xs text-zinc-400">Results could not be read.</p>;
  if (!latest) return <p className="mt-1 text-xs text-zinc-400">No result recorded yet.</p>;
  const when = new Date(latest.reportedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const tone = latest.status === "passed" ? "text-emerald-300" : latest.status === "failed" ? "text-red-300" : "text-amber-300";
  return <p className="mt-1 text-xs text-zinc-400">Last result: <span className={tone}>{latest.status}</span> · {when}{latest.checkVersion !== check.version && <> · <span className="text-amber-300">ran version {latest.checkVersion}, current is {check.version}</span></>}{latest.runUrl && <> · <a href={latest.runUrl} className="underline underline-offset-2" target="_blank" rel="noreferrer">CI run</a></>}</p>;
}

function ConfirmChecklist({ check, onRecorded }: { check: Check; onRecorded: () => void }) {
  const items = Array.isArray(check.spec.items) ? (check.spec.items as string[]) : [];
  const [ticked, setTicked] = useState<boolean[]>(() => items.map(() => false));
  const [sha, setSha] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "busy" | "done" } | { kind: "error"; message: string }>({ kind: "idle" });
  const ready = ticked.every(Boolean) && /^[0-9a-f]{40}$/.test(sha.trim());
  async function confirm() {
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/control/checks/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ checkKey: check.key, checkVersion: check.version, commitSha: sha.trim(), confirmedItems: items }) });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (res.ok && body?.ok) { setState({ kind: "done" }); setTicked(items.map(() => false)); setSha(""); onRecorded(); return; }
      setState({ kind: "error", message: body?.error === "approver_role_required" ? "Only owners, admins, operators and security reviewers can confirm checklists." : body?.error === "check_changed" ? "The checklist changed. Reload and confirm the current items." : "The confirmation could not be recorded. Try again." });
    } catch { setState({ kind: "error", message: "The confirmation could not be reached. Try again." }); }
  }
  return (
    <details className="mt-2 text-xs text-zinc-300">
      <summary className="cursor-pointer py-1 text-zinc-300">Confirm for a commit</summary>
      <fieldset className="mt-2 space-y-1.5">
        <legend className="sr-only">Checklist items for {check.name}</legend>
        {items.map((item, i) => <label key={i} className="flex items-start gap-2"><input type="checkbox" checked={ticked[i] ?? false} onChange={(e) => setTicked(ticked.map((t, j) => (j === i ? e.target.checked : t)))} />{item}</label>)}
      </fieldset>
      <label className="mt-2 block text-zinc-400">Commit SHA (40 characters)<input value={sha} onChange={(e) => setSha(e.target.value.toLowerCase())} spellCheck={false} className="mt-1 block w-full max-w-md rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-zinc-100" /></label>
      <button type="button" disabled={!ready || state.kind === "busy"} onClick={() => void confirm()} className="mt-2 inline-flex min-h-8 items-center rounded-lg bg-zinc-100 px-3 text-xs font-medium text-zinc-950 disabled:opacity-50">{state.kind === "busy" ? "Recording…" : "Confirm all items"}</button>
      <span aria-live="polite" className="ml-2">{state.kind === "done" ? "Recorded for this commit." : state.kind === "error" ? <span className="text-amber-300">{state.message}</span> : null}</span>
    </details>);
}
