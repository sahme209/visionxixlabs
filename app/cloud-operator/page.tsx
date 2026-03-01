"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BoltIcon,
  ChartBarIcon,
  CheckCircleIcon,
  CloudIcon,
  CpuChipIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  ShieldCheckIcon,
  VariableIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { AxiomMetricCard } from "@/components/axiom-ui/AxiomMetricCard";
import { AxiomSection } from "@/components/axiom-ui/AxiomSection";
import { AxiomCard } from "@/components/axiom-ui/AxiomCard";
import { AxiomButton } from "@/components/axiom-ui/AxiomButton";
import { AxiomAIVision } from "@/components/AxiomAIVision";

type OperatorStatus = {
  leadId?: string;
  outputStatus?: string;
  tier?: string;
  scoringVersion?: string | null;
  infrastructureReadinessScore?: number | null;
  costEfficiencyScore?: number | null;
  securityRiskLevel?: string | null;
  ciCdMaturityScore?: number | null;
  architectureComplexity?: string | null;
  estimatedAnnualSavings?: number | null;
  infrastructureScore?: number | null;
  axiomEstimatedAnnualSavings?: number | null;
  riskExposureLevel?: string | null;
  deploymentFrictionIndex?: number | null;
  complexityTier?: string | null;
  automationReadinessScore?: number | null;
  recommendedImprovements?: string[];
  operatorProfile?: { hostingProvider?: string };
  businessImpactSummary?: string;
  recommendedNextAction?: string;
  canViewTechnicalOutputs?: boolean;
  canDownloadConfigs?: boolean;
  hasEnterpriseEngagement?: boolean;
  launch?: {
    architecturePlan?: string;
    ciCdYaml?: string;
    dockerfile?: string;
    deploymentSteps?: string[];
    cliCommands?: string[];
    terraformTemplates?: string[];
  } | null;
  optimize?: {
    costBreakdown?: string;
    estimatedAnnualSavings?: number | null;
    reservedInstanceSuggestions?: string[];
    storageTierChanges?: string[];
    scalingAdjustments?: string[];
  } | null;
  secure?: {
    riskSummary?: string;
    iamRecommendations?: string;
    networkSegmentation?: string;
    hardeningChecklist?: string[];
    publicAttackSurfaceFindings?: string[];
  } | null;
  simulation?: {
    scoreLift: { min: number; max: number };
    savingsLift: { min: number; max: number };
    riskReduction: { min: number; max: number };
    frictionLift: { min: number; max: number };
    confidence: string;
    assumptions: string[];
  } | null;
  quality?: { pass: boolean; issues: string[] };
  playbooks?: {
    phasePlaybooks: Array<{
      phaseName: string;
      objective: string;
      prerequisites: string[];
      stepByStep: Array<{ step: string; command?: string; file?: string; validation?: string }>;
      rollbackPlan: string[];
      successCriteria: string[];
    }>;
    cutoverChecklist: string[];
    ownerRoles: string[];
    estimatedEffortHours: number;
  };
  playbookPreview?: string[];
  playbookUpsell?: string;
  policyPackPreview?: string;
  explainability?: {
    infrastructureScoreBreakdown: Array<{ factor: string; weight: number; value: number; contribution: number }>;
    keyDrivers: string[];
    penalties: string[];
    improvementLevers: string[];
  };
  enterpriseBriefPreview?: {
    biggestRiskExposures: string[];
    biggestSavingsLevers: string[];
    cta: string;
  };
  strategicReadinessScore?: number | null;
  enterpriseReadinessIndex?: number | null;
  dealSignals?: {
    urgencyLevel?: string;
    expansionProbability?: number;
    enterpriseLikelihood?: number;
    recommendedSalesAngle?: string[];
  };
  upgradeRecommendation?: {
    recommendedTier: string;
    reasoning: string[];
    urgencyMessage: string;
    expectedValueIncrease: number;
  };
  financialModel?: {
    projectedSavings3Year: number;
    riskCostAvoidanceEstimate: number;
    reinvestmentOpportunity: string[];
    budgetReallocationSuggestion: string[];
    confidenceBand: "low" | "medium" | "high";
  };
  trendHistory?: Array<{ id: string; createdAt: string; infrastructureScore?: number | null; estimatedAnnualSavings?: number | null }>;
  axiomPlan?: {
    executiveSummary: {
      infrastructureScore: number;
      estimatedAnnualSavings: number | null;
      riskExposureLevel: string;
      complexityTier: string;
      deploymentFrictionIndex: number;
    };
    prioritizedCategories: {
      critical: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
      highImpact: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
      strategic: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
      optimization: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
    };
    timeSequencedPlan: {
      stabilization: {
        label: string;
        dayRange: string;
        category: string;
        tasks: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
      };
      costOptimization: {
        label: string;
        dayRange: string;
        category: string;
        tasks: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
      };
      deploymentAcceleration: {
        label: string;
        dayRange: string;
        category: string;
        tasks: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
      };
      scalabilityHardening: {
        label: string;
        dayRange: string;
        category: string;
        tasks: { technicalAction: string; businessImpact: string; estimatedImprovementEffect: string }[];
      };
    };
  } | null;
};

