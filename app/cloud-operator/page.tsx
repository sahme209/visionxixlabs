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
  DocumentArrowDownIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";

type OperatorStatus = {
  outputStatus?: string;
  tier?: string;
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
  businessImpactSummary?: string;
  recommendedNextAction?: string;
  canViewTechnicalOutputs?: boolean;
  canDownloadConfigs?: boolean;
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

  useEffect(() => {
    if (tokenFromUrl && tokenFromUrl !== token) {
      setToken(tokenFromUrl);
    }
  }, [tokenFromUrl, token]);

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
    };

    const tier = fd.get("tier")?.toString() || "free";
    const email = fd.get("email")?.toString()?.trim() || "";
    const name = fd.get("name")?.toString()?.trim() || "";

    try {
      const res = await fetch("/api/cloud-operator/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operatorProfile,
          tier,
          email,
          name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit");
      }
      const t = encodeURIComponent(data.token);
      window.location.href = `/cloud-operator?token=${t}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inDashboard = !!token;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
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
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-3">
            <CloudIcon className="h-4 w-4" />
            AI Cloud Operator™
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-slate-100 mb-3">
            One operator for cloud architecture, cost, security, and CI/CD.
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl">
            Not a website builder. Not a consulting portal. A single AI Cloud Operator that
            asks structured questions, understands your infrastructure intent, and generates
            deployment-ready configurations you can review and execute.
          </p>
        </section>

        {inDashboard && status && (
          <section className="mb-8">
            <div className="grid md:grid-cols-6 gap-3">
              <div className="rounded-xl bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Infrastructure Score
                </p>
                <p className="mt-2 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">
                  {status.infrastructureScore ?? status.infrastructureReadinessScore ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Estimated Savings
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {status.axiomEstimatedAnnualSavings != null
                    ? `$${status.axiomEstimatedAnnualSavings.toLocaleString()}`
                    : status.estimatedAnnualSavings != null
                    ? `$${status.estimatedAnnualSavings.toLocaleString()}`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Risk Level
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {status.riskExposureLevel ?? status.securityRiskLevel ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Friction Index
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {status.deploymentFrictionIndex != null
                    ? `${status.deploymentFrictionIndex}/100`
                    : "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Complexity Tier
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {status.complexityTier ?? status.architectureComplexity ?? "—"}
                </p>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-900 shadow border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  Automation Readiness
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {status.automationReadinessScore != null
                    ? `${status.automationReadinessScore}/100`
                    : "—"}
                </p>
              </div>
            </div>
          </section>
        )}

        {!inDashboard && (
          <section className="grid lg:grid-cols-3 gap-8 items-start">
            <form
              onSubmit={handleSubmit}
              className="lg:col-span-2 space-y-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-8"
            >
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Tell the Operator what you&apos;re running
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                These questions stay the same for every organization. The Operator turns them
                into architecture, CI/CD, cost, and security plans.
              </p>

              {error && (
                <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-sm text-rose-700 dark:text-rose-200">
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
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
                        className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
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
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
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
                          className="flex-1 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
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
                      <label className="flex-1 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200">
                        <input type="radio" name="hasCiCd" value="yes" className="sr-only" required />
                        <span className="text-slate-800 dark:text-slate-100">Yes</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-rose-500 has-[:checked]:ring-2 has-[:checked]:ring-rose-200">
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
                          className="flex-1 flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
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
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
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
                      className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
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
                        className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
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
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Choose your Operator tier
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {OPERATOR_TIERS.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 px-3 py-3 text-xs sm:text-sm cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
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

              <div className="pt-4 border-t border-slate-200 dark:border-slate-700 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Work email (optional)
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
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
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-slate-500 dark:text-slate-500 max-w-sm">
                  Phase 1: the Operator only generates plans and configurations. It never
                  auto-executes infrastructure changes.
                </p>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 hover:bg-slate-800 disabled:opacity-60"
                >
                  <BoltIcon className="h-4 w-4" />
                  {submitting ? "Sending to Operator..." : "Run AI Cloud Operator"}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            </form>

            <aside className="space-y-4">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                  <ChartBarIcon className="h-4 w-4 text-indigo-500" />
                  What the Operator returns
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                  <li>Infrastructure readiness, cost, security, CI/CD, and complexity scores</li>
                  <li>Architecture, CI/CD YAML, Dockerfile, and deployment steps</li>
                  <li>Cost breakdown, savings estimates, and optimization levers</li>
                  <li>Security risks, IAM and network hardening recommendations</li>
                  <li>Business impact summary and implementation effort estimate</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100 p-5">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
                  Automation safety, by default
                </h3>
                <p className="text-xs text-slate-300 mb-3">
                  Phase 1 of AI Cloud Operator only prepares automation. You choose if and how to
                  execute changes in your environment.
                </p>
                <button
                  type="button"
                  disabled
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-[11px] text-slate-300 cursor-not-allowed"
                >
                  <BoltIcon className="h-3 w-3 text-amber-400" />
                  Execute with Operator (coming soon)
                </button>
              </div>
            </aside>
          </section>
        )}

        {inDashboard && (
          <section className="space-y-8">
            <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-8">
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

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Business impact summary
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                      {status?.businessImpactSummary || "Operator summary will appear here."}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Recommended next action
                    </h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      {status?.recommendedNextAction || "Next actions will appear here."}
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 p-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Recommended improvements
                  </h3>
                  <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1.5">
                    {status?.recommendedImprovements && status.recommendedImprovements.length > 0 ? (
                      status.recommendedImprovements.map((item, idx) => (
                        <li key={`${item}-${idx}`} className="flex gap-2">
                          <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                          <span>{item}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500 dark:text-slate-400">
                        Operator recommendations will appear here.
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {status?.axiomPlan && (
              <div className="rounded-2xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                    30-Day Infrastructure Optimization Plan
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Structured by Axiom — Autonomous Infrastructure Intelligence Platform
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Executive Summary
                    </h3>
                    <ul className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                      <li>
                        <span className="font-semibold">Infrastructure Score:</span>{" "}
                        {status.axiomPlan.executiveSummary.infrastructureScore}
                      </li>
                      <li>
                        <span className="font-semibold">Estimated Annual Savings:</span>{" "}
                        {status.axiomPlan.executiveSummary.estimatedAnnualSavings != null
                          ? `$${status.axiomPlan.executiveSummary.estimatedAnnualSavings.toLocaleString()}`
                          : "—"}
                      </li>
                      <li>
                        <span className="font-semibold">Risk Exposure Level:</span>{" "}
                        {status.axiomPlan.executiveSummary.riskExposureLevel}
                      </li>
                      <li>
                        <span className="font-semibold">Complexity Tier:</span>{" "}
                        {status.axiomPlan.executiveSummary.complexityTier}
                      </li>
                      <li>
                        <span className="font-semibold">Deployment Friction Index:</span>{" "}
                        {status.axiomPlan.executiveSummary.deploymentFrictionIndex}
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                      Prioritized Categories
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
                      <div>
                        <p className="font-semibold mb-1">Critical</p>
                        <ul className="space-y-1">
                          {status.axiomPlan.prioritizedCategories.critical.map((task, idx) => (
                            <li key={`critical-${idx}`}>{task.technicalAction}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold mb-1">High Impact</p>
                        <ul className="space-y-1">
                          {status.axiomPlan.prioritizedCategories.highImpact.map((task, idx) => (
                            <li key={`high-${idx}`}>{task.technicalAction}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    status.axiomPlan.timeSequencedPlan.stabilization,
                    status.axiomPlan.timeSequencedPlan.costOptimization,
                    status.axiomPlan.timeSequencedPlan.deploymentAcceleration,
                    status.axiomPlan.timeSequencedPlan.scalabilityHardening,
                  ].map((phase) => (
                    <div
                      key={phase.label}
                      className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4"
                    >
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                        {phase.label}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                        Days {phase.dayRange} · {phase.category}
                      </p>
                      <ul className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
                        {phase.tasks.map((task, idx) => (
                          <li key={`${phase.label}-${idx}`} className="border-l border-slate-300 dark:border-slate-600 pl-2">
                            <p className="font-semibold">{task.technicalAction}</p>
                            <p className="text-slate-600 dark:text-slate-400">
                              {task.businessImpact}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              Effect: {task.estimatedImprovementEffect}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
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
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Request automation
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                    The Operator has prepared your automation. When you&apos;re ready, we can help
                    implement it in your cloud accounts.
                  </p>
                  <Link
                    href="/contact"
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 text-white text-xs font-semibold px-4 py-2 hover:bg-slate-800"
                  >
                    Talk to the team
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                    Upgrade plan
                  </h3>
                  <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 mb-3">
                    <li>
                      <strong>Free</strong>: Summary dashboard only.
                    </li>
                    <li>
                      <strong>Pro</strong>: Full technical outputs, configs, savings breakdown,
                      business impact report.
                    </li>
                    <li>
                      <strong>Growth</strong>: Adds continuous reassessment and advanced
                      optimization logic.
                    </li>
                    <li>
                      <strong>Enterprise</strong>: Strategic engagement and dedicated automation
                      implementation.
                    </li>
                  </ul>
                  <Link
                    href="/request"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Discuss Operator pricing
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            </div>
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
          <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Loading Axiom cloud-operator analysis…
            </p>
          </main>
        </div>
      }
    >
      <CloudOperatorPageInner />
    </Suspense>
  );
}


