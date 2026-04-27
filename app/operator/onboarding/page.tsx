"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CloudIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

type OnboardingStep = 1 | 2 | 3 | 4;

type CloudProvider = "aws" | "azure" | "gcp";

const providerConfig: Record<CloudProvider, { name: string; color: string; description: string }> = {
  aws: { name: "Amazon Web Services", color: "from-orange-500 to-amber-500", description: "Most popular. Connect via IAM Role." },
  azure: { name: "Microsoft Azure", color: "from-blue-500 to-cyan-500", description: "Connect via Service Principal." },
  gcp: { name: "Google Cloud Platform", color: "from-red-500 to-pink-500", description: "Connect via Service Account." },
};

function StepIndicator({ current }: { current: OnboardingStep }) {
  const labels = ["Account", "Connect Cloud", "Analyze", "Your Report"];
  return (
    <div className="flex items-center justify-center gap-2 mb-12">
      {labels.map((label, i) => {
        const stepNum = (i + 1) as OnboardingStep;
        const isActive = stepNum === current;
        const isDone = stepNum < current;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              isActive ? "bg-violet-500/20 text-violet-300 border border-violet-500/30" :
              isDone ? "bg-emerald-500/10 text-emerald-400" :
              "text-slate-600"
            }`}>
              {isDone ? (
                <CheckCircleIcon className="h-3.5 w-3.5" />
              ) : (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-500"
                }`}>{stepNum}</span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < 3 && <div className={`w-8 h-px ${isDone ? "bg-emerald-500/30" : "bg-slate-800"}`} />}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>(1);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!selectedProvider) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/cloud-operator/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedProvider }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Connection failed");
        return;
      }
      setToken(data.token ?? null);
      setConnected(true);
      setStep(3);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!token) {
      setError("No session token. Please reconnect.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/architecture/analyze?token=${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Analysis failed");
        return;
      }
      setStep(4);
      setTimeout(() => {
        router.push(`/dashboard/resilience?token=${token}`);
      }, 2000);
    } catch {
      setError("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <nav className="border-b border-slate-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/operator" className="flex items-center gap-2">
            <CpuChipIcon className="h-6 w-6 text-violet-400" />
            <span className="font-bold">Cloud Operator</span>
          </Link>
          <span className="text-sm text-slate-500">Setup</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <StepIndicator current={step} />

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Reveal>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-6">
                <ShieldCheckIcon className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3">Welcome to Cloud Operator</h1>
              <p className="text-slate-400 mb-8 max-w-md mx-auto">
                In the next few minutes, we&apos;ll scan your cloud, score your resilience, and show you exactly how to protect against provider outages.
              </p>
              <div className="space-y-3 text-left max-w-sm mx-auto mb-8">
                {[
                  "Connect your cloud account (read-only)",
                  "AI analyzes your infrastructure",
                  "Get your resilience score and action plan",
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-slate-300">
                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">{i + 1}</span>
                    {item}
                  </div>
                ))}
              </div>
              <AnimatedButton onClick={() => setStep(2)} variant="primary" className="px-8 py-3">
                Get Started
                <ArrowRightIcon className="h-4 w-4" />
              </AnimatedButton>
            </div>
          </Reveal>
        )}

        {/* Step 2: Connect Cloud */}
        {step === 2 && (
          <Reveal>
            <div>
              <button onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-300 mb-6">
                <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
              </button>
              <h1 className="text-2xl font-bold mb-2">Connect your cloud</h1>
              <p className="text-slate-400 mb-8">
                Choose your primary cloud provider. We use read-only access to scan your infrastructure safely.
              </p>

              <div className="space-y-3 mb-8">
                {(Object.keys(providerConfig) as CloudProvider[]).map((p) => {
                  const config = providerConfig[p];
                  const isSelected = selectedProvider === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setSelectedProvider(p)}
                      className={`w-full text-left rounded-xl border p-5 transition-all ${
                        isSelected
                          ? "border-violet-500/50 bg-violet-950/20"
                          : "border-slate-800 bg-slate-900/50 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                          <CloudIcon className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{config.name}</div>
                          <div className="text-xs text-slate-500">{config.description}</div>
                        </div>
                        {isSelected && <CheckCircleIcon className="h-5 w-5 text-violet-400" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 text-xs text-slate-600 mb-6">
                <ShieldCheckIcon className="h-4 w-4" />
                Read-only access. We never modify your infrastructure without approval.
              </div>

              <AnimatedButton
                onClick={handleConnect}
                disabled={!selectedProvider || connecting}
                variant="primary"
                className="w-full justify-center py-3"
              >
                {connecting ? "Connecting..." : "Connect & Continue"}
                <ArrowRightIcon className="h-4 w-4" />
              </AnimatedButton>
            </div>
          </Reveal>
        )}

        {/* Step 3: Analyze */}
        {step === 3 && (
          <Reveal>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center mx-auto mb-6">
                <CheckCircleIcon className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Cloud connected</h1>
              <p className="text-slate-400 mb-8">
                Your {selectedProvider?.toUpperCase()} account is linked. Now let&apos;s scan your infrastructure and generate your resilience report.
              </p>

              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 mb-8 text-left">
                <h3 className="text-sm font-semibold text-slate-300 mb-3">What happens next:</h3>
                <div className="space-y-2 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                    Discover all resources (VMs, storage, networking, databases)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    Run security scan (public access, encryption, IAM exposure)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                    AI generates architecture recommendation
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Calculate resilience score (0-100)
                  </div>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4">
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <AnimatedButton
                onClick={handleAnalyze}
                disabled={analyzing}
                variant="primary"
                className="px-8 py-3"
              >
                {analyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scanning infrastructure...
                  </>
                ) : (
                  <>
                    Run Analysis
                    <ChartBarIcon className="h-4 w-4" />
                  </>
                )}
              </AnimatedButton>

              {analyzing && (
                <p className="text-xs text-slate-500 mt-4">
                  This typically takes 30-60 seconds. We&apos;re scanning your resources and running AI analysis.
                </p>
              )}
            </div>
          </Reveal>
        )}

        {/* Step 4: Done — redirect to report */}
        {step === 4 && (
          <Reveal>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-6">
                <ChartBarIcon className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold mb-2">Your report is ready</h1>
              <p className="text-slate-400 mb-8">
                Redirecting you to your resilience dashboard...
              </p>
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
