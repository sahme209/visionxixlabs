/**
 * Security view — runs the security scanner against the web platform
 * and renders typed checks with severity / scope / remediation.
 */

import { useEffect, useState } from "react";
import { desktopClient, type SecurityScanLite } from "../lib/desktopClient";
import { Card, SectionHeader, ViewShell, LoadingState, EmptyState, Badge, Kpi, statusToneFor } from "../components/Primitives";

const SEVERITY_TONE = { critical: "danger", high: "warning", medium: "cyan", low: "neutral", info: "neutral" } as const;

interface ReleaseGateSummary {
  passed: boolean;
  passRate: number;
  averageScore: number;
  summary: string;
  blockers: ReadonlyArray<{ kind: string; message: string }>;
}

export function SecurityView() {
  const [scan, setScan] = useState<SecurityScanLite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "fail" | "warn" | "preview">("all");
  // Phase 393 release-gate summary — drives the new "Quality gate findings"
  // section above the legacy cloud-security checks.
  const [gate, setGate] = useState<ReleaseGateSummary | null>(null);

  const run = () => {
    setLoading(true);
    setError(null);
    desktopClient.securityScan().then((res) => {
      if (res.ok) setScan(res.data);
      else setError(res.error);
      setLoading(false);
    });
    if (desktopClient.hasAuth()) {
      desktopClient.v1ReleaseGate().then((res) => {
        if (res.ok) {
          const d = res.data as { gate?: ReleaseGateSummary };
          setGate(d.gate ?? null);
        } else {
          setGate(null);
        }
      });
    } else {
      setGate(null);
    }
  };

  useEffect(() => { run(); }, []);

  if (loading && !scan) return <ViewShell><LoadingState label="Running security scan…" /></ViewShell>;
  if (error && !scan) {
    return (
      <ViewShell>
        <EmptyState
          Icon={ShieldIcon}
          title="Security scan failed"
          detail={error}
          action={<button onClick={run} className="btn-primary">Retry</button>}
        />
      </ViewShell>
    );
  }

  const results = scan?.results ?? [];
  const filtered = results.filter((r) => filter === "all" ? true : r.status === filter);

  return (
    <ViewShell>
      <SectionHeader
        kicker="// security"
        title="Cloud · app · supply chain · desktop posture."
        subtitle={scan ? `Score ${scan.summary.score}/100 across ${scan.summary.total} typed checks.` : ""}
        action={<button onClick={run} className="btn-secondary text-[12px]">Re-run scan</button>}
      />

      {/* Release-gate (Phase 393) summary — only renders when an API key
          is paired AND there's a recent eval run. Shows the gate verdict
          and any blockers as security findings. */}
      {gate && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-[0.22em]">// quality gate · live</h2>
          <Card className={`p-5 border ${gate.passed ? "border-emerald-500/20" : "border-white/30"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge tone={gate.passed ? "success" : "warning"}>{gate.passed ? "PASSED" : "BLOCKED"}</Badge>
                  <span className="text-[10px] font-mono text-zinc-500">pass rate · {(gate.passRate * 100).toFixed(1)}%</span>
                  <span className="text-[10px] font-mono text-zinc-500">· avg score · {gate.averageScore.toFixed(2)}</span>
                </div>
                <p className="text-sm text-white">{gate.summary}</p>
              </div>
            </div>
            {gate.blockers.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.18em]">blockers · {gate.blockers.length}</p>
                <ul className="space-y-1.5">
                  {gate.blockers.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[12px]">
                      <Badge tone="warning">{b.kind}</Badge>
                      <span className="text-zinc-300">{b.message}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </section>
      )}

      {scan && (
        <>
          <section className="grid grid-cols-5 gap-3">
            <Kpi label="Score"     value={`${scan.summary.score}/100`} tone="emerald" />
            <Kpi label="Passing"   value={scan.summary.pass}    tone="emerald" />
            <Kpi label="Failing"   value={scan.summary.fail}    tone="rose" />
            <Kpi label="Warning"   value={scan.summary.warn}    tone="amber" />
            <Kpi label="Preview"   value={scan.summary.preview} tone="violet" />
          </section>

          <div className="flex items-center gap-2">
            {(["all", "fail", "warn", "preview"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors ${
                  filter === f
                    ? "bg-violet-500/15 border border-violet-500/30 text-violet-200"
                    : "bg-white/[0.02] border border-axiom-border text-zinc-400 hover:text-white"
                }`}
              >
                {f.toUpperCase()} · {f === "all" ? results.length : results.filter((r) => r.status === f).length}
              </button>
            ))}
          </div>

          <section className="space-y-2">
            {filtered.slice(0, 30).map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <Badge tone={SEVERITY_TONE[r.severity] as "danger" | "warning" | "cyan" | "neutral"}>{r.severity}</Badge>
                      <Badge tone={statusToneFor(r.status)}>{r.status}</Badge>
                      <span className="text-[10px] font-mono text-zinc-500">{r.scope}</span>
                      {r.provider && <span className="text-[10px] font-mono text-zinc-500">· {r.provider}</span>}
                      <span className="text-[10px] font-mono text-zinc-500">· {r.source}</span>
                    </div>
                    <p className="text-sm font-semibold text-white">{r.title}</p>
                    <p className="text-[11px] text-zinc-500 mt-1 line-clamp-2">{r.description}</p>
                    {r.remediation && (
                      <p className="text-[11px] text-violet-300 mt-2"><span className="text-zinc-500">fix · </span>{r.remediation}</p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </section>
        </>
      )}
    </ViewShell>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
