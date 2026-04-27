"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

type TerraformJob = {
  jobId: string;
  status: string;
  planSummary: { add: number; change: number; destroy: number } | null;
  planOutput: string | null;
  applyOutput: string | null;
  errorMessage: string | null;
  approvedAt: string | null;
};

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
  if (severity === "critical") return "#ef4444";
  if (severity === "high") return "#f97316";
  if (severity === "medium") return "#eab308";
  return "#6b7280";
}

function severityLabel(severity: string): string {
  if (severity === "critical") return "Critical";
  if (severity === "high") return "High";
  if (severity === "medium") return "Medium";
  return "Low";
}

function providerLabel(p: string): string {
  if (p === "aws") return "AWS";
  if (p === "azure") return "Azure";
  if (p === "gcp") return "GCP";
  return p.toUpperCase();
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
    <div style={{ position: "relative", width: 152, height: 152 }}>
      <svg width="152" height="152" viewBox="0 0 152 152">
        <circle cx="76" cy="76" r={radius} fill="none" stroke="#1e293b" strokeWidth="8" />
        <circle
          cx="76" cy="76" r={radius} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 76 76)"
          style={{ transition: "stroke-dashoffset 1.2s ease" }}
        />
      </svg>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      }}>
        <span style={{ fontSize: 36, fontWeight: 700, color }}>{score}</span>
        <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 500 }}>{gradeLabel(grade)}</span>
      </div>
    </div>
  );
}

function CategoryBar({ label, score, maxScore }: { label: string; score: number; maxScore: number }) {
  const pct = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const color = pct >= 75 ? "#22c55e" : pct >= 50 ? "#eab308" : "#ef4444";
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 13, color: "#e2e8f0", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 600 }}>{score}/{maxScore}</span>
      </div>
      <div style={{ height: 5, background: "#1e293b", borderRadius: 3 }}>
        <div style={{ height: 5, width: `${pct}%`, background: color, borderRadius: 3, transition: "width 1.2s ease" }} />
      </div>
    </div>
  );
}

