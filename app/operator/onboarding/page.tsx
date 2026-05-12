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
  XMarkIcon,
  EyeIcon,
  BoltIcon,
  CommandLineIcon,
  DocumentCheckIcon,
  SignalIcon,
  ServerStackIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

/* ═══════════════════════════════════════════════════════════════════
   TYPES & CONSTANTS
   ═══════════════════════════════════════════════════════════════════ */

type OnboardingStep = 1 | 2 | 3 | 4;
type CloudProvider = "aws" | "azure" | "gcp";
type ConnectionPhase = "select" | "setup" | "validate";

type CapabilityStatus = "active" | "building" | "planned";

type ProviderCapability = {
  label: string;
  status: CapabilityStatus;
};

type ProviderInfo = {
  name: string;
  shortName: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentGlow: string;
  description: string;
  statusLabel: string;
  statusColor: string;
  capabilities: ProviderCapability[];
};

const PROVIDERS: Record<CloudProvider, ProviderInfo> = {
  aws: {
    name: "Amazon Web Services",
    shortName: "AWS",
    accentColor: "text-amber-400",
    accentBg: "bg-amber-500/10",
    accentBorder: "border-amber-500/30",
    accentGlow: "shadow-amber-500/20",
    description: "Full autonomous operations — scan, reason, plan, execute.",
    statusLabel: "Active",
    statusColor: "bg-emerald-400",
    capabilities: [
      { label: "Scan", status: "active" },
      { label: "Snapshot", status: "active" },
      { label: "Signals", status: "active" },
      { label: "Reasoning", status: "active" },
      { label: "Execution", status: "active" },
      { label: "Terraform", status: "active" },
      { label: "Audit", status: "active" },
      { label: "Monitoring", status: "active" },
    ],
  },
  azure: {
    name: "Microsoft Azure",
    shortName: "Azure",
    accentColor: "text-blue-400",
    accentBg: "bg-blue-500/10",
    accentBorder: "border-blue-500/30",
    accentGlow: "shadow-blue-500/20",
    description: "Adapter foundation in progress — scan and analysis active.",
    statusLabel: "Expanding",
    statusColor: "bg-blue-400",
    capabilities: [
      { label: "Scan", status: "active" },
      { label: "Snapshot", status: "active" },
      { label: "Signals", status: "building" },
      { label: "Reasoning", status: "building" },
      { label: "Execution", status: "planned" },
      { label: "Terraform", status: "planned" },
      { label: "Audit", status: "active" },
      { label: "Monitoring", status: "planned" },
    ],
  },
  gcp: {
    name: "Google Cloud Platform",
    shortName: "GCP",
    accentColor: "text-red-400",
    accentBg: "bg-red-500/10",
    accentBorder: "border-red-500/30",
    accentGlow: "shadow-red-500/20",
    description: "Adapter foundation in progress — scan and analysis active.",
    statusLabel: "Expanding",
    statusColor: "bg-red-400",
    capabilities: [
      { label: "Scan", status: "active" },
      { label: "Snapshot", status: "active" },
      { label: "Signals", status: "building" },
      { label: "Reasoning", status: "building" },
      { label: "Execution", status: "planned" },
      { label: "Terraform", status: "planned" },
      { label: "Audit", status: "active" },
      { label: "Monitoring", status: "planned" },
    ],
  },
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
      "ec2:Describe*", "rds:Describe*",
      "s3:ListAllMyBuckets", "s3:GetBucketLocation", "s3:GetBucketPolicy", "s3:GetBucketAcl", "s3:GetEncryptionConfiguration",
      "elasticloadbalancing:Describe*", "autoscaling:Describe*",
      "cloudwatch:GetMetricData", "cloudwatch:ListMetrics",
      "iam:GetAccountSummary", "iam:ListRoles", "iam:ListUsers", "iam:GetRole",
      "tag:GetResources", "sts:GetCallerIdentity",
    ],
    Resource: "*",
  }],
}, null, 2);

/* ═══════════════════════════════════════════════════════════════════
   STEP INDICATOR — Premium horizontal stepper
   ═══════════════════════════════════════════════════════════════════ */

