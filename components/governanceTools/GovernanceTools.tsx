"use client";
import { useState, type ReactNode } from "react";

/**
 * Three trust tools on one calm page (A11–A13):
 * audit seal verification, policy replay presets and change impact preview.
 * Every result is labelled with its limits; nothing here enables a policy.
 */
type Json = Record<string, unknown>;
async function call(url: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  return res.json().catch(() => ({ ok: false, error: `http_${res.status}` }));
}

const PRESETS: Record<string, { label: string; draft: Json[] }> = {
  block_high: { label: "Block every high-risk action", draft: [{ name: "Block high risk", matchRiskLevels: ["high"], blockAction: true, priority: 100 }] },
  auto_low: { label: "Auto-approve low-risk actions", draft: [{ name: "Auto-approve low risk", matchRiskLevels: ["low"], requiredApprovals: 0, priority: 100 }] },
  two_person: { label: "Two approvers for everything", draft: [{ name: "Two-person rule", requiredApprovals: 2, priority: 100 }] },
};

export function GovernanceTools({ organizationId, canSeal }: { organizationId: string; canSeal: boolean }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <AuditPanel organizationId={organizationId} canSeal={canSeal} />
      <ReplayPanel organizationId={organizationId} />
      <ImpactPanel />
    </div>
  );
}