function Card({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <div style={{
      background: "#0f172a",
      border: `1px solid ${highlight ? "#8b5cf620" : "#1e293b"}`,
      borderRadius: 16,
      padding: 24,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 16px", color: "#f8fafc", letterSpacing: "-0.01em" }}>
      {children}
    </h2>
  );
}

export default function ResilienceDashboard() {
  const { data: session } = useSession();
  const [connectors, setConnectors] = useState<ConnectorStatus | null>(null);
  const [report, setReport] = useState<ResilienceReport | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [tfJob, setTfJob] = useState<TerraformJob | null>(null);
  const [tfLoading, setTfLoading] = useState(false);
  const [tfError, setTfError] = useState<string | null>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [planOutput, setPlanOutput] = useState<string | null>(null);

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
      setTfJob({ jobId: data.jobId, status: "generating", planSummary: null, planOutput: null, applyOutput: null, errorMessage: null, approvedAt: null });
    } catch { setTfError("Network error"); } finally { setTfLoading(false); }
  }, [token, report]);

  const runPlan = useCallback(async () => {
    if (!token || !tfJob) return;
    setTfLoading(true);
    setTfError(null);
    try {
      const res = await fetch(`/api/terraform/plan?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: tfJob.jobId }),
      });
      const data = await res.json();
      if (!res.ok) { setTfError(data.error ?? "Plan failed"); return; }
      setPlanOutput(data.output ?? null);
      setTfJob((prev) => prev ? { ...prev, status: data.status, planSummary: data.summary } : null);
    } catch { setTfError("Network error"); } finally { setTfLoading(false); }
  }, [token, tfJob]);

  const approvePlan = useCallback(async () => {
    if (!token || !tfJob || confirmInput !== "CONFIRM APPLY") return;
    setTfLoading(true);
    setTfError(null);
    try {
      const res = await fetch(`/api/terraform/approve?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: tfJob.jobId, confirmation: "CONFIRM APPLY" }),
      });
      const data = await res.json();
      if (!res.ok) { setTfError(data.error ?? "Approval failed"); return; }
      setTfJob((prev) => prev ? { ...prev, status: "awaiting_approval", approvedAt: new Date().toISOString() } : null);
    } catch { setTfError("Network error"); } finally { setTfLoading(false); }
  }, [token, tfJob, confirmInput]);

  const runApply = useCallback(async () => {
    if (!token || !tfJob) return;
    setTfLoading(true);
    setTfError(null);
    try {
      const res = await fetch(`/api/terraform/apply?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: tfJob.jobId }),
      });
      const data = await res.json();
      if (!res.ok) { setTfError(data.error ?? "Apply failed"); return; }
      setTfJob((prev) => prev ? { ...prev, status: data.status, applyOutput: data.output } : null);
    } catch { setTfError("Network error"); } finally { setTfLoading(false); }
  }, [token, tfJob]);

  const linkedProviders = connectors
    ? Object.entries(connectors).filter(([k, v]) => ["aws", "azure", "gcp"].includes(k) && v.status === "linked")
    : [];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 20px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#e2e8f0" }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#f8fafc", letterSpacing: "-0.02em" }}>
          Resilience Dashboard
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>
          Your cloud resilience score, risk analysis, and deployment controls.
        </p>
      </div>

      {/* Overview Cards Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {/* Cloud Connections */}
        <Card>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Connected Clouds
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["aws", "azure", "gcp"].map((p) => {
              const linked = connectors?.[p]?.status === "linked";
              return (
                <div key={p} style={{
                  padding: "6px 12px", borderRadius: 6,
                  background: linked ? "#16a34a10" : "#1e293b",
                  border: `1px solid ${linked ? "#16a34a40" : "#334155"}`,
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 12, fontWeight: 500,
                  color: linked ? "#4ade80" : "#475569",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: linked ? "#22c55e" : "#475569" }} />
                  {p.toUpperCase()}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Score */}
        {report && (
          <Card>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Resilience Score
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: gradeColor(report.resilienceScore.grade) }}>
                {report.resilienceScore.total}
              </span>
              <span style={{ fontSize: 13, color: "#64748b" }}>/ 100</span>
            </div>
          </Card>
        )}

        {/* Cost */}
        {report && (
          <Card>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Current Monthly Cost
            </div>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#f8fafc" }}>
              {report.currentState.estimatedMonthlyCost != null
                ? `$${report.currentState.estimatedMonthlyCost.toLocaleString()}`
                : "—"}
            </span>
          </Card>
        )}

        {/* Risks */}
        {report && (
          <Card>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
              Active Risks
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: report.risks.some(r => r.severity === "critical") ? "#ef4444" : "#f97316" }}>
                {report.risks.length}
              </span>
              <span style={{ fontSize: 12, color: "#64748b" }}>
                {report.risks.filter(r => r.severity === "critical").length} critical
              </span>
            </div>
          </Card>
        )}
      </div>

      {/* Analyze Button (pre-report) */}
      {!report && (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>
              <span role="img" aria-label="shield">&#x1F6E1;</span>
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#f8fafc", margin: "0 0 8px" }}>
              Analyze your cloud resilience
            </h2>
            <p style={{ fontSize: 14, color: "#94a3b8", marginBottom: 24, maxWidth: 400, marginLeft: "auto", marginRight: "auto" }}>
              We&apos;ll scan your connected cloud accounts, identify risks, and generate an architecture recommendation. This is completely read-only.
            </p>
            <button
              onClick={runAnalysis}
              disabled={analyzing || linkedProviders.length === 0}
              style={{
                padding: "12px 28px", fontSize: 15, fontWeight: 600,
                background: analyzing ? "#334155" : "linear-gradient(135deg, #8b5cf6, #a855f7)",
                color: "#fff", border: "none", borderRadius: 10, cursor: analyzing ? "wait" : "pointer",
                opacity: linkedProviders.length === 0 ? 0.5 : 1,
                transition: "all 0.2s",
              }}
            >
              {analyzing ? "Scanning your infrastructure..." : "Run Resilience Analysis"}
            </button>
            {analyzing && (
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 12 }}>
                Discovering resources, running security checks, and generating AI analysis. Typically 30-60 seconds.
              </p>
            )}
            {linkedProviders.length === 0 && (
              <p style={{ fontSize: 12, color: "#f97316", marginTop: 12 }}>
                Connect at least one cloud provider to get started.
              </p>
            )}
            {error && <p style={{ fontSize: 13, color: "#ef4444", marginTop: 12 }}>{error}</p>}
          </div>
        </Card>
      )}

      {/* Report */}
      {report && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Score + AI Summary */}
          <Card highlight>
            <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreRing score={report.resilienceScore.total} grade={report.resilienceScore.grade} />
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                    background: `${gradeColor(report.resilienceScore.grade)}15`,
                    color: gradeColor(report.resilienceScore.grade),
                    textTransform: "uppercase",
                  }}>
                    Grade {report.resilienceScore.grade}
                  </span>
                  <span style={{ fontSize: 12, color: "#64748b" }}>
                    {report.resilienceScore.total >= 65 ? "Your infrastructure has good resilience coverage." : report.resilienceScore.total >= 35 ? "Your resilience has room for improvement." : "Your infrastructure is at significant risk."}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: "#cbd5e1", margin: 0, lineHeight: 1.7 }}>
                  {report.aiAnalysis}
                </p>
              </div>
            </div>
          </Card>

          {/* Score Breakdown */}
          <Card>
            <SectionTitle>Score Breakdown</SectionTitle>
            <CategoryBar label={categoryLabel("cloudDependency")} score={report.resilienceScore.categories.cloudDependency.score} maxScore={20} />
            <CategoryBar label={categoryLabel("regionalRedundancy")} score={report.resilienceScore.categories.regionalRedundancy.score} maxScore={20} />
            <CategoryBar label={categoryLabel("backupAndReplication")} score={report.resilienceScore.categories.backupAndReplication.score} maxScore={20} />
            <CategoryBar label={categoryLabel("securityExposure")} score={report.resilienceScore.categories.securityExposure.score} maxScore={20} />
            <CategoryBar label={categoryLabel("monitoringAndRecovery")} score={report.resilienceScore.categories.monitoringAndRecovery.score} maxScore={20} />
          </Card>

          {/* Current vs Recommended — side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Card>
              <SectionTitle>Your Infrastructure</SectionTitle>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 2.2 }}>
                <div><span style={{ color: "#64748b" }}>Provider:</span> <strong style={{ color: "#e2e8f0" }}>{providerFullName(report.currentState.primaryProvider)}</strong></div>
                <div><span style={{ color: "#64748b" }}>Regions:</span> <strong style={{ color: "#e2e8f0" }}>{report.currentState.regions.join(", ") || "1 region"}</strong></div>
                <div><span style={{ color: "#64748b" }}>Monthly cost:</span> <strong style={{ color: "#e2e8f0" }}>{report.currentState.estimatedMonthlyCost != null ? `$${report.currentState.estimatedMonthlyCost.toLocaleString()}` : "Unknown"}</strong></div>
                {Object.entries(report.currentState.resourceCounts).map(([k, v]) => (
                  <div key={k}><span style={{ color: "#64748b" }}>{k.split(":").pop()}:</span> <strong style={{ color: "#e2e8f0" }}>{v}</strong></div>
                ))}
              </div>
            </Card>

            <Card highlight>
              <SectionTitle>Recommended Setup</SectionTitle>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 2.2 }}>
                <div><span style={{ color: "#64748b" }}>Architecture:</span> <strong style={{ color: "#a78bfa" }}>{report.recommendedArchitecture.pattern}</strong></div>
                <div><span style={{ color: "#64748b" }}>Standby cloud:</span> <strong style={{ color: "#a78bfa" }}>{providerFullName(report.recommendedArchitecture.secondaryProvider)}</strong></div>
                <div><span style={{ color: "#64748b" }}>Recovery time:</span> <strong style={{ color: "#e2e8f0" }}>{report.rto}</strong></div>
                <div><span style={{ color: "#64748b" }}>Data recovery:</span> <strong style={{ color: "#e2e8f0" }}>{report.rpo}</strong></div>
                <div><span style={{ color: "#64748b" }}>Additional cost:</span> <strong style={{ color: "#e2e8f0" }}>{report.estimatedCostImpact.additionalMonthlyCost != null ? `+$${report.estimatedCostImpact.additionalMonthlyCost.toLocaleString()}/mo` : `+${report.estimatedCostImpact.percentIncrease}%`}</strong></div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {report.recommendedArchitecture.components.map((c, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 8px", background: "#8b5cf610", border: "1px solid #8b5cf620", borderRadius: 4, color: "#a78bfa" }}>{c}</span>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Risks */}
          <Card>
            <SectionTitle>
              Identified Risks ({report.risks.length})
            </SectionTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {report.risks.slice(0, 8).map((r, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0",
                  borderBottom: i < Math.min(report.risks.length, 8) - 1 ? "1px solid #1e293b" : "none",
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4,
                    background: `${severityColor(r.severity)}12`, color: severityColor(r.severity),
                    textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: "0.04em",
                  }}>
                    {severityLabel(r.severity)}
                  </span>
                  <span style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5 }}>{r.description}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Action Plan */}
          <Card>
            <SectionTitle>Recommended Next Steps</SectionTitle>
            {report.nextSteps.map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 12, padding: "9px 0", borderBottom: i < report.nextSteps.length - 1 ? "1px solid #1e293b" : "none" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: i === 0 ? "#8b5cf620" : "#1e293b",
                  border: i === 0 ? "1px solid #8b5cf640" : "none",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 600,
                  color: i === 0 ? "#a78bfa" : "#64748b",
                  flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ fontSize: 13, color: "#cbd5e1" }}>{step}</span>
              </div>
            ))}
          </Card>

          {/* Deploy Standby Infrastructure */}
          <Card highlight>
            <SectionTitle>Deploy Standby Infrastructure</SectionTitle>
            <p style={{ fontSize: 13, color: "#94a3b8", marginBottom: 16, marginTop: -8 }}>
              Create an {report.recommendedArchitecture.pattern} standby on {providerLabel(report.recommendedArchitecture.secondaryProvider)}. We generate the infrastructure code, show you exactly what will be created, and only deploy after your explicit approval.
            </p>

            {/* Safety notice */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 12px", borderRadius: 8,
              background: "#1e293b", marginBottom: 16,
              fontSize: 12, color: "#64748b",
            }}>
              <span style={{ fontSize: 14 }}>&#x1F512;</span>
              Nothing is created until you type <strong style={{ color: "#f97316" }}>CONFIRM APPLY</strong> and approve.
            </div>

            {tfError && (
              <div style={{
                padding: "10px 14px", background: "#ef444410",
                border: "1px solid #ef444430", borderRadius: 8,
                marginBottom: 16, fontSize: 13, color: "#ef4444",
              }}>
                {tfError}
              </div>
            )}

            {!tfJob && (
              <button onClick={generateTerraform} disabled={tfLoading} style={{
                padding: "10px 24px", fontSize: 14, fontWeight: 600,
                background: tfLoading ? "#334155" : "linear-gradient(135deg, #8b5cf6, #a855f7)",
                color: "#fff", border: "none", borderRadius: 8,
                cursor: tfLoading ? "wait" : "pointer",
              }}>
                {tfLoading ? "Generating infrastructure plan..." : "Generate Deployment Plan"}
              </button>
            )}

            {tfJob && tfJob.status === "generating" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 13, color: "#4ade80" }}>Infrastructure plan generated</span>
                </div>
                <button onClick={runPlan} disabled={tfLoading} style={{
                  padding: "10px 24px", fontSize: 14, fontWeight: 600,
                  background: tfLoading ? "#334155" : "#3b82f6",
                  color: "#fff", border: "none", borderRadius: 8,
                  cursor: tfLoading ? "wait" : "pointer",
                }}>
                  {tfLoading ? "Validating plan..." : "Preview Changes"}
                </button>
              </div>
            )}

            {tfJob && tfJob.status === "planned" && (
              <div>
                {tfJob.planSummary && (
                  <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                    <div style={{ padding: "8px 14px", background: "#16a34a08", border: "1px solid #16a34a30", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#22c55e" }}>{tfJob.planSummary.add}</div>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>create</div>
                    </div>
                    <div style={{ padding: "8px 14px", background: "#eab30808", border: "1px solid #eab30830", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#eab308" }}>{tfJob.planSummary.change}</div>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>modify</div>
                    </div>
                    <div style={{ padding: "8px 14px", background: "#ef444408", border: "1px solid #ef444430", borderRadius: 8, textAlign: "center" }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color: "#ef4444" }}>{tfJob.planSummary.destroy}</div>
                      <div style={{ fontSize: 10, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>remove</div>
                    </div>
                  </div>
                )}

                {planOutput && (
                  <details style={{ marginBottom: 16 }}>
                    <summary style={{ fontSize: 12, color: "#64748b", cursor: "pointer", fontWeight: 500 }}>
                      View detailed plan output
                    </summary>
                    <pre style={{
                      fontSize: 11, color: "#94a3b8", background: "#020617",
                      padding: 14, borderRadius: 8, marginTop: 8,
                      overflow: "auto", maxHeight: 280, border: "1px solid #1e293b",
                    }}>
                      {planOutput}
                    </pre>
                  </details>
                )}

                <div style={{
                  padding: "12px 16px", borderRadius: 8,
                  background: "#f9731605", border: "1px solid #f9731625",
                  marginBottom: 14,
                }}>
                  <p style={{ fontSize: 13, color: "#f97316", margin: "0 0 4px", fontWeight: 600 }}>
                    Approval required
                  </p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                    Review the plan above. Type <strong style={{ color: "#f8fafc" }}>CONFIRM APPLY</strong> to authorize deployment.
                  </p>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value)}
                    placeholder="Type CONFIRM APPLY"
                    style={{
                      padding: "9px 14px", fontSize: 14, background: "#0f172a", color: "#f8fafc",
                      border: "1px solid #334155", borderRadius: 8, flex: 1, fontFamily: "monospace",
                    }}
                  />
                  <button
                    onClick={approvePlan}
                    disabled={tfLoading || confirmInput !== "CONFIRM APPLY"}
                    style={{
                      padding: "9px 20px", fontSize: 13, fontWeight: 600,
                      background: confirmInput === "CONFIRM APPLY" ? "#f97316" : "#1e293b",
                      color: "#fff", border: `1px solid ${confirmInput === "CONFIRM APPLY" ? "#f97316" : "#334155"}`,
                      borderRadius: 8,
                      cursor: confirmInput === "CONFIRM APPLY" ? "pointer" : "not-allowed",
                      opacity: confirmInput === "CONFIRM APPLY" ? 1 : 0.4,
                    }}
                  >
                    Approve & Deploy
                  </button>
                </div>
              </div>
            )}

            {tfJob && tfJob.status === "awaiting_approval" && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 13, color: "#4ade80" }}>Plan approved. Ready to deploy.</span>
                </div>
                <button onClick={runApply} disabled={tfLoading} style={{
                  padding: "10px 24px", fontSize: 14, fontWeight: 600,
                  background: tfLoading ? "#334155" : "#16a34a",
                  color: "#fff", border: "none", borderRadius: 8,
                  cursor: tfLoading ? "wait" : "pointer",
                }}>
                  {tfLoading ? "Deploying infrastructure..." : "Deploy Standby Infrastructure"}
                </button>
              </div>
            )}

            {tfJob && tfJob.status === "succeeded" && (
              <div style={{ padding: "14px 16px", background: "#16a34a08", border: "1px solid #16a34a30", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#22c55e" }}>Standby infrastructure deployed</span>
                </div>
                <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
                  Your {report.recommendedArchitecture.pattern} setup on {providerLabel(report.recommendedArchitecture.secondaryProvider)} is now active.
                </p>
                {tfJob.applyOutput && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ fontSize: 11, color: "#475569", cursor: "pointer" }}>View deployment details</summary>
                    <pre style={{
                      fontSize: 10, color: "#94a3b8", background: "#020617",
                      padding: 12, borderRadius: 8, marginTop: 8,
                      overflow: "auto", maxHeight: 200, border: "1px solid #1e293b",
                    }}>
                      {tfJob.applyOutput}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {tfJob && tfJob.status === "failed" && (
              <div style={{ padding: "14px 16px", background: "#ef444408", border: "1px solid #ef444430", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#ef4444" }}>Deployment failed</span>
                </div>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>
                  {tfJob.errorMessage ?? "An unexpected error occurred. No infrastructure was modified."}
                </p>
              </div>
            )}
          </Card>

          {/* Re-analyze */}
          <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 20 }}>
            <button
              onClick={() => { setReport(null); setTfJob(null); setTfError(null); setPlanOutput(null); setConfirmInput(""); runAnalysis(); }}
              disabled={analyzing}
              style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 500,
                background: "transparent", color: "#64748b", border: "1px solid #334155",
                borderRadius: 8, cursor: "pointer",
              }}
            >
              {analyzing ? "Analyzing..." : "Re-run analysis"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
