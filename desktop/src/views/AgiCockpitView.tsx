import { useEffect, useState } from "react";
import type { View } from "../App";
import { ViewShell } from "../components/Primitives";

interface CockpitRec {
  id: string; releaseId: string; kind: string; title: string;
  rationale: string; confidence: number; severity: string; generatedAtIso: string;
}
interface CockpitProp {
  id: string; kind: string; suggestedRuleKey: string; title: string;
  rationale: string; confidence: number; severity: string; generatedAtIso: string;
}
interface EngineTelemetry {
  name: string; version: string;
  pendingCount: number; acceptedCount: number; rejectedCount: number;
  lastRunIso: string | null;
}
interface CockpitData {
  generatedAt: string;
  engines: { advisor: EngineTelemetry; policyProposal: EngineTelemetry };
  topRecommendations: CockpitRec[];
  topProposals: CockpitProp[];
  headline: {
    totalPending: number;
    highestSeverity: "low" | "medium" | "high" | "critical" | "none";
    callToAction: string;
  };
}
type CockpitBody = { ok: true; data: CockpitData } | { ok: false; error: string; hint?: string };

const SEVERITY_CLASS: Record<string, string> = {
  critical: "bg-rose-500/25 text-rose-200 border-rose-500/40",
  high:     "bg-rose-500/15 text-rose-300 border-rose-500/25",
  medium:   "bg-amber-500/15 text-amber-300 border-amber-500/25",
  low:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  none:     "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  unknown:  "bg-zinc-700/40 text-zinc-400 border-zinc-700/40",
};

