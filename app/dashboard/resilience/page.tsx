"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { ModuleIntro } from "@/components/portal/ModuleIntro";

type TerraformJob = { jobId: string };

type ResilienceReport = {
  reportId: string;
  resilienceScore: {
    total: number;
    grade: string;
    summary: string;
    categories: {
      cloudDependency: { score: number; maxScore: number; factors: { name: string; points: number; reason: string }[] };
      regionalRedundancy: { score: number; maxScore: number; factors: { name: string; points: number; reason: string }[] };
      backupAndReplication: { score: number; maxScore: number; factors: { name: string; points: number; reason: string }[] };
      securityExposure: { score: number; maxScore: number; factors: { name: string; points: number; reason: string }[] };
      monitoringAndRecovery: { score: number; maxScore: number; factors: { name: string; points: number; reason: string }[] };
    };
  };
  currentState: {
    primaryProvider: string;
    providers: string[];
    regions: string[];
    resourceCounts: Record<string, number>;
    estimatedMonthlyCost: number | null;
  };
  risks: { category: string; severity: string; description: string }[];
  recommendedArchitecture: {
    pattern: string;
    secondaryProvider: string;
    components: string[];
    description: string;
  };
  estimatedCostImpact: {
    currentMonthlyCost: number | null;
    additionalMonthlyCost: number | null;
    percentIncrease: number | null;
  };
  rto: string;
  rpo: string;
  nextSteps: string[];
  aiAnalysis: string;
};

type ConnectorStatus = Record<string, { status: string; linkedAt?: string }>;

function gradeColor(grade: string): string {
  if (grade === "A") return "#22c55e";
  if (grade === "B") return "#84cc16";
  if (grade === "C") return "#eab308";
  if (grade === "D") return "#f97316";
  return "#ef4444";
}

function gradeLabel(grade: string): string {
  if (grade === "A") return "Excellent";
  if (grade === "B") return "Good";
  if (grade === "C") return "Fair";
  if (grade === "D") return "Poor";
  return "Critical";
}

function severityColor(severity: string): string {
  if (severity === "critical") return "bg-red-500/10 text-red-400 border-red-500/20";
  if (severity === "high") return "bg-orange-500/10 text-orange-400 border-orange-500/20";
  if (severity === "medium") return "bg-yellow-500/10 text-yellow-400 border-yellow-500/20";
  return "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";
}

function severityLabel(severity: string): string {
  if (severity === "critical") return "Critical";
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}

function providerFullName(p: string): string {
  if (p === "aws") return "Amazon Web Services";
  if (p === "azure") return "Microsoft Azure";
  if (p === "gcp") return "Google Cloud Platform";
  return p.toUpperCase();
}

