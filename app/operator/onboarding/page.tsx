"use client";

import { useState, useCallback } from "react";
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
  ClipboardDocumentIcon,
  ArrowTopRightOnSquareIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

type OnboardingStep = 1 | 2 | 3 | 4;

type CloudProvider = "aws" | "azure" | "gcp";

type ConnectionPhase = "select" | "setup" | "validate";

const providerConfig: Record<CloudProvider, { name: string; color: string; description: string }> = {
  aws: { name: "Amazon Web Services", color: "from-orange-500 to-amber-500", description: "Connect via read-only IAM Role (recommended)." },
  azure: { name: "Microsoft Azure", color: "from-blue-500 to-cyan-500", description: "Connect via Service Principal." },
  gcp: { name: "Google Cloud Platform", color: "from-red-500 to-pink-500", description: "Connect via Service Account." },
};

const BROKER_ACCOUNT_ID = "590183704419";
const EXTERNAL_ID_PREFIX = "cloudoperator";

function generateExternalId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `${EXTERNAL_ID_PREFIX}-${random}`;
}

const IAM_TRUST_POLICY = (externalId: string) => JSON.stringify({
  Version: "2012-10-17",
  Statement: [{
    Effect: "Allow",
    Principal: { AWS: `arn:aws:iam::${BROKER_ACCOUNT_ID}:root` },
    Action: "sts:AssumeRole",
    Condition: { StringEquals: { "sts:ExternalId": externalId } },
  }],
}, null, 2);

const IAM_PERMISSIONS_POLICY = JSON.stringify({
  Version: "2012-10-17",
  Statement: [{
    Sid: "CloudOperatorReadOnly",
    Effect: "Allow",
    Action: [
      "ec2:Describe*",
      "rds:Describe*",
      "s3:ListAllMyBuckets",
      "s3:GetBucketLocation",
      "s3:GetBucketPolicy",
      "s3:GetBucketAcl",
      "s3:GetEncryptionConfiguration",
      "elasticloadbalancing:Describe*",
      "autoscaling:Describe*",
      "cloudwatch:GetMetricData",
      "cloudwatch:ListMetrics",
      "iam:GetAccountSummary",
      "iam:ListRoles",
      "iam:ListUsers",
      "iam:GetRole",
      "tag:GetResources",
      "sts:GetCallerIdentity",
    ],
    Resource: "*",
  }],
}, null, 2);

function StepIndicator({ current }: { current: OnboardingStep }) {
  const labels = ["Account", "Connect Cloud", "Scan", "Your Report"];
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
              "text-zinc-600"
            }`}>
              {isDone ? (
                <CheckCircleIcon className="h-3.5 w-3.5" />
              ) : (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive ? "bg-violet-500 text-white" : "bg-white/[0.06] text-zinc-500"
                }`}>{stepNum}</span>
              )}
              <span className="hidden sm:inline">{label}</span>
            </div>
            {i < 3 && <div className={`w-8 h-px ${isDone ? "bg-emerald-500/30" : "bg-white/[0.06]"}`} />}
          </div>
        );
      })}
    </div>
  );
}

