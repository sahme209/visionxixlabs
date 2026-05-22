"use client";

/**
 * Migration engineer stage form — Phase 374.
 *
 * Captures the operator's MigrationDescriptor and posts to
 * /api/workforce/engineers/migration/stage. On success, redirects
 * to the freshly-minted approval snapshot detail page where the
 * runbook can be reviewed and approvers can vote.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowPathIcon, ShieldCheckIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

const MIGRATION_KINDS = [
  "add_column",
  "drop_column",
  "rename_column",
  "add_table",
  "drop_table",
  "alter_index",
  "alter_api_contract",
] as const;

const CONNECTORS = ["postgres", "mysql"] as const;

type State =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "blocked"; runbookErrors: readonly string[] };

export function MigrationStageForm() {
  const router = useRouter();

  const [migrationKind, setMigrationKind] = useState<(typeof MIGRATION_KINDS)[number]>("add_column");
  const [target, setTarget] = useState("");
  const [rationale, setRationale] = useState("");
  const [hasReverseScript, setHasReverseScript] = useState(false);
  const [hasActiveWriters, setHasActiveWriters] = useState(true);
  const [estimatedRowCount, setEstimatedRowCount] = useState(100_000);
  const [windowHours, setWindowHours] = useState(24);
  const [connector, setConnector] = useState<(typeof CONNECTORS)[number]>("postgres");

  const [state, setState] = useState<State>({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/workforce/engineers/migration/stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          kind: migrationKind,
          target,
          rationale,
          hasReverseScript,
          hasActiveWriters,
          estimatedRowCount,
          windowHours,
          connector,
        }),
      });
      const json = await res.json() as {
        ok?: boolean;
        reason?: string;
        detail?: string;
        approvalRequestId?: string | null;
        runbook?: { errors?: readonly string[] };
      };

      if (!res.ok || !json.ok) {
        if (json.reason === "runbook_blocked" && json.runbook?.errors?.length) {
          setState({ kind: "blocked", runbookErrors: json.runbook.errors });
          return;
        }
        setState({ kind: "error", message: json.detail ?? json.reason ?? `HTTP ${res.status}` });
        return;
      }

      if (json.approvalRequestId) {
        router.push(`/dashboard/workforce/approvals/${json.approvalRequestId}`);
        return;
      }
      // Verdict was "allowed" with no approval id (rare for critical risk).
      router.push("/dashboard/workforce/approvals");
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : "Network error" });
    }
  }

  const submitting = state.kind === "submitting";

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Migration kind">
          <select
            value={migrationKind}
            onChange={(e) => setMigrationKind(e.target.value as (typeof MIGRATION_KINDS)[number])}
            className="form-select"
            disabled={submitting}
          >
            {MIGRATION_KINDS.map((k) => (
              <option key={k} value={k}>{k.replace(/_/g, " ")}</option>
            ))}
          </select>
        </Field>

        <Field label="Connector">
          <select
            value={connector}
            onChange={(e) => setConnector(e.target.value as (typeof CONNECTORS)[number])}
            className="form-select"
            disabled={submitting}
          >
            {CONNECTORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        <Field label="Target (table or contract id)">
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            maxLength={128}
            placeholder="users"
            className="form-input"
            disabled={submitting}
            required
          />
        </Field>

        <Field label="Estimated row count">
          <input
            type="number"
            value={estimatedRowCount}
            onChange={(e) => setEstimatedRowCount(Number(e.target.value))}
            min={0}
            max={1e12}
            className="form-input"
            disabled={submitting}
            required
          />
        </Field>

        <Field label="Dual-write window (hours)">
          <input
            type="number"
            value={windowHours}
            onChange={(e) => setWindowHours(Number(e.target.value))}
            min={0}
            max={168}
            className="form-input"
            disabled={submitting}
            required
          />
        </Field>

        <Field label="Reverse migration script ready?">
          <ToggleRow
            id="reverse"
            checked={hasReverseScript}
            onChange={setHasReverseScript}
            disabled={submitting}
            label="Yes, the rollback path exists and was tested."
          />
        </Field>

        <Field label="Active writers in flight?" full>
          <ToggleRow
            id="writers"
            checked={hasActiveWriters}
            onChange={setHasActiveWriters}
            disabled={submitting}
            label="There are services writing to this target right now (forces dual-write stage)."
          />
        </Field>
      </div>

      <Field label="Rationale — why this migration">
        <textarea
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          maxLength={2000}
          placeholder="What problem does this solve? What breaks if we don't ship it?"
          rows={4}
          className="form-textarea"
          disabled={submitting}
          required
        />
      </Field>

      {state.kind === "error" && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-[12px] text-rose-200">
          <ExclamationTriangleIcon className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
          {state.message}
        </p>
      )}

      {state.kind === "blocked" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[12px] text-amber-100">
          <p className="font-semibold mb-1">Runbook is blocked — fix these before staging:</p>
          <ul className="list-disc list-inside marker:text-amber-400/70 space-y-0.5">
            {state.runbookErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-100 border border-violet-500/40 hover:bg-violet-500/30 transition disabled:opacity-50 text-[13px] font-medium"
        >
          {submitting ? (
            <>
              <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
              Staging…
            </>
          ) : (
            <>
              <ShieldCheckIcon className="h-3.5 w-3.5" />
              Stage migration (requires two approvers)
            </>
          )}
        </button>
        <p className="text-[11px] text-zinc-500">
          Staging mints an approval snapshot. Nothing applies until both approvers vote.
        </p>
      </div>

      <style jsx>{`
        :global(.form-input),
        :global(.form-select),
        :global(.form-textarea) {
          width: 100%;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #e4e4e7;
          font-size: 12.5px;
          padding: 8px 10px;
          border-radius: 8px;
          outline: none;
        }
        :global(.form-input:focus),
        :global(.form-select:focus),
        :global(.form-textarea:focus) {
          border-color: rgba(139, 92, 246, 0.5);
        }
        :global(.form-input:disabled),
        :global(.form-select:disabled),
        :global(.form-textarea:disabled) {
          opacity: 0.5;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ToggleRow({
  id, checked, onChange, disabled, label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label htmlFor={id} className="flex items-start gap-2 cursor-pointer">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="mt-0.5 h-3.5 w-3.5 rounded border-white/[0.12] bg-white/[0.04] text-violet-500 focus:ring-violet-500/30"
      />
      <span className="text-[12px] text-zinc-300 leading-snug">{label}</span>
    </label>
  );
}