function categoryLabel(key: string): string {
  const labels: Record<string, string> = {
    cloudDependency: "Provider diversification",
    regionalRedundancy: "Geographic distribution",
    backupAndReplication: "Data protection",
    securityExposure: "Security posture",
    monitoringAndRecovery: "Recovery readiness",
  };
  return labels[key] ?? key;
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = gradeColor(grade);

  return (
    <div className="relative w-[152px] h-[152px]">
      <svg width="152" height="152" viewBox="0 0 152 152">
        <circle cx="76" cy="76" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle
          cx="76" cy="76" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 76 76)"
          style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-xs text-zinc-500 font-medium">{gradeLabel(grade)}</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const barColor = pct >= 75 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  const textColor = pct >= 75 ? "text-emerald-400" : pct >= 50 ? "text-yellow-400" : "text-red-400";
  return (
    <div className="mb-3.5">
      <div className="flex justify-between mb-1.5">
        <span className="text-sm text-zinc-200 font-medium">{label}</span>
        <span className={`text-xs font-semibold ${textColor}`}>{score}/{maxScore}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function ResilienceDashboard() {
  useSession();
  const [connectors, setConnectors] = useState<ConnectorStatus | null>(null);
  const [report, setReport] = useState<ResilienceReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tfJob, setTfJob] = useState<TerraformJob | null>(null);
  const [tfLoading, setTfLoading] = useState(false);
  const [tfError, setTfError] = useState<string | null>(null);

  const token = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("token") : null;

  useEffect(() => {
    if (!token) return;
    fetch(`/api/connectors/status?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.connectors) setConnectors(data.connectors);
      })
      .catch(() => {});
  }, [token]);

  async function runAnalysis() {
    if (!token) return;
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/architecture/analyze?token=${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        return;
      }
      setReport(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  const generateTerraform = useCallback(async () => {
    if (!token || !report) return;
    setTfLoading(true);
    setTfError(null);
    try {
      const res = await fetch(`/api/terraform/generate?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readinessReportId: report.reportId }),
      });
      const data = await res.json();
      if (!res.ok) { setTfError(data.error ?? "Generation failed"); return; }
      setTfJob({ jobId: data.jobId });
    } catch { setTfError("Network error"); } finally { setTfLoading(false); }
  }, [token, report]);

  const linkedProviders = connectors
    ? Object.entries(connectors).filter(([k, v]) => ["aws", "azure", "gcp"].includes(k) && v.status === "linked")
    : [];

  return (
    <div className="max-w-[1000px] mx-auto py-8 px-5 text-zinc-200">
      <ModuleIntro storageKey="resilience" title="Cloud resilience"
        explanation="Review resilience analysis and generate a Terraform configuration draft."
        helpsYouDo={["Review provider and recovery risks", "Generate configuration for manual review", "Use the paired desktop deployment request for optional customer CI plan evidence"]}
        connectFirst={["Connect a cloud account for analysis"]} aiEngineers={["Cloud Engineer"]}
        approval={{ severity: "read_only", note: "Live Terraform planning and approval are unavailable. Apply remains disabled; a configuration draft or historical approval cannot authorize deployment. Optional customer CI evidence needs separately reviewed storage, trust and connected read access; it grants no apply permission." }}
        demoHref="/demo/cloud_operations" docsHref="/docs/terraform-export" lastReviewed="2026-10-18" />

      {/* Header */}
      <Reveal direction="up" blur delay={0.05}>
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-white tracking-[-0.04em]">
            Resilience <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Your cloud resilience score, risk analysis, and configuration drafts.
          </p>
        </div>
      </Reveal>

      {/* Overview Cards Row */}
      <Reveal direction="up" blur delay={0.1}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Cloud Connections */}
          <div className="glass-card card-hover rounded-2xl p-5">
            <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">
              Connected Clouds
            </div>
            <div className="flex gap-2">
              {["aws", "azure", "gcp"].map((p) => {
                const linked = connectors?.[p]?.status === "linked";
                return (
                  <div key={p} className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 border ${
                    linked
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-white/[0.02] border-white/[0.06] text-zinc-500"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${linked ? "bg-emerald-500" : "bg-zinc-600"}`} />
                    {p.toUpperCase()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Score */}
          {report && (
            <div className="glass-card card-hover rounded-2xl p-5">
              <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                Resilience Score
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-bold" style={{ color: gradeColor(report.resilienceScore.grade) }}>
                  {report.resilienceScore.total}
                </span>
                <span className="text-sm text-zinc-500">/ 100</span>
              </div>
            </div>
          )}

          {/* Cost */}
          {report && (
            <div className="glass-card card-hover rounded-2xl p-5">
              <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                Current Monthly Cost
              </div>
              <span className="text-3xl font-bold text-white">
                {report.currentState.estimatedMonthlyCost != null
                  ? `$${report.currentState.estimatedMonthlyCost.toLocaleString()}`
                  : "—"}
              </span>
            </div>
          )}

          {/* Risks */}
          {report && (
            <div className="glass-card card-hover rounded-2xl p-5">
              <div className="text-[11px] text-zinc-500 font-semibold uppercase tracking-wider mb-2">
                Active Risks
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${report.risks.some(r => r.severity === "critical") ? "text-red-400" : "text-orange-400"}`}>
                  {report.risks.length}
                </span>
                <span className="text-xs text-zinc-500">
                  {report.risks.filter(r => r.severity === "critical").length} critical
                </span>
              </div>
            </div>
          )}
        </div>
      </Reveal>

      {/* Analyze Button (pre-report) */}
      {!report && (
        <Reveal direction="up" blur delay={0.15}>
          <div className="glass-card glow-border-card rounded-2xl p-6">
            <div className="text-center py-8">
              <div className="text-4xl mb-4">
                <span role="img" aria-label="shield">&#x1F6E1;</span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2 tracking-[-0.04em]">
                Analyze your cloud <span className="text-gradient">resilience</span>
              </h2>
              <p className="text-sm text-zinc-400 mb-6 max-w-md mx-auto">
                We&apos;ll scan your connected cloud accounts, identify risks, and generate an architecture recommendation. This is completely read-only.
              </p>
              <button
                onClick={runAnalysis}
                disabled={analyzing || linkedProviders.length === 0}
                className={`btn-axiom cta-glow px-7 py-3 text-[15px] font-semibold text-white rounded-xl transition-all ${
                  analyzing
                    ? "bg-zinc-700 cursor-wait"
                    : "bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500"
                } ${linkedProviders.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {analyzing ? "Scanning your infrastructure..." : "Run Resilience Analysis"}
              </button>
              {analyzing && (
                <p className="text-xs text-zinc-500 mt-3">
                  Discovering resources, running security checks, and generating AI analysis. Typically 30-60 seconds.
                </p>
              )}
              {linkedProviders.length === 0 && (
                <p className="text-xs text-orange-400 mt-3">
                  Connect at least one cloud provider to get started.
                </p>
              )}
              {error && <p role="alert" aria-live="assertive" className="text-sm text-red-400 mt-3">{error}</p>}
            </div>
          </div>
        </Reveal>
      )}

      {/* Report */}
      {report && (
        <div className="flex flex-col gap-4">
          <Stagger delay={0.1} interval={0.06}>
            {/* Score + AI Summary */}
            <div className="glass-card animated-border card-inner-glow rounded-2xl p-6">
              <div className="flex gap-7 items-center flex-wrap">
                <ScoreRing score={report.resilienceScore.total} grade={report.resilienceScore.grade} />
                <div className="flex-1 min-w-[260px]">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="axiom-badge text-[11px] font-semibold uppercase" style={{
                      color: gradeColor(report.resilienceScore.grade),
                      background: `${gradeColor(report.resilienceScore.grade)}15`,
                    }}>
                      Grade {report.resilienceScore.grade}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {report.resilienceScore.total >= 65 ? "Your infrastructure has good resilience coverage." : report.resilienceScore.total >= 35 ? "Your resilience has room for improvement." : "Your infrastructure is at significant risk."}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    {report.aiAnalysis}
                  </p>
                </div>
              </div>
            </div>

            {/* Score Breakdown */}
            <div className="glass-card card-hover rounded-2xl p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4 tracking-[-0.04em]">Score Breakdown</h2>
              <CategoryBar label={categoryLabel("cloudDependency")} score={report.resilienceScore.categories.cloudDependency.score} maxScore={20} />
              <CategoryBar label={categoryLabel("regionalRedundancy")} score={report.resilienceScore.categories.regionalRedundancy.score} maxScore={20} />
              <CategoryBar label={categoryLabel("backupAndReplication")} score={report.resilienceScore.categories.backupAndReplication.score} maxScore={20} />
              <CategoryBar label={categoryLabel("securityExposure")} score={report.resilienceScore.categories.securityExposure.score} maxScore={20} />
              <CategoryBar label={categoryLabel("monitoringAndRecovery")} score={report.resilienceScore.categories.monitoringAndRecovery.score} maxScore={20} />
            </div>

            {/* Current vs Recommended */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card card-hover rounded-2xl p-6">
                <h2 className="text-[15px] font-semibold text-white mb-4 tracking-[-0.04em]">Your Infrastructure</h2>
                <div className="text-sm text-zinc-400 space-y-2">
                  <div><span className="text-zinc-500">Provider:</span> <strong className="text-zinc-200">{providerFullName(report.currentState.primaryProvider)}</strong></div>
                  <div><span className="text-zinc-500">Regions:</span> <strong className="text-zinc-200">{report.currentState.regions.join(", ") || "1 region"}</strong></div>
                  <div><span className="text-zinc-500">Monthly cost:</span> <strong className="text-zinc-200">{report.currentState.estimatedMonthlyCost != null ? `$${report.currentState.estimatedMonthlyCost.toLocaleString()}` : "Unknown"}</strong></div>
                  {Object.entries(report.currentState.resourceCounts).map(([k, v]) => (
                    <div key={k}><span className="text-zinc-500">{k.split(":").pop()}:</span> <strong className="text-zinc-200">{v}</strong></div>
                  ))}
                </div>
              </div>

              <div className="glass-card animated-border card-inner-glow card-hover rounded-2xl p-6">
                <h2 className="text-[15px] font-semibold text-white mb-4 tracking-[-0.04em]">Recommended Setup</h2>
                <div className="text-sm text-zinc-400 space-y-2">
                  <div><span className="text-zinc-500">Architecture:</span> <strong className="text-zinc-500">{report.recommendedArchitecture.pattern}</strong></div>
                  <div><span className="text-zinc-500">Standby cloud:</span> <strong className="text-zinc-500">{providerFullName(report.recommendedArchitecture.secondaryProvider)}</strong></div>
                  <div><span className="text-zinc-500">Recovery time:</span> <strong className="text-zinc-200">{report.rto}</strong></div>
                  <div><span className="text-zinc-500">Data recovery:</span> <strong className="text-zinc-200">{report.rpo}</strong></div>
                  <div><span className="text-zinc-500">Additional cost:</span> <strong className="text-zinc-200">{report.estimatedCostImpact.additionalMonthlyCost != null ? `+$${report.estimatedCostImpact.additionalMonthlyCost.toLocaleString()}/mo` : `+${report.estimatedCostImpact.percentIncrease}%`}</strong></div>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-1.5">
                  {report.recommendedArchitecture.components.map((c, i) => (
                    <span key={i} className="axiom-badge text-zinc-500">{c}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Risks */}
            <div className="glass-card card-hover rounded-2xl p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4 tracking-[-0.04em]">
                Identified Risks ({report.risks.length})
              </h2>
              <div className="flex flex-col">
                {report.risks.slice(0, 8).map((r, i) => (
                  <div key={i} className={`flex items-start gap-2.5 py-2.5 ${
                    i < Math.min(report.risks.length, 8) - 1 ? "border-b border-white/[0.06]" : ""
                  }`}>
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${severityColor(r.severity)}`}>
                      {severityLabel(r.severity)}
                    </span>
                    <span className="text-sm text-zinc-300 leading-relaxed">{r.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Plan */}
            <div className="glass-card card-hover rounded-2xl p-6">
              <h2 className="text-[15px] font-semibold text-white mb-4 tracking-[-0.04em]">Recommended Next Steps</h2>
              {report.nextSteps.map((step, i) => (
                <div key={i} className={`flex gap-3 py-2.5 ${i < report.nextSteps.length - 1 ? "border-b border-white/[0.06]" : ""}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                    i === 0
                      ? "bg-orange-500/15 border border-white/[0.12] text-zinc-500"
                      : "bg-white/[0.04] text-zinc-500"
                  }`}>{i + 1}</span>
                  <span className="text-sm text-zinc-300">{step}</span>
                </div>
              ))}
            </div>

            <div className="glass-card animated-border card-inner-glow rounded-2xl p-6">
              <h2 className="text-[15px] font-semibold text-white mb-1 tracking-[-0.04em]">Terraform configuration draft</h2>
              <p className="text-sm text-zinc-400 mb-4">
                Generate a starting configuration for manual review. This does not run Terraform or establish a saved plan, current target authority, approval or deployment.
              </p>
              <p className="text-xs text-orange-300 mb-4">
                Live Terraform planning and approval are unavailable. Your workspace needs a trusted tenant-bound saved-plan producer before these actions can be offered. Apply stays disabled.
              </p>
              {tfError && <p role="alert" className="text-sm text-red-400 mb-4">{tfError}</p>}
              {!tfJob && <button onClick={generateTerraform} disabled={tfLoading} className="btn-axiom px-6 py-2.5 text-sm font-semibold text-white rounded-lg bg-blue-600 disabled:opacity-50">
                {tfLoading ? "Generating configuration..." : "Generate Terraform configuration"}
              </button>}
              {tfJob && <div role="status" className="text-sm text-zinc-300">
                <p>Configuration draft generated</p>
                <p className="mt-1 text-xs text-zinc-500 break-all">Draft record: {tfJob.jobId}</p>
                <p className="mt-2 text-xs text-zinc-400">This draft is not saved-plan evidence. Historical text plans or recorded lead approvals cannot authorize an action. Existing saved-plan inspection in desktop remains read-only.</p>
              </div>}
            </div>
          </Stagger>

          {/* Re-analyze */}
          <div className="text-center pt-2 pb-5">
            <button
              onClick={() => { setReport(null); setTfJob(null); setTfError(null); runAnalysis(); }}
              disabled={analyzing}
              className="btn-axiom px-5 py-2 text-sm font-medium text-zinc-500 bg-transparent border border-white/[0.06] rounded-lg hover:text-zinc-500 hover:border-white/[0.08] transition-colors"
            >
              {analyzing ? "Analyzing..." : "Re-run analysis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
