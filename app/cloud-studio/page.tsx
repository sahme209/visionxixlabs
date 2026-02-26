"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CodeBracketIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  CubeIcon,
  ServerStackIcon,
  EnvelopeIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { CLOUD_STUDIO_SERVICE_TYPES, CLOUD_STUDIO_TIERS } from "@/lib/cloudStudio/types";

const SERVICE_OPTIONS: { id: (typeof CLOUD_STUDIO_SERVICE_TYPES)[number]; label: string; icon: React.ElementType }[] = [
  { id: "cicd", label: "CI/CD Pipeline Setup", icon: CodeBracketIcon },
  { id: "cost", label: "Cloud Cost Optimization", icon: CurrencyDollarIcon },
  { id: "security", label: "Security Hardening", icon: ShieldCheckIcon },
  { id: "architecture", label: "Infrastructure Architecture Design", icon: CubeIcon },
  { id: "networking", label: "Networking Setup", icon: ServerStackIcon },
];

const GIT_PROVIDERS = ["GitHub", "GitLab", "Bitbucket", "Other"];
const LANG_FRAMEWORKS = ["Node.js", "Python", "Go", "Java", "Ruby", "Next.js", "React", "Other"];
const DEPLOY_TARGETS = ["Vercel", "AWS", "Azure", "GCP", "Kubernetes", "Docker", "Other"];
const CLOUD_PROVIDERS = ["AWS", "Azure", "GCP"];
const APP_TYPES = ["Web app", "API", "Microservices", "Mixed"];