function RunScanCard({ token }: { token: string | null }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: string; resultSummary?: string; error?: string; data?: Record<string, unknown> } | null>(null);

  const runScan = async () => {
    if (!token) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/execution/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "aws:iam-readonly-scan",
          dryRun: true,
          input: {},
          token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      setResult({
        status: data.status ?? "unknown",
        resultSummary: data.resultSummary,
        error: data.error,
        data: data.data,
      });
    } catch (e) {
      setResult({
        status: "failed",
        error: e instanceof Error ? e.message : "Scan failed",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <AxiomCard className="p-5 border-l-4 border-l-amber-500">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
        <MagnifyingGlassIcon className="h-4 w-4 text-amber-500" />
        Run Scan (dry run)
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
        Run a safe, read-only IAM scan. No changes made. Requires linked account.
      </p>
      <button
        type="button"
        onClick={runScan}
        disabled={running || !token}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50"
      >
        {running ? "Running…" : "Run IAM Scan"}
        <MagnifyingGlassIcon className="h-3.5 w-3.5" />
      </button>
      {result && (
        <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 text-xs">
          <p className={`font-medium ${result.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {result.status === "success" ? "Success" : "Failed"}
          </p>
          {result.resultSummary && <p className="text-slate-600 dark:text-slate-400 mt-1">{result.resultSummary}</p>}
          {result.error && <p className="text-rose-600 dark:text-rose-400 mt-1">{result.error}</p>}
        </div>
      )}
    </AxiomCard>
  );
}

function EmailReportButton({ token }: { token: string | null }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!token) return;
    setSending(true);
    setErr(null);
    try {
      const res = await fetch(`/api/cloud-operator/send-report?token=${encodeURIComponent(token)}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <AxiomCard className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Email Report</h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Send executive summary to your registered email.</p>
      {sent && <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">Report sent.</p>}
      {err && <p className="text-xs text-rose-600 dark:text-rose-400 mb-2">{err}</p>}
      <button
        type="button"
        onClick={send}
        disabled={sending || !token}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
      >
        {sending ? "Sending…" : "Send Report"}
      </button>
    </AxiomCard>
  );
}

function StrategicTab({ token, status }: { token: string | null; status: OperatorStatus | null }) {
  const [strategicBrief, setStrategicBrief] = useState<{
    executiveSummary?: string;
    financialRiskNarrative?: string;
    operationalRiskNarrative?: string;
    scalabilityOutlook?: string;
    "90DayStrategicFocus"?: string[];
    boardLevelKPIsToTrack?: string[];
    recommendedInvestmentZones?: string[];
    riskIfIgnored?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    if (!token || !status?.canViewTechnicalOutputs || !status?.outputStatus || status.outputStatus !== "ready") return;
    if (fetched) return;
    setLoading(true);
    fetch(`/api/cloud-operator/strategic-brief?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.executiveSummary) setStrategicBrief(d);
        setFetched(true);
      })
      .catch(() => setFetched(true))
      .finally(() => setLoading(false));
  }, [token, status?.canViewTechnicalOutputs, status?.outputStatus, fetched]);

  if (!status?.canViewTechnicalOutputs) {
    return (
      <AxiomSection>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Strategic</h2>
        <p className="text-xs text-slate-600 dark:text-slate-400">Upgrade to Pro+ to view strategic brief, CFO model, and board deck.</p>
      </AxiomSection>
    );
  }

  return (
    <AxiomSection className="space-y-6">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Strategic</h2>

      {status.canViewTechnicalOutputs ? (
        <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/40">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Business Impact & Expansion Signals</h3>
          <div className="grid grid-cols-2 gap-3 text-xs mb-3">
            {status.enterpriseReadinessIndex != null && (
              <div>
                <span className="text-slate-500">Enterprise Readiness Index:</span> {status.enterpriseReadinessIndex}/100
              </div>
            )}
            {status.dealSignals?.urgencyLevel && (
              <div>
                <span className="text-slate-500">Urgency:</span> <span className="capitalize font-medium">{status.dealSignals.urgencyLevel}</span>
              </div>
            )}
            {status.dealSignals?.expansionProbability != null && (
              <div>
                <span className="text-slate-500">Expansion Probability:</span> {status.dealSignals.expansionProbability}%
              </div>
            )}
            {status.upgradeRecommendation && (
              <div>
                <span className="text-slate-500">Recommended Tier:</span> <span className="font-medium capitalize">{status.upgradeRecommendation.recommendedTier}</span>
              </div>
            )}
          </div>
          {status.upgradeRecommendation?.urgencyMessage && (
            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">{status.upgradeRecommendation.urgencyMessage}</p>
          )}
          {status.dealSignals?.recommendedSalesAngle && status.dealSignals.recommendedSalesAngle.length > 0 && (
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5 mt-2">
              {status.dealSignals.recommendedSalesAngle.slice(0, 3).map((a, i) => (
                <li key={i}>• {a}</li>
              ))}
            </ul>
          )}
        </AxiomCard>
      ) : (
        <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/40">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Business Signal Preview</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">Upgrade to Pro+ to view Enterprise Readiness Index, Urgency Level, Expansion Probability, and Recommended Upgrade Tier.</p>
          <p className="text-xs text-indigo-600 dark:text-indigo-400">Unlock deal acceleration signals and psychological upgrade framing.</p>
        </AxiomCard>
      )}

      {status.strategicReadinessScore != null && (
        <AxiomCard className="p-5 bg-indigo-50 dark:bg-indigo-900/20">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Strategic Readiness Score</h3>
          <p className="text-4xl font-bold text-indigo-600 dark:text-indigo-400">{status.strategicReadinessScore}/100</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Board-level composite metric</p>
        </AxiomCard>
      )}
      {status.financialModel && (
        <AxiomCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">CFO Model</h3>
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div><span className="text-slate-500">3-year savings:</span> ${status.financialModel.projectedSavings3Year.toLocaleString()}</div>
            <div><span className="text-slate-500">Risk avoidance:</span> ${status.financialModel.riskCostAvoidanceEstimate.toLocaleString()}</div>
            <div><span className="text-slate-500">Confidence:</span> {status.financialModel.confidenceBand}</div>
          </div>
          <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1">
            {status.financialModel.reinvestmentOpportunity.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </AxiomCard>
      )}
      {loading && <p className="text-xs text-slate-500">Generating strategic brief…</p>}
      {strategicBrief && !loading && (
        <AxiomCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Executive Brief</h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">{strategicBrief.executiveSummary}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">{strategicBrief.financialRiskNarrative}</p>
          {strategicBrief["90DayStrategicFocus"] && strategicBrief["90DayStrategicFocus"].length > 0 && (
            <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1 mt-2">
              {strategicBrief["90DayStrategicFocus"].map((f, i) => (
                <li key={i}>• {f}</li>
              ))}
            </ul>
          )}
        </AxiomCard>
      )}
      {status.hasEnterpriseEngagement && (
        <AxiomCard className="p-5">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Board Deck</h3>
          <a
            href={`/api/cloud-operator/board-deck?token=${encodeURIComponent(token ?? "")}`}
            className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
          >
            <DocumentArrowDownIcon className="h-4 w-4" />
            Download Board Deck Outline
          </a>
        </AxiomCard>
      )}
      <EmailReportButton token={token} />
    </AxiomSection>
  );
}

function RequestImplementationCard({ token }: { token: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(`/api/cloud-operator/request-implementation?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactEmail: fd.get("email")?.toString()?.trim(),
          notes: fd.get("notes")?.toString()?.trim(),
          preferredWindow: fd.get("preferredWindow")?.toString()?.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AxiomCard className="p-5 bg-emerald-50 dark:bg-emerald-900/20">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
          Request submitted
        </h3>
        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
          Our team will reach out within 1–2 business days.
        </p>
        <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-0.5">
          <li>• Check your email for confirmation</li>
          <li>• Prepare cloud account details for the call</li>
        </ul>
      </AxiomCard>
    );
  }

  return (
    <AxiomCard className="p-5">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
        Request Implementation
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
        Get help implementing your 30-day plan. We&apos;ll schedule a call to walk through your infrastructure.
      </p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          name="email"
          type="email"
          placeholder="Work email"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
        <input
          name="preferredWindow"
          type="text"
          placeholder="Preferred time (e.g. mornings PST)"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
        <textarea
          name="notes"
          rows={2}
          placeholder="Notes or questions"
          className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
        />
        {error && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
        )}
        <AxiomButton type="submit" disabled={submitting}>
          {submitting ? "Submitting…" : "Request Implementation"}
          <ArrowRightIcon className="h-3 w-3" />
        </AxiomButton>
      </form>
    </AxiomCard>
  );
}

const TRAFFIC_LEVELS = ["Low", "Medium", "High"] as const;
const HOSTING_PROVIDERS = ["AWS", "GCP", "Azure", "Vercel", "Other"] as const;
const PUBLIC_EXPOSURE = ["API", "Public Web", "Internal Only"] as const;
const COMPLIANCE_OPTIONS = ["None", "SOC2", "HIPAA", "PCI", "GDPR", "Other"] as const;
const GIT_PROVIDERS = ["GitHub", "GitLab", "Bitbucket", "None"] as const;
const PRIMARY_GOALS = [
  "Launch faster",
  "Reduce costs",
  "Improve security",
  "Scale architecture",
] as const;
const WORKLOAD_TYPES = ["Container (Docker/K8s)", "Serverless", "VM/Bare metal", "Hybrid"] as const;
const DATABASE_TYPES = ["RDS/Managed SQL", "NoSQL (DynamoDB, Cosmos, etc.)", "Self-hosted DB", "Multiple"] as const;
const KUBERNETES_OPTIONS = ["Yes, in production", "Yes, staging only", "Evaluating", "No"] as const;
const OPERATOR_TIERS = [
  { id: "free", label: "Analysis" },
  { id: "pro", label: "Roadmap" },
  { id: "growth", label: "Automation Signals" },
  { id: "enterprise", label: "Strategic Advisory" },
] as const;

function CloudOperatorPageInner() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token");

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<OperatorStatus | null>(null);
  const [polling, setPolling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "roadmap" | "playbooks" | "strategic" | "trends" | "export" | "connectors">("overview");
  const [applyFixSelected, setApplyFixSelected] = useState<Set<number>>(new Set());
  const [applyFixSubmitting, setApplyFixSubmitting] = useState(false);
  const [applyFixResult, setApplyFixResult] = useState<{ success?: boolean; message?: string } | null>(null);

  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl !== token) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl, token]);

  useEffect(() => {
    if (status?.outputStatus === "ready") {
      setIsReady(true);
    }
  }, [status?.outputStatus]);

  const fetchStatus = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await fetch(`/api/cloud-operator/status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok) return data as OperatorStatus;
    } catch {
      // ignore
    }
    return null;
  }, [token]);

  useEffect(() => {
    if (!token) return;

    fetch(`/api/cloud-operator/trigger?token=${encodeURIComponent(token)}`, {
      method: "POST",
    }).catch(() => {});

    fetchStatus().then((d) => {
      if (d) setStatus(d);
      if (d && d.outputStatus !== "ready") setPolling(true);
    });

    const interval = setInterval(async () => {
      const d = await fetchStatus();
      if (d) setStatus(d);
      if (d && d.outputStatus === "ready") setPolling(false);
    }, 3000);

    return () => clearInterval(interval);
  }, [token, fetchStatus]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const fd = new FormData(e.currentTarget);

    const operatorProfile = {
      projectType: fd.get("projectType")?.toString() || "",
      hostingProvider: fd.get("hostingProvider")?.toString() || "",
      monthlySpend: fd.get("monthlySpend")?.toString() || "",
      trafficLevel: fd.get("trafficLevel")?.toString() || "Low",
      hasCiCd: fd.get("hasCiCd")?.toString() || "no",
      publicExposure: fd.get("publicExposure")?.toString() || "Internal Only",
      complianceNeeds: fd.get("complianceNeeds")?.toString() || "",
      gitProvider: fd.get("gitProvider")?.toString() || "None",
      primaryGoal: fd.get("primaryGoal")?.toString() || "",
      workloadType: fd.get("workloadType")?.toString() || "",
      databaseType: fd.get("databaseType")?.toString() || "",
      kubernetesUsage: fd.get("kubernetesUsage")?.toString() || "",
    };

    const tier = fd.get("tier")?.toString() || "free";
    const email = fd.get("email")?.toString()?.trim() || "";
    const name = fd.get("name")?.toString()?.trim() || "";

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const res = await fetch("/api/cloud-operator/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorProfile,
          tier,
          email,
          name,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }
      const t = encodeURIComponent(data.token);
      window.location.href = `/cloud-operator?token=${t}`;
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Request timed out. The server may be slow. Please try again.");
      } else {
        setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inDashboard = !!token;

  const handleApplyFixes = async () => {
    if (!token || applyFixSelected.size === 0 || !status?.recommendedImprovements) return;
    setApplyFixSubmitting(true);
    setApplyFixResult(null);
    try {
      const hostingProvider = (status.operatorProfile as { hostingProvider?: string })?.hostingProvider ?? "AWS";
      const { improvementToFixAction } = await import("@/lib/axiom/pluginExecution");
      const actions = Array.from(applyFixSelected).map((idx) => {
        const improvement = status!.recommendedImprovements![idx];
        return improvementToFixAction(improvement, idx, hostingProvider);
      });
      const res = await fetch("/api/axiom/execute-fixes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          actions,
          approvedActionIds: actions.map((a) => a.id),
          leadId: status?.leadId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setApplyFixResult({
          success: data.executed?.every((e: { success: boolean }) => e.success) ?? false,
          message: data.executed?.length
            ? `${data.executed.filter((e: { success: boolean }) => e.success).length} fix(es) executed`
            : "No fixes executed",
        });
        setApplyFixSelected(new Set());
      } else {
        setApplyFixResult({ success: false, message: data.error ?? "Failed to execute" });
      }
    } catch {
      setApplyFixResult({ success: false, message: "Request failed" });
    } finally {
      setApplyFixSubmitting(false);
    }
  };

  return (
    <div className="axiom-page min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <Link
              href="/"
              className="inline-flex items-center gap-1 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Home
            </Link>
            <span>/</span>
            <span className="font-semibold">AI Cloud Operator</span>
          </div>
          {inDashboard && (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <CheckCircleIcon className="h-4 w-4" />
              Analysis ready
            </span>
          )}
        </div>

        <section className="mb-10">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 tracking-wide uppercase mb-1">
            Infrastructure Advantage Model™
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
              <CloudIcon className="h-4 w-4" />
              AI Cloud Operator™
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 dark:bg-violet-900/40 px-3 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
              <SparklesIcon className="h-3.5 w-3.5" />
              AI-Powered Analysis
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 dark:bg-slate-700/60 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              AWS
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 dark:bg-slate-700/60 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              Azure
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-200/80 dark:bg-slate-700/60 px-3 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300">
              GCP
            </div>
          </div>
          <h1 className="axiom-heading-xl text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-2">
            AI-powered cloud intelligence for AWS, Azure &amp; GCP.
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mb-2">
            Score, optimize, and secure your multi-cloud stack. Connect your environment via APIs for real-time analysis—AI turns your actual inventory, cost data, and config into roadmaps, playbooks, and automation. Beyond basic: AI recommendations today, approved execution tomorrow.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 dark:bg-slate-100/5 px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <CpuChipIcon className="h-3 w-3" />
              Deterministic scoring
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 dark:bg-slate-100/5 px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              <VariableIcon className="h-3 w-3" />
              Structured 30-day roadmap
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900/5 dark:bg-slate-100/5 px-3 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
              FinOps &amp; drift detection
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/30 px-3 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-300">
              API access to your cloud
            </span>
          </div>
        </section>

        {inDashboard && !status && (
          <section className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-8">
            <div className="animate-pulse space-y-4">
              <div className="h-4 w-48 rounded-full bg-slate-200 dark:bg-slate-700" />
              <div className="grid md:grid-cols-5 gap-3 mt-6">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-700" />
                ))}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-4">
                Generating your Operator plan…
              </p>
            </div>
          </section>
        )}

        {inDashboard && status && (
          <section
            className={`mb-8 transition-all duration-200 ease-in-out ${
              isReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            <div className="grid md:grid-cols-5 gap-3">
              {status.outputStatus !== "ready" ? (
                <>
                  {[..."12345"].map((key) => (
                    <AxiomMetricCard
                      // biome-ignore lint/suspicious/noArrayIndexKey: simple skeleton
                      key={key}
                      label=""
                      value={
                        <div className="space-y-2 animate-pulse">
                          <div className="mx-auto h-5 w-12 rounded-full bg-slate-200 dark:bg-slate-700" />
                          <div className="mx-auto h-2 w-16 rounded-full bg-slate-100 dark:bg-slate-800" />
                        </div>
                      }
                    />
                  ))}
                </>
              ) : (
                <>
                  <AxiomMetricCard
                    label="Infrastructure Score"
                    value={
                      <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100">
                        {status.infrastructureScore ?? status.infrastructureReadinessScore ?? "—"}
                      </span>
                    }
                  />
                  <AxiomMetricCard
                    label="Estimated Annual Savings"
                    value={
                      <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {status.axiomEstimatedAnnualSavings != null
                          ? `$${status.axiomEstimatedAnnualSavings.toLocaleString()}`
                          : status.estimatedAnnualSavings != null
                          ? `$${status.estimatedAnnualSavings.toLocaleString()}`
                          : "—"}
                      </span>
                    }
                  />
                  <AxiomMetricCard
                    label="Risk Level"
                    value={
                      <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {status.riskExposureLevel ?? status.securityRiskLevel ?? "—"}
                      </span>
                    }
                  />
                  <AxiomMetricCard
                    label="Deployment Friction Index"
                    value={
                      <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {status.deploymentFrictionIndex != null
                          ? `${status.deploymentFrictionIndex}/100`
                          : "—"}
                      </span>
                    }
                  />
                  <AxiomMetricCard
                    label="Automation Readiness Score"
                    value={
                      <span className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {status.automationReadinessScore != null
                          ? `${status.automationReadinessScore}/100`
                          : "—"}
                      </span>
                    }
                  />
                </>
              )}
            </div>
          </section>
        )}

        {!inDashboard && (
          <section className="grid lg:grid-cols-3 gap-8 items-start">
            <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
              <AxiomSection className="space-y-6">
                <header>
                  <h2 className="text-lg md:text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
                    Tell the Operator what you&apos;re running
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-xl">
                    These questions stay the same for every organization. The Operator turns them
                    into architecture, CI/CD, cost, and security plans.
                  </p>
                </header>

                {error && (
                  <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    What are you building?
                  </label>
                  <select
                    name="projectType"
                    required
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  >
                    <option value="">Select a type</option>
                    <option value="SaaS">SaaS</option>
                    <option value="E-commerce">E-commerce</option>
                    <option value="Internal Tool">Internal Tool</option>
                    <option value="API">API</option>
                    <option value="Static Site">Static Site</option>
                    <option value="Microservices">Microservices</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Where is it hosted?
                  </label>
                  <div className="grid sm:grid-cols-3 gap-2">
                    {HOSTING_PROVIDERS.map((p) => (
                      <label
                        key={p}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
                      >
                        <input
                          type="radio"
                          name="hostingProvider"
                          value={p}
                          className="sr-only"
                          required
                        />
                        <span className="text-slate-800 dark:text-slate-100">{p}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Monthly cloud spend (approx.)
                    </label>
                    <input
                      name="monthlySpend"
                      type="number"
                      min={0}
                      placeholder="e.g. 5000"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Expected traffic level
                    </label>
                    <div className="flex gap-2">
                      {TRAFFIC_LEVELS.map((level) => (
                        <label
                          key={level}
                          className="flex-1 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
                        >
                          <input
                            type="radio"
                            name="trafficLevel"
                            value={level}
                            className="sr-only"
                            required
                          />
                          <span className="text-slate-800 dark:text-slate-100">{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Do you have CI/CD?
                    </label>
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200">
                        <input type="radio" name="hasCiCd" value="yes" className="sr-only" required />
                        <span className="text-slate-800 dark:text-slate-100">Yes</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-rose-500 has-[:checked]:ring-2 has-[:checked]:ring-rose-200">
                        <input type="radio" name="hasCiCd" value="no" className="sr-only" />
                        <span className="text-slate-800 dark:text-slate-100">No</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Public exposure
                    </label>
                    <div className="flex gap-2">
                      {PUBLIC_EXPOSURE.map((opt) => (
                        <label
                          key={opt}
                          className="flex-1 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
                        >
                          <input
                            type="radio"
                            name="publicExposure"
                            value={opt}
                            className="sr-only"
                            required
                          />
                          <span className="text-slate-800 dark:text-slate-100">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Compliance needs
                    </label>
                    <select
                      name="complianceNeeds"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                    >
                      {COMPLIANCE_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Git provider
                    </label>
                    <select
                      name="gitProvider"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                    >
                      {GIT_PROVIDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Primary goal
                  </label>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {PRIMARY_GOALS.map((g) => (
                      <label
                        key={g}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
                      >
                        <input
                          type="radio"
                          name="primaryGoal"
                          value={g}
                          className="sr-only"
                          required
                        />
                        <span className="text-slate-800 dark:text-slate-100">{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Primary workload type
                    </label>
                    <select
                      name="workloadType"
                      defaultValue="Container (Docker/K8s)"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                    >
                      {WORKLOAD_TYPES.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Database setup
                    </label>
                    <select
                      name="databaseType"
                      defaultValue="RDS/Managed SQL"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                    >
                      {DATABASE_TYPES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Kubernetes usage
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {KUBERNETES_OPTIONS.map((k) => (
                      <label
                        key={k}
                        className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
                      >
                        <input type="radio" name="kubernetesUsage" value={k} defaultChecked={k === "Evaluating"} className="sr-only" />
                        <span className="text-slate-800 dark:text-slate-100">{k}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-700/80 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Choose your Operator tier
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Included with membership: Starter ($35)→Analysis · Growth ($75)→Roadmap · Scale ($249)→Automation Signals · Enterprise→Strategic Advisory.{" "}
                  <Link href="/axiom/pricing" className="text-indigo-600 hover:underline">View plans</Link>
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {OPERATOR_TIERS.map((t) => (
                    <label
                      key={t.id}
                        className="flex items-start gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-3 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={t.id}
                        defaultChecked={t.id === "free"}
                        className="mt-1.5 h-3 w-3 text-indigo-600 border-slate-300 dark:border-slate-600"
                      />
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">
                          {t.label}
                        </p>
                        {t.id === "free" && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Infrastructure scores and summary dashboard. No configs.
                          </p>
                        )}
                        {t.id === "pro" && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Full technical outputs, YAML, Dockerfile, and downloads.
                          </p>
                        )}
                        {t.id === "growth" && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Adds continuous reassessment and advanced optimization logic.
                          </p>
                        )}
                        {t.id === "enterprise" && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            Strategic engagement and dedicated automation implementation.
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                </div>

                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-700/80 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Work email (optional)
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Name (optional)
                  </label>
                  <input
                    name="name"
                    type="text"
                    placeholder="Your name"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                  {error}
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm">
                  Autopilot Mode: Generates step-by-step playbooks and validated configs. Execution
                  requires your approval.
                </p>
                <AxiomButton type="submit" disabled={submitting}>
                  <BoltIcon className="h-4 w-4" />
                  {submitting ? "Sending to Operator..." : "Run AI Cloud Operator"}
                  <ArrowRightIcon className="h-4 w-4" />
                </AxiomButton>
              </div>
              </AxiomSection>
            </form>

            <aside className="space-y-4">
              <AxiomCard className="p-5 border-l-4 border-l-violet-500">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <SparklesIcon className="h-4 w-4 text-violet-500" />
                  AI-Powered Analysis
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li>Explainable scoring with factor breakdown</li>
                  <li>Impact simulation (score, savings, risk)</li>
                  <li>Drift detection and trend history (Growth+)</li>
                  <li>Deal signals and enterprise readiness</li>
                </ul>
              </AxiomCard>
              <AxiomCard className="p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <ChartBarIcon className="h-4 w-4 text-indigo-500" />
                  What the Operator returns
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li>Infrastructure readiness, cost, security, CI/CD scores</li>
                  <li>Architecture, CI/CD YAML, Dockerfile, Terraform</li>
                  <li>FinOps: cost breakdown, savings, Reserved Instance suggestions</li>
                  <li>IAM, network hardening, security checklist</li>
                  <li>30-day roadmap and playbooks</li>
                </ul>
              </AxiomCard>
              <AxiomCard className="p-5 bg-indigo-50/80 dark:bg-indigo-950/30">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <CloudIcon className="h-4 w-4 text-indigo-600" />
                  Multi-cloud: AWS · Azure · GCP
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Connectors for GitHub, AWS, Azure, GCP (Growth+). Read-only metadata for richer analysis.
                </p>
              </AxiomCard>
              <AxiomAIVision />
              <AxiomCard className="bg-slate-900 text-slate-100 p-5">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
                  Autopilot safety
                </h3>
                <p className="text-xs text-slate-300 mb-3">
                  Generates playbooks and validated configs. Execution requires your approval.
                </p>
                <Link
                  href="/contact?subject=Request+Implementation+Support"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                >
                  <BoltIcon className="h-3 w-3 text-amber-400" />
                  Request implementation support
                </Link>
              </AxiomCard>
            </aside>
          </section>
        )}

        {inDashboard && status && (
          <section
            className={`space-y-8 transition-all duration-200 ease-in-out ${
              isReady ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
            }`}
          >
            {/* Phase 5: Top tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              {[
                { id: "overview" as const, label: "Overview" },
                { id: "roadmap" as const, label: "Roadmap" },
                { id: "playbooks" as const, label: "Playbooks", previewForFree: true },
                { id: "strategic" as const, label: "Strategic", proOnly: true },
                { id: "trends" as const, label: "Trends", proOnly: true },
                { id: "export" as const, label: "Export" },
                { id: "connectors" as const, label: "Connectors", proOnly: true },
              ].map((t) => {
                const proOnly = "proOnly" in t && t.proOnly;
                const visible = !proOnly || status.canViewTechnicalOutputs;
                if (!visible) return null;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === t.id
                        ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {t.label}
                    {proOnly && (
                      <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">Pro+</span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeTab === "overview" && (
            <AxiomSection>
              <div className="flex items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    AI Cloud Operator Dashboard
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Unified view of readiness, savings, security, CI/CD, and architecture
                    complexity.
                  </p>
                </div>
                {status?.outputStatus !== "ready" && (
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    {polling ? "Generating Operator plan..." : "Queued"}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-5 gap-3 mb-6">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase">
                    Infra Readiness
                  </p>
                  <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {status?.infrastructureReadinessScore ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase">
                    Est. Annual Savings
                  </p>
                  <p className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {status?.estimatedAnnualSavings != null
                      ? `$${status.estimatedAnnualSavings.toLocaleString()}`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase">
                    Security Risk
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {status?.securityRiskLevel ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase">
                    CI/CD Maturity
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {status?.ciCdMaturityScore != null
                      ? `${status.ciCdMaturityScore}/100`
                      : "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 p-4 text-center">
                  <p className="text-xs font-medium text-slate-500 uppercase">
                    Architecture Complexity
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {status?.architectureComplexity ?? "—"}
                  </p>
                </div>
              </div>

              {status?.explainability && (
                <AxiomCard className="p-4 bg-slate-50 dark:bg-slate-900/50 mb-6">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Score Breakdown
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Scoring version: {status.scoringVersion ?? "—"}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-4 mb-4">
                    {status.explainability.infrastructureScoreBreakdown.map((item) => (
                      <div key={item.factor} className="flex justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400">{item.factor}</span>
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {item.value} × {item.weight}% = {item.contribution.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {status.explainability.keyDrivers.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Key drivers</p>
                      <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                        {status.explainability.keyDrivers.map((d, i) => (
                          <li key={i}>• {d}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {status.explainability.improvementLevers.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Improvement levers</p>
                      <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
                        {status.explainability.improvementLevers.map((l, i) => (
                          <li key={i}>• {l}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </AxiomCard>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <AxiomCard className="p-4 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Business impact summary
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {status?.businessImpactSummary || "Operator summary will appear here."}
                    </p>
                  </AxiomCard>
                  <AxiomCard className="p-4 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Recommended next action
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {status?.recommendedNextAction || "Next actions will appear here."}
                    </p>
                  </AxiomCard>
                </div>

                <AxiomCard className="p-4 bg-slate-50 dark:bg-slate-900/50">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                    <BoltIcon className="h-4 w-4 text-amber-500" />
                    Recommended improvements — Apply Fix
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                    Select fixes to execute via cloud APIs. Requires sign-in. Destructive actions need your confirmation.
                  </p>
                  <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2 mb-4">
                    {status?.recommendedImprovements && status.recommendedImprovements.length > 0 ? (
                      status.recommendedImprovements.map((item, idx) => (
                        <li key={`${item}-${idx}`} className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={applyFixSelected.has(idx)}
                            onChange={() => {
                              setApplyFixSelected((prev) => {
                                const next = new Set(prev);
                                if (next.has(idx)) next.delete(idx);
                                else next.add(idx);
                                return next;
                              });
                            }}
                            className="mt-1 rounded"
                          />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500 dark:text-slate-400">
                        Operator recommendations will appear here.
                      </li>
                    )}
                  </ul>
                  {applyFixSelected.size > 0 && (
                    <>
                      <AxiomButton
                        onClick={handleApplyFixes}
                        disabled={applyFixSubmitting}
                        className="mb-2"
                      >
                        {applyFixSubmitting ? "Executing…" : `Execute ${applyFixSelected.size} fix(es)`}
                        <BoltIcon className="h-4 w-4" />
                      </AxiomButton>
                      {applyFixResult && (
                        <p className={`text-xs ${applyFixResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {applyFixResult.message}
                        </p>
                      )}
                    </>
                  )}
                </AxiomCard>
              </div>
            </AxiomSection>
            )}

            {activeTab === "roadmap" && status?.axiomPlan && (
              <AxiomSection className="space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    30-Day Infrastructure Optimization Plan
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Structured by Axiom — Autonomous Infrastructure Intelligence Platform
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    status.axiomPlan.timeSequencedPlan.stabilization,
                    status.axiomPlan.timeSequencedPlan.costOptimization,
                    status.axiomPlan.timeSequencedPlan.deploymentAcceleration,
                    status.axiomPlan.timeSequencedPlan.scalabilityHardening,
                  ].map((phase) => (
                    <AxiomCard
                      key={phase.label}
                      className="p-5 bg-slate-50 dark:bg-slate-900/40 text-left"
                    >
                      <div className="flex items-baseline justify-between mb-1">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {phase.label}
                        </h3>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          Days {phase.dayRange}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                        {phase.category}
                      </p>
                      <div className="space-y-3 divide-y divide-slate-200/70 dark:divide-slate-700/70">
                        {phase.tasks.map((task, idx) => (
                          <div
                            key={`${phase.label}-${idx}`}
                            className="pt-3 first:pt-0 text-xs text-slate-700 dark:text-slate-300"
                          >
                            <p className="font-semibold mb-0.5">{task.technicalAction}</p>
                            <p className="text-slate-600 dark:text-slate-400 mb-0.5">
                              {task.businessImpact}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Effect: {task.estimatedImprovementEffect}
                            </p>
                          </div>
                        ))}
                      </div>
                    </AxiomCard>
                  ))}
                </div>
              </AxiomSection>
            )}

            {activeTab === "playbooks" && (
              <AxiomSection className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Playbooks
                </h2>
                {status.playbooks ? (
                  <>
                    {status.quality && (
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${status.quality.pass ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"}`}>
                        {status.quality.pass ? "Quality Gate: Passed" : "Quality Gate: Needs review"}
                      </div>
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Estimated effort: {status.playbooks.estimatedEffortHours} hours
                    </p>
                    <div className="space-y-4">
                      {status.playbooks.phasePlaybooks.map((pp) => (
                        <AxiomCard key={pp.phaseName} className="p-5 bg-slate-50 dark:bg-slate-900/40">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">{pp.phaseName}</h3>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">{pp.objective}</p>
                          <ol className="list-decimal list-inside text-xs text-slate-700 dark:text-slate-300 space-y-1">
                            {pp.stepByStep.map((s, i) => (
                              <li key={i}>{s.step}</li>
                            ))}
                          </ol>
                        </AxiomCard>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    {status.playbookPreview && status.playbookPreview.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-600 dark:text-slate-400">Preview (first 3 steps):</p>
                        <ol className="list-decimal list-inside text-xs text-slate-700 dark:text-slate-300 space-y-1">
                          {status.playbookPreview.map((s, i) => (
                            <li key={i}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    {status.playbookUpsell && (
                      <p className="text-xs text-slate-600 dark:text-slate-400">{status.playbookUpsell}</p>
                    )}
                  </>
                )}
              </AxiomSection>
            )}

            {activeTab === "strategic" && (
              <StrategicTab token={token} status={status} />
            )}

            {activeTab === "trends" && (
              <AxiomSection className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Trends</h2>
                {status?.trendHistory && Array.isArray(status.trendHistory) && status.trendHistory.length > 0 ? (
                  <div className="space-y-3">
                    {status.trendHistory.map((t) => (
                      <AxiomCard key={t.id} className="p-4">
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.createdAt}</p>
                        <p className="text-sm text-slate-900 dark:text-slate-100">
                          Score: {t.infrastructureScore ?? "—"} · Savings: {t.estimatedAnnualSavings != null ? `$${t.estimatedAnnualSavings.toLocaleString()}` : "—"}
                        </p>
                      </AxiomCard>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-600 dark:text-slate-400">Trend history available for Growth+ tier with reassessment data.</p>
                )}
              </AxiomSection>
            )}

            {activeTab === "export" && (
              <AxiomSection className="space-y-6">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Export</h2>
                <AxiomCard className="p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Download Export Pack</h3>
                  {status?.canDownloadConfigs ? (
                    <a
                      href={`/api/cloud-operator/export?token=${encodeURIComponent(token ?? "")}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4" />
                      Download Export Pack
                    </a>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-400">Upgrade to Pro+ to download.</p>
                  )}
                </AxiomCard>
                {status?.canDownloadConfigs && status.launch && (
                  <AxiomCard className="p-5">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Download configs</h3>
                    <div className="flex flex-wrap gap-2">
                      {status.launch.ciCdYaml && (
                        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(status.launch.ciCdYaml)}`} download="operator-ci-cd.yml" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs">CI/CD YAML</a>
                      )}
                      {status.launch.dockerfile && (
                        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(status.launch.dockerfile)}`} download="Dockerfile" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs">Dockerfile</a>
                      )}
                      {status.launch.terraformTemplates && status.launch.terraformTemplates.length > 0 && (
                        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(status.launch.terraformTemplates.join("\n\n"))}`} download="operator-terraform.tf" className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs">Terraform</a>
                      )}
                    </div>
                  </AxiomCard>
                )}
                {status?.simulation && status.canViewTechnicalOutputs && (
                  <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Impact Forecast</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Score lift: +{status.simulation.scoreLift.min}–{status.simulation.scoreLift.max} pts · Savings: ${status.simulation.savingsLift.min.toLocaleString()}–${status.simulation.savingsLift.max.toLocaleString()}
                    </p>
                  </AxiomCard>
                )}
              </AxiomSection>
            )}

            {activeTab === "connectors" && (
              <AxiomSection className="space-y-6">
                <div className="rounded-2xl border-2 border-violet-200/80 dark:border-violet-700/50 bg-gradient-to-br from-violet-50/60 to-indigo-50/40 dark:from-violet-950/30 dark:to-indigo-950/20 p-6 mb-6">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">Connect your environment via APIs</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl mb-4">
                    Link AWS, Azure, GCP, or GitHub with read-only credentials. Axiom fetches real inventory, cost data, and config—so AI analyzes your actual environment, not just forms. More accurate scores, tailored recommendations, drift detection.
                  </p>
                  <Link
                    href="/contact?subject=Connect+Cloud+APIs+%28Axiom%29"
                    className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
                  >
                    Get connector access (Growth+)
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>
                </div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Supported connectors</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <AxiomCard className="p-5 border-l-4 border-l-orange-500">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">AWS</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Account metadata, resource inventory, cost data</p>
                  </AxiomCard>
                  <AxiomCard className="p-5 border-l-4 border-l-blue-500">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">Azure</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Subscription, resource groups, compliance posture</p>
                  </AxiomCard>
                  <AxiomCard className="p-5 border-l-4 border-l-red-500">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">GCP</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Project metadata, billing, asset inventory</p>
                  </AxiomCard>
                  <AxiomCard className="p-5 border-l-4 border-l-slate-600">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">GitHub</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Repos, CI/CD workflows, deployment patterns</p>
                  </AxiomCard>
                </div>
                <RunScanCard token={token} />
                <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    API: POST /api/connectors/link to link. GET /api/connectors/status for status. All connectors are read-only.
                  </p>
                </AxiomCard>
              </AxiomSection>
            )}

            {activeTab === "overview" && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <AxiomCard className="p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Download Export Pack
                  </h3>
                  {status?.canDownloadConfigs ? (
                    <a
                      href={`/api/cloud-operator/export?token=${encodeURIComponent(token ?? "")}`}
                      className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all duration-200"
                    >
                      <DocumentArrowDownIcon className="h-4 w-4" />
                      Download Export Pack
                    </a>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        Upgrade to Roadmap (Pro+) or unlock for this report:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href="/contact?intent=axiom-upgrade"
                          className="inline-flex items-center gap-2 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50"
                        >
                          Upgrade
                        </Link>
                        <a
                          href={`/contact?intent=roadmap-unlock&token=${encodeURIComponent(token ?? "")}`}
                          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                        >
                          $29 Full Roadmap Unlock
                        </a>
                      </div>
                    </div>
                  )}
                </AxiomCard>

                <AxiomCard className="p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Download configurations
                  </h3>
                  {status?.canDownloadConfigs && status.launch ? (
                    <div className="flex flex-wrap gap-2">
                      {status.launch.ciCdYaml && (
                        <a
                          href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                            status.launch.ciCdYaml
                          )}`}
                          download="operator-ci-cd.yml"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <DocumentArrowDownIcon className="h-4 w-4" />
                          CI/CD YAML
                        </a>
                      )}
                      {status.launch.dockerfile && (
                        <a
                          href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                            status.launch.dockerfile
                          )}`}
                          download="Dockerfile"
                          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                        >
                          <DocumentArrowDownIcon className="h-4 w-4" />
                          Dockerfile
                        </a>
                      )}
                      {status.launch.terraformTemplates &&
                        status.launch.terraformTemplates.length > 0 && (
                          <a
                            href={`data:text/plain;charset=utf-8,${encodeURIComponent(
                              status.launch.terraformTemplates.join("\n\n")
                            )}`}
                            download="operator-terraform.tf"
                            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4" />
                            Terraform templates
                          </a>
                        )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Downloadable configs unlock on Pro, Growth, or Enterprise tiers.
                    </p>
                  )}
                </AxiomCard>

                {status?.simulation && status.canViewTechnicalOutputs && (
                  <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Impact Forecast
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Estimated impact from executing the 30-day plan (deterministic simulation).
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Score lift:</span>{" "}
                        +{status.simulation.scoreLift.min}–{status.simulation.scoreLift.max} pts
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Savings lift:</span>{" "}
                        ${status.simulation.savingsLift.min.toLocaleString()}–$
                        {status.simulation.savingsLift.max.toLocaleString()}
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Risk reduction:</span>{" "}
                        {status.simulation.riskReduction.min}–{status.simulation.riskReduction.max}%
                      </div>
                      <div>
                        <span className="text-slate-500 dark:text-slate-400">Friction lift:</span>{" "}
                        {status.simulation.frictionLift.min}–{status.simulation.frictionLift.max} pts
                      </div>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Confidence: {status.simulation.confidence}
                    </p>
                  </AxiomCard>
                )}
                {!status?.canViewTechnicalOutputs && status?.outputStatus === "ready" && (
                  <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Impact Forecast
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Upgrade to Pro+ to see simulation of expected score, savings, and risk impact.
                    </p>
                  </AxiomCard>
                )}

                <AxiomCard className="p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Request automation
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    The Operator has prepared your automation. When you&apos;re ready, we can help
                    implement it in your cloud accounts.
                  </p>
                  <AxiomButton href="/contact" variant="primary" className="text-xs px-4 py-2">
                    Talk to the team
                    <ArrowRightIcon className="h-3 w-3" />
                  </AxiomButton>
                </AxiomCard>

                {status?.enterpriseBriefPreview && !status?.hasEnterpriseEngagement && (
                  <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/50">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Enterprise Readiness Brief (Preview)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                      Top risks: {status.enterpriseBriefPreview.biggestRiskExposures.slice(0, 2).join("; ")}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                      Top savings: {status.enterpriseBriefPreview.biggestSavingsLevers.slice(0, 2).join("; ")}
                    </p>
                    <Link
                      href="/contact?intent=enterprise-brief"
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                    >
                      {status.enterpriseBriefPreview.cta}
                      <ArrowRightIcon className="h-3 w-3" />
                    </Link>
                  </AxiomCard>
                )}
                <RequestImplementationCard token={token ?? ""} />
              </div>

              <div className="space-y-4">
                <AxiomAIVision />
                <AxiomCard className="p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Upgrade plan
                  </h3>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 mb-3">
                    <li>
                      <strong>Analysis</strong> (free): Summary dashboard only.
                    </li>
                    <li>
                      <strong>Roadmap</strong> (pro): Full technical outputs, configs, savings breakdown.
                    </li>
                    <li>
                      <strong>Automation Signals</strong> (growth): Drift detection, trend history.
                    </li>
                    <li>
                      <strong>Strategic Advisory</strong> (enterprise): Policy packs, enterprise brief.
                    </li>
                  </ul>
                  <Link
                    href="/auth/signin?callbackUrl=/cloud-operator"
                    className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    Upgrade
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                  <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                    Or <Link href="/contact?intent=axiom-upgrade" className="underline">Contact Sales</Link>
                  </p>
                </AxiomCard>
              </div>
            </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

export default function CloudOperatorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <Navigation />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Loading Axiom AI cloud analysis…
              </p>
              <div className="flex gap-2">
                <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs">AWS</span>
                <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs">Azure</span>
                <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-3 py-1 text-xs">GCP</span>
              </div>
            </div>
          </main>
        </div>
      }
    >
      <CloudOperatorPageInner />
    </Suspense>
  );
}