function CopyBlock({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <button onClick={handleCopy} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-violet-400 transition-colors">
          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-[#09090b] border border-white/[0.06] rounded-lg px-4 py-3 text-xs text-zinc-300 overflow-x-auto font-mono whitespace-pre-wrap break-all">
        {value}
      </pre>
    </div>
  );
}

function AWSSetupInstructions({ externalId }: { externalId: string }) {
  const [showPolicy, setShowPolicy] = useState<"trust" | "permissions" | null>(null);

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-xl border border-white/[0.06] p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <LockClosedIcon className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">How it works</h3>
            <p className="text-xs text-zinc-500">Read-only access via IAM Role</p>
          </div>
        </div>
        <p className="text-sm text-zinc-400 mb-4">
          We use an IAM Role with <strong className="text-zinc-300">read-only permissions</strong> in your AWS account.
          Our broker account assumes this role to scan your infrastructure. We never store your AWS access keys.
        </p>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-3 py-2">
          <ShieldCheckIcon className="h-4 w-4 flex-shrink-0" />
          No write access. No credentials stored. Revoke anytime from your AWS console.
        </div>
      </div>

      <div className="glass-card rounded-xl border border-white/[0.06] p-6">
        <h3 className="text-sm font-semibold text-zinc-200 mb-4">Create the IAM Role in your AWS account</h3>
        <ol className="space-y-4 text-sm text-zinc-400">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0 mt-0.5">1</span>
            <div className="flex-1">
              <p>Go to <strong className="text-zinc-300">IAM &rarr; Roles &rarr; Create Role</strong> in the AWS Console.</p>
              <a
                href="https://console.aws.amazon.com/iam/home#/roles$new?step=type&roleType=crossAccount"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 mt-1"
              >
                Open AWS IAM Console <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0 mt-0.5">2</span>
            <div className="flex-1">
              <p className="mb-2">Select <strong className="text-zinc-300">&quot;Another AWS account&quot;</strong> and enter:</p>
              <CopyBlock label="Account ID" value={BROKER_ACCOUNT_ID} />
              <div className="mt-2">
                <CopyBlock label="External ID (required)" value={externalId} />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0 mt-0.5">3</span>
            <div className="flex-1">
              <p>
                Attach the <strong className="text-zinc-300">ReadOnlyAccess</strong> AWS managed policy, or use our custom minimal policy below.
              </p>
              <button
                onClick={() => setShowPolicy(showPolicy === "permissions" ? null : "permissions")}
                className="text-xs text-violet-400 hover:text-violet-300 mt-1"
              >
                {showPolicy === "permissions" ? "Hide" : "Show"} custom permissions policy
              </button>
              {showPolicy === "permissions" && (
                <div className="mt-2">
                  <CopyBlock label="Permissions Policy JSON" value={IAM_PERMISSIONS_POLICY} />
                </div>
              )}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0 mt-0.5">4</span>
            <div className="flex-1">
              <p>
                Name the role <strong className="text-zinc-300">CloudOperatorReadOnly</strong> (or any name you prefer) and create it.
              </p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-zinc-400 flex-shrink-0 mt-0.5">5</span>
            <div className="flex-1">
              <p>Copy the <strong className="text-zinc-300">Role ARN</strong> from the role summary page and paste it below.</p>
            </div>
          </li>
        </ol>

        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <button
            onClick={() => setShowPolicy(showPolicy === "trust" ? null : "trust")}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            {showPolicy === "trust" ? "Hide" : "View"} trust policy JSON (for reference)
          </button>
          {showPolicy === "trust" && (
            <div className="mt-2">
              <CopyBlock label="Trust Policy JSON" value={IAM_TRUST_POLICY(externalId)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "co-onboarding";

function loadOnboardingState(): { externalId: string; step: OnboardingStep; provider: CloudProvider | null } {
  if (typeof window === "undefined") return { externalId: generateExternalId(), step: 1, provider: null };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.externalId && typeof parsed.externalId === "string") {
        return {
          externalId: parsed.externalId,
          step: ([1, 2, 3, 4] as number[]).includes(parsed.step) ? parsed.step : 1,
          provider: parsed.provider ?? null,
        };
      }
    }
  } catch {}
  const id = generateExternalId();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ externalId: id, step: 1, provider: null })); } catch {}
  return { externalId: id, step: 1, provider: null };
}