function Panel({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return <section aria-label={title} className="flex flex-col rounded-xl border border-white/8 bg-white/2 p-5"><h2 className="text-base font-medium text-zinc-100">{title}</h2><p className="mt-1 text-sm leading-6 text-zinc-400">{lead}</p><div className="mt-4 flex-1">{children}</div></section>;
}

function AuditPanel({ organizationId, canSeal }: { organizationId: string; canSeal: boolean }) {
  const [busy, setBusy] = useState(false); const [out, setOut] = useState<string | null>(null);
  async function verify() {
    setBusy(true);
    const r = await call(`/api/audit/verify?organizationId=${encodeURIComponent(organizationId)}`);
    setOut(r.ok ? (r.sealCount === 0 ? "No seals yet. Seal the log to start the chain." : r.intact ? `Intact: ${r.sealCount} seals verified. Latest ${String(r.latestSealHash).slice(0, 16)}…` : `Problem found: ${(r.verdicts as Json[]).filter((v) => v.status !== "intact").map((v) => `seal #${v.sequence} ${String(v.status).replace("_", " ")}`).join(", ")}`) : `Could not verify (${r.error}).`);
    setBusy(false);
  }
  async function seal() {
    setBusy(true);
    const r = await call("/api/audit/seal", { method: "POST", body: JSON.stringify({ organizationId }) });
    const s = r.sealed as Json | null;
    setOut(r.ok ? (s ? `Sealed ${s.eventCount} events as seal #${s.sequence}. Keep this fingerprint somewhere outside Axiom: ${s.sealHash}` : "Nothing new to seal.") : `Could not seal (${r.error}).`);
    setBusy(false);
  }
  async function checkAnchor(file: File | undefined) {
    if (!file) return;
    if (file.size > 8_000) { setOut("That file is too large to be an anchor."); return; }
    setBusy(true);
    let anchor: unknown = null;
    try { anchor = JSON.parse(await file.text()); } catch { /* reported below */ }
    const r = anchor === null ? { ok: false, error: "not_json" } : await call("/api/audit/anchor", { method: "POST", body: JSON.stringify({ organizationId, anchor }) });
    const res = r.result as Json | undefined;
    setOut(!r.ok ? `Could not check the anchor (${r.error}).` : ANCHOR_MESSAGES[String(res?.status)]?.(res!) ?? "Unexpected result.");
    setBusy(false);
  }
  return (
    <Panel title="Tamper-evident audit" lead="Seals fingerprint the audit log in a chain. Verifying shows any edited, deleted or inserted event.">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => void verify()} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50">Verify</button>
        {canSeal && <button type="button" disabled={busy} onClick={() => void seal()} className="rounded-lg border border-white/15 px-3 py-1.5 text-sm text-zinc-200 disabled:opacity-50">Seal now</button>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <a href={`/api/audit/anchor?organizationId=${encodeURIComponent(organizationId)}`} className="rounded-lg border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/5">Download anchor</a>
        <label className={`cursor-pointer rounded-lg border border-white/15 px-3 py-1.5 text-zinc-200 hover:bg-white/5 ${busy ? "pointer-events-none opacity-50" : ""}`}>
          Check a kept anchor
          <input type="file" accept="application/json,.json" className="sr-only" disabled={busy} onChange={(e) => { void checkAnchor(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
      </div>
      {out && <p role="status" className="mt-3 wrap-break-word text-sm text-zinc-300">{out}</p>}
      <p className="mt-3 text-xs text-zinc-500">Evidence, not prevention. Keep the anchor file somewhere Axiom cannot write (a ticket, a vault, an email to auditors). Checking it later shows whether the chain up to it was rewritten. It contains no event content.</p>
    </Panel>
  );
}

const ANCHOR_MESSAGES: Record<string, (r: Json) => string> = {
  matches: (r) => `Anchor matches seal #${r.sequence}${Number(r.laterSeals) ? `, with ${r.laterSeals} later seal${r.laterSeals === 1 ? "" : "s"}` : ""}. Run Verify to check the events under it.`,
  hash_mismatch: (r) => `Seal #${r.sequence} no longer matches this anchor. The chain was rewritten after the anchor was saved.`,
  seal_missing: (r) => `Seal #${r.sequence} is missing from the chain. The chain was rewritten or truncated after the anchor was saved.`,
  other_workspace: () => "This anchor belongs to a different workspace.",
  invalid_anchor: (r) => (r.reason === "digest" ? "This anchor file was edited, so it cannot be trusted." : r.reason === "schema" ? "This is not an Axiom audit anchor this version understands." : "This is not a valid Axiom audit anchor."),
};

function ReplayPanel({ organizationId }: { organizationId: string }) {
  const [preset, setPreset] = useState("block_high"); const [busy, setBusy] = useState(false); const [out, setOut] = useState<Json | null>(null); const [error, setError] = useState<string | null>(null);
  async function run() {
    setBusy(true); setError(null);
    const r = await call("/api/policy/replay", { method: "POST", body: JSON.stringify({ organizationId, draft: PRESETS[preset].draft, days: 30 }) });
    if (r.ok) setOut(r.replay as Json); else setError(String(r.error));
    setBusy(false);
  }
  const t = out?.totals as { before: Json; after: Json } | undefined;
  return (
    <Panel title="Policy replay" lead="See what a rule would have done to the last 30 days of real actions. Nothing is enabled.">
      <label htmlFor="replay-preset" className="text-xs text-zinc-400">Draft rule</label>
      <select id="replay-preset" value={preset} onChange={(e) => setPreset(e.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm">{Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}</select>
      <button type="button" disabled={busy} onClick={() => void run()} className="mt-3 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50">{busy ? "Replaying…" : "Replay"}</button>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">Could not replay ({error}).</p>}
      {out && t && <div role="status" className="mt-3 text-sm text-zinc-300">
        <p>{String((out.window as Json).actions)} actions. Newly blocked: {String(out.newlyBlocked)} · newly auto-approved: {String(out.newlyAutoApproved)} · stricter: {String(out.stricter)} · looser: {String(out.looser)}</p>
        <p className="mt-1 text-xs text-zinc-500">Before: {String(t.before.auto)} auto, {String(t.before.needs_approval)} approval, {String(t.before.blocked)} blocked. After: {String(t.after.auto)} auto, {String(t.after.needs_approval)} approval, {String(t.after.blocked)} blocked.</p>
        <ul className="mt-2 space-y-1 text-xs text-zinc-500">{(out.limits as string[]).map((l) => <li key={l}>{l}</li>)}</ul>
      </div>}
    </Panel>
  );
}

function ImpactPanel() {
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [out, setOut] = useState<Json | null>(null);
  async function run() {
    setBusy(true);
    const r = await call("/api/impact/preview", { method: "POST", body: JSON.stringify({ paths: text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) }) });
    setOut(r.ok ? (r.impact as Json) : { error: r.error }); setBusy(false);
  }
  return (
    <Panel title="Change impact preview" lead="Paste the changed file paths, one per line, to see what a change touches before you approve it.">
      <label htmlFor="impact-paths" className="sr-only">Changed file paths</label>
      <textarea id="impact-paths" value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={"prisma/migrations/…/migration.sql\n.github/workflows/deploy.yml"} spellCheck={false} className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-xs" />
      <button type="button" disabled={busy || !text.trim()} onClick={() => void run()} className="mt-3 rounded-lg bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-950 disabled:opacity-50">Preview</button>
      {out && ("error" in out ? <p role="alert" className="mt-3 text-sm text-rose-300">Could not preview ({String(out.error)}).</p> :
        <div role="status" className="mt-3 text-sm text-zinc-300">
          <p>Blast radius: <strong className="font-medium">{String(out.blastRadius)}</strong> · rollback: {out.rollback === "needs_plan" ? "needs a plan" : "likely clean"} · {String(out.files)} files</p>
          <p className="mt-1 text-xs text-zinc-500">{(out.areas as { area: string; files: number }[]).map((a) => `${a.area.replace("_", " ")} (${a.files})`).join(" · ")}</p>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-zinc-400">{(out.checks as string[]).map((c) => <li key={c}>{c}</li>)}</ul>
          <p className="mt-2 text-xs text-zinc-500">{(out.limits as string[]).join(" ")}</p>
        </div>)}
    </Panel>
  );
}