export default function CloudStudioPage() {
  const [serviceType, setServiceType] = useState<(typeof CLOUD_STUDIO_SERVICE_TYPES)[number]>("cicd");
  const [tier, setTier] = useState<"free" | "professional" | "enterprise">("free");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    const form: Record<string, unknown> = {};
    if (serviceType === "cicd") {
      form.gitProvider = fd.get("gitProvider")?.toString() || "";
      form.languageFramework = fd.get("languageFramework")?.toString() || "";
      form.deploymentTarget = fd.get("deploymentTarget")?.toString() || "";
      form.repoUrl = fd.get("repoUrl")?.toString() || "";
      form.envVars = fd.get("envVars")?.toString() || "";
    } else if (serviceType === "cost") {
      form.cloudProvider = fd.get("cloudProvider")?.toString() || "";
      form.servicesUsed = fd.get("servicesUsed")?.toString() || "";
      form.estimatedMonthlySpend = fd.get("estimatedMonthlySpend")?.toString() || "";
      form.region = fd.get("region")?.toString() || "";
      form.billingExportNote = fd.get("billingExportNote")?.toString() || "";
    } else if (serviceType === "security") {
      form.cloudProvider = fd.get("cloudProvider")?.toString() || "";
      form.publicServices = fd.get("publicServices")?.toString() || "";
      form.complianceGoal = fd.get("complianceGoal")?.toString() || "";
    } else if (serviceType === "architecture") {
      form.cloudProvider = fd.get("cloudProvider")?.toString() || "";
      form.appType = fd.get("appType")?.toString() || "";
      form.trafficEstimate = fd.get("trafficEstimate")?.toString() || "";
      form.dataStorageNeeds = fd.get("dataStorageNeeds")?.toString() || "";
    } else if (serviceType === "networking") {
      form.cloudProvider = fd.get("cloudProvider")?.toString() || "";
      form.vpcRequirements = fd.get("vpcRequirements")?.toString() || "";
      form.connectivity = fd.get("connectivity")?.toString() || "";
      form.region = fd.get("region")?.toString() || "";
    }

    try {
      const res = await fetch("/api/cloud-studio/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType,
          form,
          tier,
          email: fd.get("email")?.toString()?.trim() || "",
          name: fd.get("name")?.toString()?.trim() || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      const token = encodeURIComponent(data.token);
      window.location.href = `/cloud-studio/result?token=${token}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 mb-8"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Home
        </Link>
        <div className="mb-6 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/60 dark:bg-indigo-900/30 p-4">
          <p className="text-xs font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
            Cloud Studio is legacy service-mode analysis.
          </p>
          <p className="text-xs text-indigo-900/80 dark:text-indigo-200 mb-3">
            For full Infrastructure Advantage Model™ scoring and a 30-day roadmap, use Axiom.
          </p>
          <Link
            href="/cloud-operator"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Run Axiom
            <ArrowLeftIcon className="h-3 w-3 rotate-180" />
          </Link>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
          <header className="mb-8 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-4 py-2 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-4">
              AI Cloud Studio
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Cloud automation, designed by AI
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Get CI/CD, cost optimization, security, architecture, or networking blueprints. No auto-execution—review and request implementation when ready.
            </p>
          </header>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Service type
              </label>
              <div className="space-y-2">
                {SERVICE_OPTIONS.map((opt) => (
                  <label
                    key={opt.id}
                    className="flex items-center gap-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 cursor-pointer hover:border-indigo-400 has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200"
                  >
                    <input
                      type="radio"
                      name="serviceType"
                      value={opt.id}
                      checked={serviceType === opt.id}
                      onChange={() => setServiceType(opt.id)}
                      className="sr-only"
                    />
                    <opt.icon className="h-5 w-5 text-indigo-600" />
                    <span className="font-medium text-slate-900 dark:text-slate-100">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {serviceType === "cicd" && (
              <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">CI/CD details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Git provider</label>
                    <select name="gitProvider" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                      {GIT_PROVIDERS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Language / framework</label>
                    <select name="languageFramework" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                      {LANG_FRAMEWORKS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Deployment target</label>
                    <select name="deploymentTarget" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                      {DEPLOY_TARGETS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Repo URL (optional)</label>
                    <input name="repoUrl" type="url" placeholder="https://github.com/..." className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Environment variables (optional, describe)</label>
                  <textarea name="envVars" rows={2} placeholder="e.g. API_KEY, DATABASE_URL" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                </div>
              </div>
            )}

            {serviceType === "cost" && (
              <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Cost optimization details</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Cloud provider</label>
                    <select name="cloudProvider" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                      {CLOUD_PROVIDERS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Region</label>
                    <input name="region" type="text" required placeholder="e.g. us-east-1" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Services used</label>
                    <input name="servicesUsed" type="text" required placeholder="e.g. EC2, RDS, S3" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Estimated monthly spend ($)</label>
                    <input name="estimatedMonthlySpend" type="text" required placeholder="e.g. 500" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Billing export (optional note)</label>
                    <input name="billingExportNote" type="text" placeholder="e.g. CSV uploaded" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
              </div>
            )}

            {serviceType === "security" && (
              <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Security hardening details</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Cloud provider</label>
                    <select name="cloudProvider" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                      {CLOUD_PROVIDERS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Public-facing services</label>
                    <input name="publicServices" type="text" required placeholder="e.g. API, web app" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Compliance goal</label>
                    <input name="complianceGoal" type="text" required placeholder="e.g. SOC 2, HIPAA" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
              </div>
            )}

            {serviceType === "architecture" && (
              <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Architecture details</h3>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Cloud provider</label>
                      <select name="cloudProvider" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                        {CLOUD_PROVIDERS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">App type</label>
                      <select name="appType" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                        {APP_TYPES.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Traffic estimate</label>
                    <input name="trafficEstimate" type="text" required placeholder="e.g. 10k req/day" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Data storage needs</label>
                    <textarea name="dataStorageNeeds" rows={2} required placeholder="e.g. PostgreSQL, S3 for assets" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
              </div>
            )}

            {serviceType === "networking" && (
              <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">Networking details</h3>
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Cloud provider</label>
                      <select name="cloudProvider" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100">
                        {CLOUD_PROVIDERS.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Region</label>
                      <input name="region" type="text" required placeholder="e.g. us-east-1" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">VPC requirements</label>
                    <textarea name="vpcRequirements" rows={2} required placeholder="e.g. public/private subnets, NAT" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="text-sm text-slate-600 dark:text-slate-400 mb-1 block">Connectivity (peering, VPN)</label>
                    <input name="connectivity" type="text" required placeholder="e.g. VPC peering to on-prem" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
                  </div>
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <UserIcon className="h-4 w-4" /> Name (optional)
                </label>
                <input name="name" type="text" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  <EnvelopeIcon className="h-4 w-4" /> Email (optional)
                </label>
                <input name="email" type="email" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-900 dark:text-slate-100" />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">Output tier</label>
              <div className="space-y-2">
                {Object.values(CLOUD_STUDIO_TIERS).map((t) => (
                  <label key={t.id} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer has-[:checked]:border-indigo-500 has-[:checked]:ring-2 has-[:checked]:ring-indigo-200">
                    <input
                      type="radio"
                      name="tier"
                      value={t.id}
                      checked={tier === t.id}
                      onChange={() => setTier(t.id)}
                      className="mt-1"
                    />
                    <div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">{t.name}</span>
                      {t.id === "professional" && (
                        <span className="ml-2 text-indigo-600 dark:text-indigo-400 text-sm">
                          $99–$299 per service
                        </span>
                      )}
                      {t.id === "enterprise" && (
                        <span className="ml-2 text-slate-500 dark:text-slate-400 text-sm">Custom</span>
                      )}
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/30 px-4 py-3 text-sm text-red-800 dark:text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Submitting...
                </>
              ) : (
                "Generate AI output"
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