export default function OnboardingPage() {
  const router = useRouter();
  const [saved] = useState(loadOnboardingState);
  const [step, setStepRaw] = useState<OnboardingStep>(saved.step);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(saved.provider);
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("select");

  const [roleArn, setRoleArn] = useState("");
  const [awsAccountId, setAwsAccountId] = useState("");
  const [externalId] = useState(saved.externalId);

  const setStep = useCallback((s: OnboardingStep) => {
    setStepRaw(s);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, step: s, provider: selectedProvider }));
    } catch {}
  }, [selectedProvider]);

  const [validating, setValidating] = useState(false);
  const [connected, setConnected] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationDetail, setValidationDetail] = useState<string | null>(null);
  const [verifiedAccount, setVerifiedAccount] = useState<string | null>(null);

  const [token, setToken] = useState<string | null>(null);

  const arnRegex = /^arn:aws(?:-cn|-us-gov)?:iam::\d{12}:role\/[\w+=,.@-]+$/;
  const accountIdRegex = /^\d{12}$/;

  const arnAccountId = roleArn.match(/:(\d{12}):/)?.[1] ?? "";

  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const handleProviderNext = async () => {
    if (!selectedProvider) return;
    setError(null);

    if (selectedProvider !== "aws") {
      setError(`${providerConfig[selectedProvider].name} connection coming soon. Choose AWS to continue.`);
      return;
    }

    setCheckingAvailability(true);
    try {
      const res = await fetch("/api/connectors/availability");
      if (res.ok) {
        const data = await res.json();
        if (!data.aws) {
          setError("AWS connection is temporarily unavailable. Please try again later or contact support.");
          return;
        }
      }
      setConnectionPhase("setup");
    } catch {
      setConnectionPhase("setup");
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleValidateConnection = async () => {
    setError(null);
    setValidationDetail(null);

    const trimmedArn = roleArn.trim();
    const trimmedAccountId = (awsAccountId.trim() || arnAccountId).trim();

    if (!trimmedArn) {
      setError("Role ARN is required.");
      return;
    }
    if (!arnRegex.test(trimmedArn)) {
      setError("Invalid Role ARN format. Expected: arn:aws:iam::123456789012:role/RoleName");
      return;
    }
    if (!trimmedAccountId || !accountIdRegex.test(trimmedAccountId)) {
      setError("AWS Account ID is required (12 digits). We auto-detect it from the ARN — verify it's correct.");
      return;
    }

    setValidating(true);

    try {
      let currentToken = token;

      if (!currentToken) {
        const startRes = await fetch("/api/cloud-operator/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: selectedProvider }),
        });
        const startData = await startRes.json();
        if (!startRes.ok) {
          setError(startData.error ?? "Failed to initialize session.");
          return;
        }
        currentToken = startData.token;
        setToken(currentToken);
      }

      const linkRes = await fetch(`/api/connectors/link?token=${currentToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectorType: "aws",
          authMethod: "assume-role",
          roleArn: trimmedArn,
          awsAccountId: trimmedAccountId,
          externalId,
        }),
      });
      const linkData = await linkRes.json();

      if (!linkRes.ok) {
        const msg = linkData.error ?? "Connection validation failed.";
        setError(msg);
        if (linkRes.status === 403) {
          setValidationDetail("Your session could not be verified. Please refresh and try again.");
        } else if (linkRes.status === 503) {
          setValidationDetail("AWS connector is being set up. Please try again shortly.");
        } else if (msg.includes("Role ARN") || msg.includes("External ID")) {
          setValidationDetail("Double-check that the Role ARN matches the role you created, and the External ID matches what's shown above.");
        } else if (msg.includes("Broker") || msg.includes("BROKER")) {
          setValidationDetail("Our validation service is temporarily unavailable. Please try again in a moment.");
        }
        return;
      }

      setConnected(true);
      setVerifiedAccount(linkData.account ?? trimmedAccountId);
      setConnectionPhase("validate");
      try { localStorage.removeItem(STORAGE_KEY); } catch {}
      setTimeout(() => setStep(3), 1500);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setValidating(false);
    }
  };

  const handleAnalyze = async () => {
    if (!token) {
      setError("No session token. Please go back and reconnect.");
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
    <div className="min-h-screen bg-[#09090b] text-slate-100 relative">
      {/* Background layers */}
      <div className="fixed inset-0 bg-dots opacity-15 pointer-events-none" aria-hidden />
      <div className="fixed inset-0 noise-grain pointer-events-none" aria-hidden />
      {/* Floating blur orbs */}
      <div className="fixed -top-40 right-0 w-80 h-80 rounded-full bg-violet-600/8 blur-[120px] pointer-events-none" aria-hidden />
      <div className="fixed bottom-0 -left-20 w-60 h-60 rounded-full bg-fuchsia-600/6 blur-[100px] pointer-events-none" aria-hidden />

      <nav className="border-b border-white/[0.06]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/operator" className="flex items-center gap-2">
            <CpuChipIcon className="h-6 w-6 text-violet-400" />
            <span className="font-bold">Cloud Operator</span>
          </Link>
          <span className="text-sm text-zinc-500">Setup</span>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <StepIndicator current={step} />

        {/* Step 1: Welcome */}
        {step === 1 && (
          <Reveal>
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center mx-auto mb-6">
                <ShieldCheckIcon className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 tracking-[-0.04em]">Welcome to <span className="text-gradient">Axiom</span></h1>
              <p className="text-zinc-400 mb-8 max-w-md mx-auto">
                In the next few minutes, we&apos;ll scan your AWS infrastructure, analyze what needs fixing, and give you a prioritized findings report.
              </p>
              <div className="glass-card rounded-xl border border-white/[0.06] p-6 text-left max-w-sm mx-auto mb-8">
                <div className="space-y-3">
                  {[
                    "Connect your AWS account (read-only IAM Role)",
                    "Axiom scans and reasons about your infrastructure",
                    "Get your prioritized findings and action plan",
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm text-zinc-300">
                      <span className="w-6 h-6 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-zinc-400">{i + 1}</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <AnimatedButton onClick={() => setStep(2)} variant="primary" className="px-8 py-3 cta-glow">
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
              <button
                onClick={() => {
                  if (connectionPhase === "setup") {
                    setConnectionPhase("select");
                    setError(null);
                  } else {
                    setStep(1);
                  }
                }}
                className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-300 mb-6 transition-colors"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
              </button>

              {/* Phase: Select provider */}
              {connectionPhase === "select" && (
                <>
                  <h1 className="text-2xl font-bold mb-2 tracking-[-0.04em]">Connect your <span className="text-gradient">cloud</span></h1>
                  <p className="text-zinc-400 mb-8">
                    Choose your primary cloud provider. We use read-only access to scan your infrastructure safely.
                  </p>

                  <div className="space-y-3 mb-8">
                    {(Object.keys(providerConfig) as CloudProvider[]).map((p) => {
                      const config = providerConfig[p];
                      const isSelected = selectedProvider === p;
                      return (
                        <button
                          key={p}
                          onClick={() => {
                            setSelectedProvider(p);
                            setError(null);
                            try { const raw = localStorage.getItem(STORAGE_KEY); const c = raw ? JSON.parse(raw) : {}; localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...c, provider: p })); } catch {}
                          }}
                          className={`animated-border w-full text-left rounded-xl border p-5 transition-all ${
                            isSelected
                              ? "border-violet-500/50 bg-violet-950/20"
                              : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12]"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.color} flex items-center justify-center`}>
                              <CloudIcon className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="font-semibold text-sm">{config.name}</div>
                              <div className="text-xs text-zinc-500">{config.description}</div>
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

                  <AnimatedButton
                    onClick={handleProviderNext}
                    disabled={!selectedProvider || checkingAvailability}
                    variant="primary"
                    className="w-full justify-center py-3 cta-glow"
                  >
                    {checkingAvailability ? "Checking..." : "Continue"}
                    <ArrowRightIcon className="h-4 w-4" />
                  </AnimatedButton>
                </>
              )}

              {/* Phase: AWS IAM Role Setup */}
              {connectionPhase === "setup" && selectedProvider === "aws" && (
                <>
                  <h1 className="text-2xl font-bold mb-2 tracking-[-0.04em]">Set up <span className="text-gradient">AWS connection</span></h1>
                  <p className="text-zinc-400 mb-6">
                    Create a read-only IAM Role in your AWS account, then paste the Role ARN below.
                  </p>

                  <AWSSetupInstructions externalId={externalId} />

                  <div className="mt-8 space-y-4">
                    <div className="glass-card rounded-xl border border-white/[0.06] p-6">
                      <h3 className="text-sm font-semibold text-zinc-200 mb-4">Validate your connection</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                            Role ARN <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={roleArn}
                            onChange={(e) => {
                              setRoleArn(e.target.value);
                              setError(null);
                              const match = e.target.value.match(/:(\d{12}):/);
                              if (match) setAwsAccountId(match[1]);
                            }}
                            placeholder="arn:aws:iam::123456789012:role/CloudOperatorReadOnly"
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-slate-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 text-sm font-mono transition-colors"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-zinc-400 mb-1.5">
                            AWS Account ID <span className="text-red-400">*</span>
                          </label>
                          <input
                            type="text"
                            value={awsAccountId}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 12);
                              setAwsAccountId(val);
                              setError(null);
                            }}
                            placeholder="123456789012"
                            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-slate-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 text-sm font-mono transition-colors"
                          />
                          {arnAccountId && awsAccountId && arnAccountId !== awsAccountId && (
                            <p className="text-xs text-amber-400 mt-1">
                              Account ID in ARN ({arnAccountId}) doesn&apos;t match the field above. We&apos;ll use the field value.
                            </p>
                          )}
                        </div>
                      </div>

                      {error && (
                        <div className="mt-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                            {error}
                          </div>
                          {validationDetail && (
                            <p className="text-xs text-red-300/70 mt-2 ml-6">{validationDetail}</p>
                          )}
                        </div>
                      )}

                      {connected && verifiedAccount && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-3">
                          <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                          Connection verified — AWS Account {verifiedAccount}
                        </div>
                      )}

                      <div className="mt-6">
                        <AnimatedButton
                          onClick={handleValidateConnection}
                          disabled={validating || connected || !roleArn.trim()}
                          variant="primary"
                          className="w-full justify-center py-3"
                        >
                          {validating ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Validating connection...
                            </>
                          ) : connected ? (
                            <>
                              <CheckCircleIcon className="h-4 w-4" />
                              Connected — proceeding...
                            </>
                          ) : (
                            <>
                              <ShieldCheckIcon className="h-4 w-4" />
                              Validate Connection
                            </>
                          )}
                        </AnimatedButton>
                      </div>
                    </div>
                  </div>
                </>
              )}
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
              <h1 className="text-2xl font-bold mb-2 tracking-[-0.04em]">Cloud <span className="text-gradient">connected</span></h1>
              <p className="text-zinc-400 mb-2">
                Your AWS account {verifiedAccount ? `(${verifiedAccount})` : ""} is verified and linked.
              </p>
              <p className="text-zinc-500 text-sm mb-8">
                Now let&apos;s scan your infrastructure and generate your findings report.
              </p>

              <div className="glass-card rounded-xl border border-white/[0.06] p-6 mb-8 text-left">
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">What happens next:</h3>
                <div className="space-y-2 text-sm text-zinc-400">
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
                    Cognitive engine reasons about findings and prioritizes
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Generate prioritized findings with recommendations
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
                className="px-8 py-3 cta-glow"
              >
                {analyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Scanning infrastructure...
                  </>
                ) : (
                  <>
                    Scan AWS Infrastructure
                    <ChartBarIcon className="h-4 w-4" />
                  </>
                )}
              </AnimatedButton>

              {analyzing && (
                <p className="text-xs text-zinc-500 mt-4">
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
              <h1 className="text-2xl font-bold mb-2 tracking-[-0.04em]">Your report is <span className="text-gradient">ready</span></h1>
              <p className="text-zinc-400 mb-8">
                Redirecting you to your findings dashboard...
              </p>
              <div className="w-8 h-8 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin mx-auto" />
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
