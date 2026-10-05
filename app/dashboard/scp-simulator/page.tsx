"use client";

/**
 * /dashboard/scp-simulator — pre-flight policy effect probe.
 *
 * Paste an SCP / IAM policy and a synthetic request. The simulator
 * tells you whether the policy would Allow / Deny / NotApply,
 * statement by statement.
 */

import { useState } from "react";
import {
  BeakerIcon,
  CheckCircleIcon,
  XCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

type Verdict = "Allow" | "Deny" | "NotApplicable";

interface StatementResult {
  sid?: string;
  effect: "Allow" | "Deny";
  matched: boolean;
  reason: string;
}

interface SimulationResult {
  verdict: Verdict;
  summary: string;
  statements: StatementResult[];
  limitations: string[];
}

const DEFAULT_POLICY = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyWeakeningS3PublicAccessBlock",
      "Effect": "Deny",
      "Action": [
        "s3:PutBucketPublicAccessBlock",
        "s3:DeleteBucketPublicAccessBlock"
      ],
      "Resource": "*",
      "Condition": {
        "StringNotEquals": {
          "aws:PrincipalTag/BreakGlass": "true"
        }
      }
    }
  ]
}`;

const DEFAULT_ACTION = "s3:PutBucketPublicAccessBlock";

const VERDICT_TONE: Record<Verdict, string> = {
  Allow:          "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  Deny:           "bg-rose-500/15 text-rose-300 border-rose-500/30",
  NotApplicable:  "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

const VERDICT_ICON: Record<Verdict, typeof CheckCircleIcon> = {
  Allow:         CheckCircleIcon,
  Deny:          XCircleIcon,
  NotApplicable: MinusCircleIcon,
};

export default function ScpSimulatorPage() {
  const [policyJson, setPolicyJson] = useState(DEFAULT_POLICY);
  const [action, setAction] = useState(DEFAULT_ACTION);
  const [resource, setResource] = useState("*");
  const [principalTagsRaw, setPrincipalTagsRaw] = useState('{"BreakGlass": "false"}');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      let principalTags: Record<string, string> = {};
      try {
        principalTags = principalTagsRaw.trim() ? JSON.parse(principalTagsRaw) : {};
      } catch {
        setError("Principal tags JSON is invalid.");
        setBusy(false);
        return;
      }
      const r = await fetch("/api/autonomy/scp-simulate", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          policyJson,
          request: { action, resource, principalTags },
        }),
      });
      const j = (await r.json()) as { ok?: boolean; data?: SimulationResult; error?: { userMessage?: string } };
      if (j.ok && j.data) setResult(j.data);
      else setError(j.error?.userMessage ?? "Simulation failed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  const Verdict = result ? VERDICT_ICON[result.verdict] : null;

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(14,165,233,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(124,58,237,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <BeakerIcon className="h-3.5 w-3.5 text-sky-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-sky-300">
              SCP Simulator · approval_only_no_execution
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Simulate. <span className="text-gradient">Before you apply.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Pure local evaluator — no AWS SDK call. Paste a candidate SCP and a synthetic request, see whether
          the policy would Allow / Deny / not apply. Statement-by-statement reasoning.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[11px] font-mono text-sky-300/80 uppercase tracking-wider mb-2">// candidate policy</p>
          <textarea
            value={policyJson}
            onChange={(e) => setPolicyJson(e.target.value)}
            rows={18}
            className="w-full font-mono text-[11px] rounded-lg border border-white/[0.08] bg-black/40 px-3 py-2 text-zinc-100 focus:border-sky-400/60 focus:outline-none"
            spellCheck={false}
          />
        </div>

        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
          <p className="text-[11px] font-mono text-sky-300/80 uppercase tracking-wider">// synthetic request</p>
          <div>
            <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Action</label>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full font-mono text-[12px] rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white focus:border-sky-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Resource</label>
            <input
              type="text"
              value={resource}
              onChange={(e) => setResource(e.target.value)}
              className="w-full font-mono text-[12px] rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-white focus:border-sky-400/60 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1">Principal tags (JSON)</label>
            <textarea
              value={principalTagsRaw}
              onChange={(e) => setPrincipalTagsRaw(e.target.value)}
              rows={4}
              className="w-full font-mono text-[11px] rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-zinc-100 focus:border-sky-400/60 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <button
            onClick={run}
            disabled={busy}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-sky-500/15 text-sky-200 border border-sky-500/30 hover:bg-sky-500/20 disabled:opacity-50"
          >
            <BeakerIcon className="h-3.5 w-3.5" />
            {busy ? "Simulating…" : "Simulate"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" aria-live="assertive" className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-8">
          <div className="flex items-center gap-3 mb-3">
            {Verdict && <Verdict className="h-6 w-6 text-white" />}
            <div>
              <span className={`text-[12px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${VERDICT_TONE[result.verdict]}`}>
                {result.verdict}
              </span>
              <p className="text-[13px] text-white mt-1">{result.summary}</p>
            </div>
          </div>

          <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">// per-statement</p>
          <div className="divide-y divide-white/[0.04] border border-white/[0.06] rounded-lg overflow-hidden">
            {result.statements.map((s, i) => (
              <div key={i} className="px-3 py-2 flex items-start gap-2 hover:bg-white/[0.02]">
                <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                  s.matched
                    ? s.effect === "Deny"
                      ? "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
                }`}>
                  {s.matched ? s.effect.toLowerCase() : "skip"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-mono text-white">{s.sid ?? `(no Sid · stmt #${i})`}</p>
                  <p className="text-[11px] text-zinc-400 leading-snug">{s.reason}</p>
                </div>
              </div>
            ))}
          </div>

          {result.limitations.length > 0 && (
            <div className="mt-3 rounded-md border border-amber-500/15 bg-amber-500/[0.04] p-2.5">
              <p className="text-[10px] font-mono text-amber-300/80 uppercase tracking-wider mb-1">// simulator limitations</p>
              {result.limitations.map((l, i) => (
                <p key={i} className="text-[11px] text-amber-100">· {l}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