export function AgiCockpitView({ onNavigate }: { onNavigate?: (v: View) => void } = {}) {
  const [resp, setResp] = useState<CockpitBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);

  function loadCockpit() {
    setLoading(true);
    setNetworkError(null);
    fetch("/api/dashboard/agi-cockpit", { credentials: "include" })
      .then((r) => r.json())
      .then((j: CockpitBody) => setResp(j))
      .catch((e) => setNetworkError(e instanceof Error ? e.message : "Network error."))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadCockpit(); }, []);

  const data = resp?.ok ? resp.data : null;
  const errorBody = resp && !resp.ok ? resp : null;

  return (
    <ViewShell>
      <div>
        <h1 className="text-xl font-bold tracking-tight">AGI cockpit</h1>
        <p className="text-sm text-zinc-500 mt-0.5">
          Fused view of the platform's autonomous engines. One hub for everything pending.
        </p>
      </div>

      {loading && <div className="glass-card p-4 text-sm text-zinc-400">Loading cockpit…</div>}
      {!loading && networkError && (
        <div className="glass-card p-4 text-sm text-rose-300 border border-rose-500/20">{networkError}</div>
      )}
      {!loading && errorBody?.error === "migration_pending" && (
        <div className="glass-card p-4 border border-amber-500/30">
          <p className="text-sm font-semibold text-amber-300 mb-1">Schema migration pending</p>
          <p className="text-xs text-zinc-400">{errorBody.hint}</p>
        </div>
      )}
      {!loading && errorBody?.error === "auth_required" && (
        <div className="glass-card p-4 text-sm text-amber-300 border border-amber-500/20">Sign in required.</div>
      )}

      {data && (
        <>
          <div className={`glass-card p-4 ${data.headline.highestSeverity === "critical" || data.headline.highestSeverity === "high" ? "border border-rose-500/30" : "border border-emerald-500/30"}`}>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border ${SEVERITY_CLASS[data.headline.highestSeverity] ?? SEVERITY_CLASS.none}`}>
                {data.headline.highestSeverity === "none" ? "all clear" : `severity ${data.headline.highestSeverity}`}
              </span>
              <p className="text-sm font-semibold text-white flex-1 min-w-[160px]">{data.headline.callToAction}</p>
              {data.headline.totalPending > 0 && onNavigate && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => onNavigate("release-advisor")}
                          className="px-2 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-[11px] font-mono text-white hover:bg-zinc-800/60">
                    Advisor →
                  </button>
                  <button type="button" onClick={() => onNavigate("policy-proposals")}
                          className="px-2 py-1 rounded border border-zinc-700/40 bg-zinc-800/40 text-[11px] font-mono text-white hover:bg-zinc-800/60">
                    Proposals →
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <EngineCard engine={data.engines.advisor} view="release-advisor" onNavigate={onNavigate} />
            <EngineCard engine={data.engines.policyProposal} view="policy-proposals" onNavigate={onNavigate} />
          </div>

          <Section title="Top pending recommendations" subtitle={data.engines.advisor.version}>
            {data.topRecommendations.length === 0 ? (
              <p className="text-[12.5px] text-zinc-400 italic glass-card p-3">Nothing pending.</p>
            ) : (
              <div className="space-y-1.5">
                {data.topRecommendations.map((r) => (
                  <CompactCard
                    key={r.id}
                    severity={r.severity}
                    title={r.title}
                    rationale={r.rationale}
                    confidence={r.confidence}
                    chip={r.kind}
                    meta={`release ${r.releaseId}`}
                    onClick={() => onNavigate?.("release-advisor")}
                    generatedAtIso={r.generatedAtIso}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Top pending policy proposals" subtitle={data.engines.policyProposal.version}>
            {data.topProposals.length === 0 ? (
              <p className="text-[12.5px] text-zinc-400 italic glass-card p-3">Nothing pending.</p>
            ) : (
              <div className="space-y-1.5">
                {data.topProposals.map((p) => (
                  <CompactCard
                    key={p.id}
                    severity={p.severity}
                    title={p.title}
                    rationale={p.rationale}
                    confidence={p.confidence}
                    chip={p.kind}
                    meta={`key ${p.suggestedRuleKey}`}
                    onClick={() => onNavigate?.("policy-proposals")}
                    generatedAtIso={p.generatedAtIso}
                  />
                ))}
              </div>
            )}
          </Section>
        </>
      )}
    </ViewShell>
  );
}

function EngineCard({ engine, view, onNavigate }: { engine: EngineTelemetry; view: View; onNavigate?: (v: View) => void }) {
  const lastRun = engine.lastRunIso ? new Date(engine.lastRunIso).toLocaleString() : "never";
  return (
    <div className="glass-card p-3 border border-violet-500/20">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-semibold text-white">{engine.name}</p>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{engine.version}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-2 text-[11px] font-mono">
        <Metric label="pending" value={engine.pendingCount} tone={engine.pendingCount > 0 ? "amber" : "zinc"} />
        <Metric label="accepted" value={engine.acceptedCount} tone="emerald" />
        <Metric label="rejected" value={engine.rejectedCount} tone={engine.rejectedCount > 0 ? "rose" : "zinc"} />
      </div>
      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
        <span>last run · {lastRun}</span>
        {onNavigate && (
          <button type="button" onClick={() => onNavigate(view)} className="text-violet-300 hover:text-violet-200">Open →</button>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "emerald" | "amber" | "rose" | "zinc" }) {
  const cls = {
    emerald: "text-emerald-300",
    amber:   "text-amber-300",
    rose:    "text-rose-300",
    zinc:    "text-zinc-300",
  }[tone];
  return (
    <div className="rounded border border-zinc-700/30 bg-zinc-900/40 px-2 py-1">
      <p className="text-zinc-500 uppercase tracking-[0.18em] text-[8px]">{label}</p>
      <p className={`${cls} text-[14px] font-bold`}>{value}</p>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline gap-3">
        <h2 className="text-[13px] font-semibold text-white">{title}</h2>
        {subtitle && <p className="text-[10.5px] font-mono text-zinc-500">{subtitle}</p>}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function CompactCard({ severity, title, rationale, confidence, chip, meta, onClick, generatedAtIso }: {
  severity: string; title: string; rationale: string; confidence: number;
  chip: string; meta: string; onClick?: () => void; generatedAtIso: string;
}) {
  return (
    <button type="button" onClick={onClick}
            className="block w-full text-left glass-card p-3 hover:border-violet-500/30 transition-colors">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className={`text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${SEVERITY_CLASS[severity] ?? SEVERITY_CLASS.unknown}`}>
          {severity}
        </span>
        <span className="text-[9.5px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border border-zinc-700/40 bg-zinc-800/40 text-zinc-300">
          {chip}
        </span>
        <span className="text-[10px] font-mono text-zinc-500">confidence {confidence}%</span>
        <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(generatedAtIso).toLocaleString()}</span>
      </div>
      <p className="text-[12.5px] font-semibold text-white">{title}</p>
      <p className="text-[11.5px] text-zinc-300 mt-0.5 line-clamp-2">{rationale}</p>
      <p className="text-[10.5px] font-mono text-zinc-500 mt-1">{meta}</p>
    </button>
  );
}
