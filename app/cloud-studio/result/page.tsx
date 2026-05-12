"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  DocumentArrowDownIcon,
  WrenchScrewdriverIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

export default function CloudStudioResultPage() {
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await fetch(`/api/cloud-studio/status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok) return data;
    } catch {
      // ignore
    }
    return null;
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    setToken(t);
    if (!t) return;

    fetch(`/api/cloud-studio/trigger?token=${encodeURIComponent(t)}`, { method: "POST" }).catch(() => {});

    fetchStatus().then((d) => {
      if (d) setStatus(d);
      if (d?.outputStatus !== "ready") setPolling(true);
    });

    const interval = setInterval(async () => {
      const d = await fetchStatus();
      if (d) setStatus(d);
      if (d?.outputStatus === "ready") setPolling(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [token, fetchStatus]);

  if (!token) {
    return (
      <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
        <div className="bg-dots absolute inset-0 pointer-events-none" />
        <Navigation />
        <main className="relative z-10 max-w-2xl mx-auto px-4 py-24 text-center">
          <p className="text-zinc-400 mb-4">Invalid or missing token. Please start from AI Cloud Studio.</p>
          <Link href="/cloud-studio" className="text-violet-400 hover:underline">
            Go to AI Cloud Studio
          </Link>
        </main>
      </div>
    );
  }

  const outputStatus = status?.outputStatus as string | undefined;
  const summary = status?.summary as string | undefined;
  const fullOutput = status?.fullOutput as string | undefined;
  const artifacts = status?.artifacts as { name: string; content: string; type: string }[] | undefined;
  const canViewFull = status?.canViewFullOutput === true;
  const canDownload = status?.canDownload === true;
  const serviceType = status?.serviceType as string | undefined;
  const tier = status?.tier as string | undefined;
  const cloudIntelligence = status?.cloudIntelligence as {
    cloudMaturityScore?: number;
    optimizationOpportunity?: string;
    riskLevel?: string;
    estimatedAnnualSavings?: number | null;
    complexityTier?: string;
  } | null | undefined;
  const segment = cloudIntelligence?.complexityTier ?? "Self-Serve";

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-25 pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />

      <Navigation />
      <main className="relative z-10 max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Reveal direction="up" blur delay={0.05}>
          <Link
            href="/cloud-studio"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-violet-400 mb-8 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Back to AI Cloud Studio
          </Link>
        </Reveal>

        <Reveal direction="up" blur delay={0.1}>
          <div className="mb-6 glass-card rounded-2xl p-4 border-violet-500/20">
            <p className="text-xs font-semibold text-violet-400 mb-2">
              Want the full unified model?
            </p>
            <p className="text-xs text-zinc-400 mb-3">
              Run Axiom for Infrastructure Advantage Model scoring, 30-day roadmap, playbooks, and deployment hardening.
            </p>
            <Link
              href="/operator/onboarding"
              className="btn-huly cta-glow inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
            >
              Run Axiom Analysis
              <ArrowLeftIcon className="h-3 w-3 rotate-180" />
            </Link>
          </div>
        </Reveal>

        <Reveal direction="up" blur delay={0.15}>
          <div className="glass-card rounded-2xl p-8">
            <div className="text-center mb-8">
              <CheckCircleIcon className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]">
                AI <span className="text-gradient">Cloud Studio</span>
              </h1>
              <p className="text-zinc-400">
                {outputStatus === "ready"
                  ? "Your output is ready below."
                  : outputStatus === "failed"
                  ? "Generation failed. Please try again from the studio."
                  : "Generating your output..."}
              </p>
            </div>

            {!status && (
              <div className="mb-8 glass-card rounded-xl p-6">
                <div className="animate-pulse space-y-4">
                  <div className="h-4 w-40 mx-auto rounded-full bg-zinc-700" />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-16 rounded-xl bg-white/[0.04]" />
                    ))}
                  </div>
                  <p className="text-sm text-zinc-500 mt-4 text-center">
                    Loading your output...
                  </p>
                </div>
              </div>
            )}

            {status && polling && outputStatus !== "ready" && outputStatus !== "failed" && (
              <div className="mb-8 space-y-4">
                <div className="glass-card rounded-xl p-6">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 w-40 mx-auto rounded-full bg-zinc-700" />
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton only
                          key={i}
                          className="h-16 rounded-xl bg-white/[0.04]"
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="glass-card rounded-xl p-6">
                  <div className="animate-pulse space-y-2">
                    <div className="h-3 w-32 rounded-full bg-zinc-700" />
                    <div className="h-3 w-full rounded-full bg-white/[0.04]" />
                    <div className="h-3 w-5/6 rounded-full bg-white/[0.04]" />
                  </div>
                </div>
              </div>
            )}

            {outputStatus === "ready" && summary && (
              <Stagger delay={0.1} interval={0.06}>
                {cloudIntelligence && (
                  <section className="mb-8 glass-card animated-border card-inner-glow rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2 tracking-[-0.04em]">
                      <ChartBarIcon className="h-5 w-5 text-violet-400" />
                      Cloud Intelligence Score
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="rounded-xl bg-white/[0.02] p-4 text-center hover-lift transition-all">
                        <p className="text-2xl font-bold text-violet-400">
                          {cloudIntelligence.cloudMaturityScore ?? 0}
                        </p>
                        <p className="text-xs font-medium text-zinc-500 uppercase mt-1">Maturity Score</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.02] p-4 text-center hover-lift transition-all">
                        <p className="text-lg font-semibold text-white capitalize">
                          {cloudIntelligence.optimizationOpportunity ?? "—"}
                        </p>
                        <p className="text-xs font-medium text-zinc-500 uppercase mt-1">Optimization Opportunity</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.02] p-4 text-center hover-lift transition-all">
                        <p className="text-lg font-semibold text-white capitalize">
                          {cloudIntelligence.riskLevel ?? "—"}
                        </p>
                        <p className="text-xs font-medium text-zinc-500 uppercase mt-1">Risk Level</p>
                      </div>
                      <div className="rounded-xl bg-white/[0.02] p-4 text-center hover-lift transition-all">
                        <p className="text-lg font-semibold text-white">
                          {cloudIntelligence.estimatedAnnualSavings != null
                            ? `$${cloudIntelligence.estimatedAnnualSavings.toLocaleString()}`
                            : "—"}
                        </p>
                        <p className="text-xs font-medium text-zinc-500 uppercase mt-1">Est. Annual Savings</p>
                      </div>
                    </div>
                    <div className="section-divider my-4" />
                    <div className="pt-2">
                      <p className="text-sm font-medium text-zinc-300">
                        Complexity tier: <span className="font-semibold capitalize text-violet-400">{cloudIntelligence.complexityTier ?? "—"}</span>
                      </p>
                    </div>
                    {segment === "Enterprise" && (
                      <div className="mt-4 rounded-lg bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
                        <ExclamationTriangleIcon className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-amber-400">Strategic Optimization Recommended</p>
                          <p className="text-sm text-amber-400/80 mt-1">
                            Your environment indicates enterprise-scale complexity. We recommend a strategic review and implementation support.
                          </p>
                          <Link
                            href="/contact"
                            className="inline-block mt-2 text-sm font-medium text-amber-400 hover:underline"
                          >
                            Schedule strategic review &rarr;
                          </Link>
                        </div>
                      </div>
                    )}
                    {segment === "Self-Serve" && (
                      <div className="mt-4 rounded-lg bg-violet-500/10 border border-violet-500/20 p-4 flex items-start gap-3">
                        <SparklesIcon className="h-5 w-5 text-violet-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-violet-400">Upgrade for more</p>
                          <p className="text-sm text-violet-400/80 mt-1">
                            Get full reports, downloadable artifacts, and implementation support with Professional or Enterprise.
                          </p>
                          <Link
                            href="/contact"
                            className="inline-block mt-2 text-sm font-medium text-violet-400 hover:underline"
                          >
                            See upgrade options &rarr;
                          </Link>
                        </div>
                      </div>
                    )}
                  </section>
                )}

                <section className="mb-8 glass-card card-hover rounded-xl p-6">
                  <h2 className="text-lg font-semibold text-white mb-3 tracking-[-0.04em]">Summary</h2>
                  <p className="text-zinc-300 whitespace-pre-wrap">{summary}</p>
                </section>

                {canViewFull && fullOutput && (
                  <section className="mb-8 glass-card card-hover rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3 tracking-[-0.04em]">Full output</h2>
                    <pre className="text-sm text-zinc-300 overflow-x-auto whitespace-pre-wrap font-mono bg-white/[0.04] p-4 rounded-lg max-h-96 overflow-y-auto">
                      {fullOutput}
                    </pre>
                  </section>
                )}

                {canDownload && artifacts && artifacts.length > 0 && (
                  <section className="mb-8 glass-card card-hover rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-3 tracking-[-0.04em]">Downloadable files</h2>
                    <ul className="space-y-2">
                      {artifacts.map((a) => (
                        <li key={a.name}>
                          <a
                            href={`data:text/plain;charset=utf-8,${encodeURIComponent(a.content)}`}
                            download={a.name}
                            className="inline-flex items-center gap-2 text-violet-400 hover:underline"
                          >
                            <DocumentArrowDownIcon className="h-4 w-4" />
                            {a.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                {tier === "free" && segment !== "Enterprise" && (
                  <section className="mb-8 glass-card glow-border-card rounded-xl p-6">
                    <h2 className="text-lg font-semibold text-white mb-2 tracking-[-0.04em]">
                      Want full output and downloadable files?
                    </h2>
                    <p className="text-sm text-zinc-400 mb-4">
                      Upgrade to Professional ($99-$299 per service) for detailed reports, YAML, Mermaid diagrams, and downloads.
                    </p>
                    <Link
                      href="/contact"
                      className="btn-huly cta-glow inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      Contact for Professional
                    </Link>
                  </section>
                )}

                <section className="glass-card glow-border-card rounded-xl p-6 border-emerald-500/20">
                  <h2 className="text-lg font-semibold text-white mb-2 flex items-center gap-2 tracking-[-0.04em]">
                    <WrenchScrewdriverIcon className="h-5 w-5 text-emerald-500" />
                    Request Implementation
                  </h2>
                  <p className="text-sm text-zinc-400 mb-4">
                    We don&apos;t auto-execute. When you&apos;re ready, we can implement this in your cloud account (Enterprise) or guide you step-by-step.
                  </p>
                  <Link
                    href="/contact"
                    className="btn-huly inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Request Implementation
                  </Link>
                </section>
              </Stagger>
            )}
          </div>
        </Reveal>
      </main>
    </div>
  );
}