function StepIndicator({ current }: { current: OnboardingStep }) {
  const steps = [
    { num: 1, label: "Account" },
    { num: 2, label: "Connect Cloud" },
    { num: 3, label: "Agent Scan" },
    { num: 4, label: "Intelligence" },
  ];

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 mb-14">
      {steps.map((s, i) => {
        const isActive = s.num === current;
        const isDone = s.num < current;
        return (
          <div key={s.num} className="flex items-center gap-1 sm:gap-2">
            <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all duration-300 ${
              isActive
                ? "bg-white/[0.08] text-white border border-white/[0.15] shadow-[0_0_15px_rgba(139,92,246,0.15)]"
                : isDone
                  ? "text-emerald-400/80"
                  : "text-zinc-600"
            }`}>
              {isDone ? (
                <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-[0_0_10px_rgba(139,92,246,0.4)]"
                    : "bg-white/[0.04] text-zinc-600 border border-white/[0.06]"
                }`}>{s.num}</span>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < 3 && (
              <div className={`w-6 sm:w-10 h-px transition-colors duration-500 ${
                isDone ? "bg-gradient-to-r from-emerald-500/40 to-emerald-500/10" : "bg-white/[0.04]"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CAPABILITY DOT — Status indicator for provider features
   ═══════════════════════════════════════════════════════════════════ */

function CapabilityDot({ status }: { status: CapabilityStatus }) {
  if (status === "active") {
    return (
      <span className="relative flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
      </span>
    );
  }
  if (status === "building") {
    return <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />;
}

/* ═══════════════════════════════════════════════════════════════════
   COPY BLOCK — Clipboard copy for secrets/ARNs
   ═══════════════════════════════════════════════════════════════════ */

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
        <span className="text-xs font-medium text-zinc-500">{label}</span>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-200 ${
            copied ? "text-emerald-400" : "text-zinc-500 hover:text-white"
          }`}
        >
          {copied ? (
            <CheckCircleIcon className="h-3.5 w-3.5" />
          ) : (
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="relative group">
        <pre className="bg-[#0c0c0e] border border-white/[0.06] rounded-lg px-4 py-3 text-xs text-zinc-300 overflow-x-auto font-mono whitespace-pre-wrap break-all group-hover:border-white/[0.10] transition-colors duration-200">
          {value}
        </pre>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AWS SETUP INSTRUCTIONS — Enhanced with trust-first messaging
   ═══════════════════════════════════════════════════════════════════ */

function AWSSetupInstructions({ externalId }: { externalId: string }) {
  const [showPolicy, setShowPolicy] = useState<"trust" | "permissions" | null>(null);

  return (
    <div className="space-y-5">
      {/* Security trust card */}
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <LockClosedIcon className="h-4.5 w-4.5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-emerald-300 mb-1">Read-only by default</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Axiom uses an IAM Role with <strong className="text-zinc-300">read-only permissions</strong>.
              We assume this role to scan — no access keys stored, no write access granted.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["No write access", "No credentials stored", "Revoke anytime"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400/90 bg-emerald-500/[0.06] border border-emerald-500/10 rounded-full px-2.5 py-1">
                  <ShieldCheckIcon className="h-3 w-3" />
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-step instructions */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-5">Create the IAM Role</h3>
        <ol className="space-y-5 text-sm text-zinc-400">
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0 mt-0.5">1</span>
            <div className="flex-1">
              <p>Open <strong className="text-zinc-200">IAM &rarr; Roles &rarr; Create Role</strong> in your AWS Console.</p>
              <a
                href="https://console.aws.amazon.com/iam/home#/roles$new?step=type&roleType=crossAccount"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 mt-2 transition-colors"
              >
                Open AWS IAM Console <ArrowTopRightOnSquareIcon className="h-3 w-3" />
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0 mt-0.5">2</span>
            <div className="flex-1">
              <p className="mb-3">Select <strong className="text-zinc-200">&quot;Another AWS account&quot;</strong> and enter:</p>
              <div className="space-y-3">
                <CopyBlock label="Account ID" value={BROKER_ACCOUNT_ID} />
                <CopyBlock label="External ID (required)" value={externalId} />
              </div>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0 mt-0.5">3</span>
            <div className="flex-1">
              <p>Attach the <strong className="text-zinc-200">ReadOnlyAccess</strong> managed policy, or use our custom minimal policy.</p>
              <button
                onClick={() => setShowPolicy(showPolicy === "permissions" ? null : "permissions")}
                className="text-xs font-medium text-violet-400 hover:text-violet-300 mt-2 transition-colors"
              >
                {showPolicy === "permissions" ? "Hide" : "View"} custom permissions policy
              </button>
              {showPolicy === "permissions" && (
                <div className="mt-3">
                  <CopyBlock label="Permissions Policy JSON" value={IAM_PERMISSIONS_POLICY} />
                </div>
              )}
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0 mt-0.5">4</span>
            <div className="flex-1">
              <p>Name the role <strong className="text-zinc-200">CloudOperatorReadOnly</strong> (or any name) and create it.</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0 mt-0.5">5</span>
            <div className="flex-1">
              <p>Copy the <strong className="text-zinc-200">Role ARN</strong> from the role summary and paste it below.</p>
            </div>
          </li>
        </ol>

        <div className="mt-5 pt-4 border-t border-white/[0.04]">
          <button
            onClick={() => setShowPolicy(showPolicy === "trust" ? null : "trust")}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {showPolicy === "trust" ? "Hide" : "View"} trust policy JSON
          </button>
          {showPolicy === "trust" && (
            <div className="mt-3">
              <CopyBlock label="Trust Policy JSON" value={IAM_TRUST_POLICY(externalId)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROVIDER ROADMAP MODAL — For Azure/GCP expanding state
   ═══════════════════════════════════════════════════════════════════ */

function ProviderRoadmapModal({
  provider,
  onClose,
}: {
  provider: CloudProvider;
  onClose: () => void;
}) {
  const info = PROVIDERS[provider];
  const activeCount = info.capabilities.filter((c) => c.status === "active").length;
  const buildingCount = info.capabilities.filter((c) => c.status === "building").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div
        className="relative max-w-md w-full rounded-2xl border border-white/[0.08] bg-[#0c0c0e] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className={`w-10 h-10 rounded-xl ${info.accentBg} border ${info.accentBorder} flex items-center justify-center`}>
            <span className={`text-sm font-bold ${info.accentColor}`}>{info.shortName}</span>
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">{info.name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`w-1.5 h-1.5 rounded-full ${info.statusColor} animate-pulse`} />
              <span className="text-xs font-medium text-zinc-400">{info.statusLabel}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
          {info.shortName} adapter foundation is actively being built. Scan and snapshot capabilities are live.
          Signal derivation and AI reasoning are in development. Full execution support is on the roadmap.
        </p>

        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4 mb-5">
          <div className="flex items-center justify-between text-xs text-zinc-500 mb-3">
            <span className="font-medium">Capability status</span>
            <span>{activeCount} active · {buildingCount} building</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {info.capabilities.map((cap) => (
              <div key={cap.label} className="flex items-center gap-2 text-xs">
                <CapabilityDot status={cap.status} />
                <span className={cap.status === "active" ? "text-zinc-300" : cap.status === "building" ? "text-zinc-400" : "text-zinc-600"}>
                  {cap.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2.5 mb-5">
          <SignalIcon className="h-3.5 w-3.5 flex-shrink-0" />
          <span>We&apos;ll notify you when full {info.shortName} support is available.</span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-full border border-white/[0.08] text-sm font-medium text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.15] transition-all duration-200"
          >
            Close
          </button>
          <Link
            href="/contact"
            className="flex-1 px-4 py-2.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-sm font-medium text-white text-center hover:bg-white/[0.10] transition-all duration-200"
          >
            Request early access
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AGENT ARCHITECTURE VISUALIZATION
   ═══════════════════════════════════════════════════════════════════ */

function AgentCorePanel() {
  const nodes = [
    { label: "Read-only access", icon: LockClosedIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Deep scan", icon: EyeIcon, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "AI reasoning", icon: CpuChipIcon, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Execution plan", icon: CommandLineIcon, color: "text-fuchsia-400", bg: "bg-fuchsia-500/10" },
    { label: "Audit trail", icon: DocumentCheckIcon, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center gap-2 mb-4">
        <CpuChipIcon className="h-4 w-4 text-violet-400" />
        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Agent Core</span>
      </div>
      <div className="space-y-2">
        {nodes.map((node) => {
          const Icon = node.icon;
          return (
            <div key={node.label} className="flex items-center gap-3 py-1.5">
              <div className={`w-7 h-7 rounded-lg ${node.bg} flex items-center justify-center`}>
                <Icon className={`h-3.5 w-3.5 ${node.color}`} />
              </div>
              <span className="text-xs text-zinc-400 font-medium">{node.label}</span>
              <div className="flex-1 h-px bg-white/[0.04]" />
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PERSISTENCE
   ═══════════════════════════════════════════════════════════════════ */

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

/* ═══════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════ */

export default function OnboardingPage() {
  const router = useRouter();
  const [saved] = useState(loadOnboardingState);
  const [step, setStepRaw] = useState<OnboardingStep>(saved.step);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | null>(saved.provider);
  const [connectionPhase, setConnectionPhase] = useState<ConnectionPhase>("select");

  const [roleArn, setRoleArn] = useState("");
  const [awsAccountId, setAwsAccountId] = useState("");
  const [externalId] = useState(saved.externalId);

  const [roadmapModal, setRoadmapModal] = useState<CloudProvider | null>(null);

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
  const [checkingAvailability, setCheckingAvailability] = useState(false);

  const arnRegex = /^arn:aws(?:-cn|-us-gov)?:iam::\d{12}:role\/[\w+=,.@-]+$/;
  const accountIdRegex = /^\d{12}$/;
  const arnAccountId = roleArn.match(/:(\d{12}):/)?.[1] ?? "";

  /* ── Provider selection handler ─────────────────────────────── */
  const handleProviderNext = async () => {
    if (!selectedProvider) return;
    setError(null);

    if (selectedProvider !== "aws") {
      setRoadmapModal(selectedProvider);
      return;
    }

    setCheckingAvailability(true);
    try {
      const res = await fetch("/api/connectors/availability");
      if (res.ok) {
        const data = await res.json();
        if (!data.aws) {
          setError("AWS connector is being configured. Please try again shortly.");
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

  /* ── Validate AWS connection ────────────────────────────────── */
  const handleValidateConnection = async () => {
    setError(null);
    setValidationDetail(null);

    const trimmedArn = roleArn.trim();
    const trimmedAccountId = (awsAccountId.trim() || arnAccountId).trim();

    if (!trimmedArn) { setError("Role ARN is required."); return; }
    if (!arnRegex.test(trimmedArn)) { setError("Invalid Role ARN format. Expected: arn:aws:iam::123456789012:role/RoleName"); return; }
    if (!trimmedAccountId || !accountIdRegex.test(trimmedAccountId)) { setError("AWS Account ID is required (12 digits). We auto-detect it from the ARN — verify it's correct."); return; }

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
        if (!startRes.ok) { setError(startData.error ?? "Failed to initialize session."); return; }
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
        if (linkRes.status === 403) setValidationDetail("Your session could not be verified. Please refresh and try again.");
        else if (linkRes.status === 503) setValidationDetail("AWS connector is being set up. Please try again shortly.");
        else if (msg.includes("Role ARN") || msg.includes("External ID")) setValidationDetail("Double-check that the Role ARN matches the role you created, and the External ID matches what's shown above.");
        else if (msg.includes("Broker") || msg.includes("BROKER")) setValidationDetail("Our validation service is temporarily unavailable. Please try again in a moment.");
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

  /* ── Run infrastructure scan ────────────────────────────────── */
  const handleAnalyze = async () => {
    if (!token) { setError("No session token. Please go back and reconnect."); return; }
    setAnalyzing(true);
    setError(null);
    try {
      const res = await fetch(`/api/architecture/analyze?token=${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Analysis failed"); return; }
      setStep(4);
      setTimeout(() => { router.push(`/dashboard/resilience?token=${token}`); }, 2000);
    } catch {
      setError("Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 relative">
      {/* Background atmosphere */}
      <div className="fixed inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
      <div className="fixed inset-0 noise-grain pointer-events-none" aria-hidden />
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-violet-600/[0.04] blur-[150px] pointer-events-none" aria-hidden />
      <div className="fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-fuchsia-600/[0.03] blur-[120px] pointer-events-none" aria-hidden />
      <div className="fixed top-1/3 -left-20 w-[300px] h-[300px] rounded-full bg-blue-600/[0.03] blur-[100px] pointer-events-none" aria-hidden />

      {/* Nav */}
      <nav className="relative z-20 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center group-hover:border-violet-500/40 transition-colors">
              <CpuChipIcon className="h-4 w-4 text-violet-400" />
            </div>
            <span className="font-bold text-white tracking-[-0.02em]">Axiom</span>
          </Link>
          <span className="text-xs font-medium text-zinc-600 uppercase tracking-wider">Onboarding</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10">
        <StepIndicator current={step} />

        {/* ══════════════════════════════════════════════════════════
           STEP 1: WELCOME
           ══════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <Reveal direction="up" blur>
            <div className="text-center max-w-xl mx-auto">
              {/* Cinematic agent icon */}
              <div className="relative w-20 h-20 mx-auto mb-10">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl animate-pulse" />
                <div className="absolute inset-[-8px] rounded-3xl border border-violet-500/10" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.25)]">
                  <CpuChipIcon className="h-9 w-9 text-white" />
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-[-0.04em] leading-tight">
                Activate <span className="text-gradient">Axiom Agent</span>
              </h1>
              <p className="text-zinc-500 text-sm mb-10">
                Autonomous cloud operations — connect, scan, reason, execute.
              </p>

              {/* Operational pipeline visualization */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 text-left mb-10">
                <div className="flex items-center gap-2 mb-5">
                  <span className="relative flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Agent Pipeline</span>
                </div>
                <Stagger delay={0.1} interval={0.1} className="space-y-0">
                  {[
                    { icon: LockClosedIcon, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Connect", desc: "Read-only IAM role — no credentials stored" },
                    { icon: EyeIcon, color: "text-blue-400", bg: "bg-blue-500/10", label: "Scan", desc: "Deep infrastructure inventory across all regions" },
                    { icon: CpuChipIcon, color: "text-violet-400", bg: "bg-violet-500/10", label: "Reason", desc: "AI prioritization by risk, cost, and blast radius" },
                    { icon: CommandLineIcon, color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", label: "Execute", desc: "Terraform plans with approval gates and rollback" },
                    { icon: DocumentCheckIcon, color: "text-amber-400", bg: "bg-amber-500/10", label: "Audit", desc: "Immutable trail — every action logged and verifiable" },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-stretch gap-4">
                        {/* Vertical connector */}
                        <div className="flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 z-10`}>
                            <Icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          {i < 4 && <div className="w-px flex-1 bg-gradient-to-b from-white/[0.08] to-white/[0.02] min-h-[16px]" />}
                        </div>
                        <div className="pb-4 pt-1.5 flex-1 min-w-0">
                          <span className="text-xs font-semibold text-white">{item.label}</span>
                          <p className="text-xs text-zinc-500 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </Stagger>
              </div>

              <AnimatedButton onClick={() => setStep(2)} variant="primary" className="px-10 py-3.5">
                Begin Activation
                <ArrowRightIcon className="h-4 w-4" />
              </AnimatedButton>
              <p className="text-xs text-zinc-600 mt-4">5-minute setup · No credit card · Revoke access anytime</p>
            </div>
          </Reveal>
        )}

        {/* ══════════════════════════════════════════════════════════
           STEP 2: CONNECT CLOUD
           ══════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <Reveal direction="up" blur>
            <div>
              <button
                onClick={() => {
                  if (connectionPhase === "setup") { setConnectionPhase("select"); setError(null); }
                  else { setStep(1); }
                }}
                className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-300 mb-8 transition-colors duration-200"
              >
                <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
              </button>

              {/* ── Phase: Provider selection ─────────────────────── */}
              {connectionPhase === "select" && (
                <>
                  <div className="mb-8">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="relative flex items-center justify-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
                      </span>
                      <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Provider Intelligence</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                      Select <span className="text-gradient">cloud target</span>
                    </h1>
                    <p className="text-zinc-500 text-sm">
                      Choose your infrastructure provider. Axiom connects via read-only access and begins autonomous scanning.
                    </p>
                  </div>

                  <div className="grid gap-3 mb-6">
                    {(Object.keys(PROVIDERS) as CloudProvider[]).map((p) => {
                      const info = PROVIDERS[p];
                      const isSelected = selectedProvider === p;
                      const isAws = p === "aws";

                      return (
                        <button
                          key={p}
                          onClick={() => {
                            setSelectedProvider(p);
                            setError(null);
                            try { const raw = localStorage.getItem(STORAGE_KEY); const c = raw ? JSON.parse(raw) : {}; localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...c, provider: p })); } catch {}
                          }}
                          className={`group w-full text-left rounded-xl border p-5 transition-all duration-300 ${
                            isSelected
                              ? "border-violet-500/40 bg-violet-500/[0.04] shadow-[0_0_20px_rgba(139,92,246,0.08)]"
                              : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.025]"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className={`w-11 h-11 rounded-xl ${info.accentBg} border ${isSelected ? info.accentBorder : "border-transparent"} flex items-center justify-center transition-colors`}>
                              <span className={`text-sm font-bold ${info.accentColor}`}>{info.shortName}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-white">{info.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${info.statusColor} ${isAws ? "" : "animate-pulse"}`} />
                                  <span className={`text-[10px] font-semibold uppercase tracking-wider ${isAws ? "text-emerald-400/80" : "text-zinc-500"}`}>
                                    {info.statusLabel}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-zinc-500 mb-3">{info.description}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {info.capabilities.map((cap) => (
                                  <span key={cap.label} className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-white/[0.03] border border-white/[0.04] rounded-full px-2 py-0.5">
                                    <CapabilityDot status={cap.status} />
                                    {cap.label}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {isSelected && (
                              <CheckCircleIcon className="h-5 w-5 text-violet-400 flex-shrink-0 mt-1" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Agent architecture panel */}
                  <div className="mb-8">
                    <AgentCorePanel />
                  </div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-4 py-3 mb-4">
                      <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}

                  <AnimatedButton
                    onClick={handleProviderNext}
                    disabled={!selectedProvider || checkingAvailability}
                    variant="primary"
                    className="w-full justify-center py-3.5"
                  >
                    {checkingAvailability ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-zinc-900 rounded-full animate-spin" />
                        Connecting...
                      </>
                    ) : selectedProvider && selectedProvider !== "aws" ? (
                      <>
                        View {PROVIDERS[selectedProvider].shortName} roadmap
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Continue with {selectedProvider ? PROVIDERS[selectedProvider].shortName : "provider"}
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </AnimatedButton>
                </>
              )}

              {/* ── Phase: AWS IAM Role Setup ─────────────────────── */}
              {connectionPhase === "setup" && selectedProvider === "aws" && (
                <>
                  <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                      Set up <span className="text-gradient">AWS connection</span>
                    </h1>
                    <p className="text-zinc-500 text-sm">
                      Create a read-only IAM Role in your AWS account, then validate below.
                    </p>
                  </div>

                  <AWSSetupInstructions externalId={externalId} />

                  {/* Validation form */}
                  <div className="mt-6">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
                      <h3 className="text-sm font-semibold text-zinc-200 mb-5">Validate connection</h3>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                            Role ARN <span className="text-red-400/80">*</span>
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
                            className="w-full rounded-lg border border-white/[0.08] bg-[#0c0c0e] px-4 py-3 text-slate-100 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500/40 text-sm font-mono transition-all duration-200"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                            AWS Account ID <span className="text-red-400/80">*</span>
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
                            className="w-full rounded-lg border border-white/[0.08] bg-[#0c0c0e] px-4 py-3 text-slate-100 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500/40 text-sm font-mono transition-all duration-200"
                          />
                          {arnAccountId && awsAccountId && arnAccountId !== awsAccountId && (
                            <p className="text-xs text-amber-400/80 mt-1.5">
                              Account ID in ARN ({arnAccountId}) doesn&apos;t match the field above. We&apos;ll use the field value.
                            </p>
                          )}
                        </div>
                      </div>

                      {error && (
                        <div className="mt-4 text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-4 py-3">
                          <div className="flex items-start gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <div>
                              {error}
                              {validationDetail && (
                                <p className="text-xs text-red-300/60 mt-1.5">{validationDetail}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {connected && verifiedAccount && (
                        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/[0.06] border border-emerald-500/15 rounded-lg px-4 py-3">
                          <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
                          Connection verified — AWS Account {verifiedAccount}
                        </div>
                      )}

                      <div className="mt-5">
                        <AnimatedButton
                          onClick={handleValidateConnection}
                          disabled={validating || connected || !roleArn.trim()}
                          variant="primary"
                          className="w-full justify-center py-3.5"
                        >
                          {validating ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-zinc-900 rounded-full animate-spin" />
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

        {/* ══════════════════════════════════════════════════════════
           STEP 3: AGENT SCAN
           ══════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <Reveal direction="up" blur>
            <div className="text-center max-w-xl mx-auto">
              <div className="relative w-16 h-16 mx-auto mb-8">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 blur-2xl animate-pulse" />
                <div className="absolute inset-[-8px] rounded-3xl border border-emerald-500/10" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                  <CheckCircleIcon className="h-7 w-7 text-white" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                Cloud <span className="text-gradient">connected</span>
              </h1>
              <p className="text-zinc-400 mb-1">
                AWS account {verifiedAccount ? `(${verifiedAccount})` : ""} verified and linked.
              </p>
              <p className="text-zinc-600 text-sm mb-8">
                Axiom is ready to scan your infrastructure and generate your intelligence report.
              </p>

              {/* Terminal-style scan preview */}
              <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-5 mb-8 text-left">
                <div className="flex items-center gap-2 mb-4">
                  <span className="relative flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-40" />
                  </span>
                  <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Agent Scan Pipeline</span>
                </div>
                <Stagger delay={0.1} interval={0.1} className="space-y-0">
                  {[
                    { icon: ServerStackIcon, color: "text-blue-400", bg: "bg-blue-500/10", label: "Discover", desc: "Full resource inventory — compute, storage, networking, databases across all regions" },
                    { icon: ShieldCheckIcon, color: "text-amber-400", bg: "bg-amber-500/10", label: "Security", desc: "Public access, encryption gaps, IAM exposure, compliance posture" },
                    { icon: CpuChipIcon, color: "text-violet-400", bg: "bg-violet-500/10", label: "Reason", desc: "AI engine prioritizes findings by blast radius, cost, and risk" },
                    { icon: DocumentCheckIcon, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Report", desc: "Intelligence report with Terraform execution recommendations" },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-stretch gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 z-10`}>
                            <Icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          {i < 3 && <div className="w-px flex-1 bg-gradient-to-b from-white/[0.08] to-white/[0.02] min-h-[12px]" />}
                        </div>
                        <div className="pb-3.5 pt-1 flex-1 min-w-0">
                          <span className="text-xs font-semibold text-white">{item.label}</span>
                          <p className="text-xs text-zinc-600 mt-0.5">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </Stagger>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-4 py-3 mb-4">
                  <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <AnimatedButton
                onClick={handleAnalyze}
                disabled={analyzing}
                variant="primary"
                className="px-10 py-3.5"
              >
                {analyzing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-zinc-900 rounded-full animate-spin" />
                    Scanning infrastructure...
                  </>
                ) : (
                  <>
                    Run Agent Scan
                    <BoltIcon className="h-4 w-4" />
                  </>
                )}
              </AnimatedButton>

              {analyzing && (
                <p className="text-xs text-zinc-600 mt-4">
                  Typically 30–60 seconds. Scanning resources and running AI analysis.
                </p>
              )}
            </div>
          </Reveal>
        )}

        {/* ══════════════════════════════════════════════════════════
           STEP 4: INTELLIGENCE REPORT READY
           ══════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <Reveal direction="up" blur>
            <div className="text-center max-w-lg mx-auto">
              <div className="relative w-16 h-16 mx-auto mb-8">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 blur-xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                  <ChartBarIcon className="h-7 w-7 text-white" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 tracking-[-0.04em]">
                Your report is <span className="text-gradient">ready</span>
              </h1>
              <p className="text-zinc-500 mb-8">
                Redirecting to your intelligence dashboard...
              </p>
              <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin mx-auto" />
            </div>
          </Reveal>
        )}
      </div>

      {/* Roadmap modal */}
      {roadmapModal && (
        <ProviderRoadmapModal
          provider={roadmapModal}
          onClose={() => setRoadmapModal(null)}
        />
      )}
    </div>
  );
}
