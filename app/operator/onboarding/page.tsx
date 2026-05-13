"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  ArrowPathIcon,
  SparklesIcon,
  UserIcon,
  GlobeAltIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationCircleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

/* ═══════════════════════════════════════════════════════════════════
   TYPES & PROVIDER MODEL
   ═══════════════════════════════════════════════════════════════════ */

type OnboardingStep = 1 | 2 | 3 | 4 | 5;
type CloudProvider = "aws" | "azure" | "gcp";
type ConnectionPhase = "select" | "setup" | "validate";

type CapabilityStatus = "active" | "building" | "planned";
type ProviderStatus = "active" | "expanding" | "planned";

type ProviderCapability = {
  label: string;
  status: CapabilityStatus;
  description: string;
};

type ProviderInfo = {
  id: CloudProvider;
  name: string;
  shortName: string;
  status: ProviderStatus;
  connectionMethod: string;
  securityModel: string;
  accentColor: string;
  accentBg: string;
  accentBorder: string;
  accentGlow: string;
  description: string;
  statusLabel: string;
  statusColor: string;
  capabilities: ProviderCapability[];
  setupSteps: string[];
  backendReadiness: number;
  roadmapMilestones: { label: string; done: boolean }[];
  ctaBehavior: "connect" | "preview" | "waitlist";
};

const PROVIDERS: Record<CloudProvider, ProviderInfo> = {
  aws: {
    id: "aws",
    name: "Amazon Web Services",
    shortName: "AWS",
    status: "active",
    connectionMethod: "Cross-account IAM role assumption",
    securityModel: "Read-only access via STS AssumeRole with external ID",
    accentColor: "text-amber-400",
    accentBg: "bg-amber-500/10",
    accentBorder: "border-amber-500/30",
    accentGlow: "shadow-amber-500/20",
    description: "Full autonomous operations — scan, reason, plan, execute with approval gates.",
    statusLabel: "Operational",
    statusColor: "bg-emerald-400",
    capabilities: [
      { label: "Infrastructure Scan", status: "active", description: "EC2, RDS, S3, VPC, IAM discovery across all regions" },
      { label: "State Snapshot", status: "active", description: "Normalized resource state with cost tags and config" },
      { label: "Signal Engine", status: "active", description: "Cost waste, security gaps, drift detection" },
      { label: "AI Reasoning", status: "active", description: "Priority ranking by blast radius, cost, and risk" },
      { label: "Execution Plans", status: "active", description: "Terraform plans with approval gates" },
      { label: "IaC Generation", status: "active", description: "Terraform code generation from findings" },
      { label: "Audit Trail", status: "active", description: "Immutable log of every action and approval" },
      { label: "Cost Monitoring", status: "active", description: "Real-time spend tracking and budget alerts" },
    ],
    setupSteps: [
      "Create IAM Role with cross-account trust",
      "Attach ReadOnlyAccess policy",
      "Copy Role ARN to Axiom",
      "Validate connection",
    ],
    backendReadiness: 100,
    roadmapMilestones: [
      { label: "Scan engine", done: true },
      { label: "Signal derivation", done: true },
      { label: "AI reasoning", done: true },
      { label: "Terraform generation", done: true },
      { label: "Approval-gated execution", done: true },
      { label: "Scheduled operations", done: true },
    ],
    ctaBehavior: "connect",
  },
  azure: {
    id: "azure",
    name: "Microsoft Azure",
    shortName: "Azure",
    status: "expanding",
    connectionMethod: "Service principal with Reader role",
    securityModel: "App registration with Reader role at subscription scope",
    accentColor: "text-blue-400",
    accentBg: "bg-blue-500/10",
    accentBorder: "border-blue-500/30",
    accentGlow: "shadow-blue-500/20",
    description: "Scan and analysis foundation — signal engine and execution in development.",
    statusLabel: "Expanding",
    statusColor: "bg-blue-400",
    capabilities: [
      { label: "VM Inventory", status: "active", description: "Virtual machines, scale sets, availability across regions" },
      { label: "Storage Accounts", status: "active", description: "Blob storage, access tiers, redundancy configuration" },
      { label: "Cost Estimates", status: "building", description: "Spend analysis via Azure Cost Management API" },
      { label: "Signal Engine", status: "building", description: "Security and optimization signal derivation" },
      { label: "AI Reasoning", status: "planned", description: "Priority ranking adapted for Azure resource model" },
      { label: "Execution Plans", status: "planned", description: "Terraform plans for Azure resources" },
      { label: "Network Scan", status: "active", description: "VNets, NSGs, public IPs, load balancers" },
      { label: "IAM Review", status: "building", description: "Azure AD roles, service principals, RBAC" },
    ],
    setupSteps: [
      "Register app in Azure AD",
      "Create client secret",
      "Assign Reader role at subscription level",
      "Enter Tenant ID, Client ID, and Secret",
    ],
    backendReadiness: 45,
    roadmapMilestones: [
      { label: "Resource discovery", done: true },
      { label: "Network topology", done: true },
      { label: "Cost analysis", done: false },
      { label: "Signal engine", done: false },
      { label: "AI reasoning", done: false },
      { label: "Execution engine", done: false },
    ],
    ctaBehavior: "preview",
  },
  gcp: {
    id: "gcp",
    name: "Google Cloud Platform",
    shortName: "GCP",
    status: "expanding",
    connectionMethod: "Service account with Viewer role",
    securityModel: "Service account key with Viewer + Security Reviewer roles",
    accentColor: "text-red-400",
    accentBg: "bg-red-500/10",
    accentBorder: "border-red-500/30",
    accentGlow: "shadow-red-500/20",
    description: "Scan and analysis foundation — signal engine and execution in development.",
    statusLabel: "Expanding",
    statusColor: "bg-red-400",
    capabilities: [
      { label: "Compute Engine", status: "active", description: "VMs, instance groups, managed instance groups" },
      { label: "Cloud Storage", status: "active", description: "Buckets, access controls, lifecycle rules" },
      { label: "Cost Estimates", status: "building", description: "Billing data export and spend analysis" },
      { label: "Signal Engine", status: "building", description: "Security and cost signal derivation" },
      { label: "AI Reasoning", status: "planned", description: "Priority ranking for GCP resource model" },
      { label: "Execution Plans", status: "planned", description: "Terraform plans for GCP resources" },
      { label: "Network Scan", status: "active", description: "VPCs, firewall rules, cloud NAT, load balancers" },
      { label: "IAM Review", status: "building", description: "Service accounts, roles, policy bindings" },
    ],
    setupSteps: [
      "Create service account",
      "Assign Viewer and Security Reviewer roles",
      "Generate and download JSON key",
      "Upload key to Axiom",
    ],
    backendReadiness: 40,
    roadmapMilestones: [
      { label: "Resource discovery", done: true },
      { label: "Network topology", done: true },
      { label: "Cost analysis", done: false },
      { label: "Signal engine", done: false },
      { label: "AI reasoning", done: false },
      { label: "Execution engine", done: false },
    ],
    ctaBehavior: "preview",
  },
};

const BROKER_ACCOUNT_ID = "590183704419";

function generateExternalId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "axiom-";
  for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
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
    Sid: "AxiomAgentReadOnly",
    Effect: "Allow",
    Action: [
      "ec2:Describe*", "rds:Describe*", "rds:ListTagsForResource",
      "s3:ListAllMyBuckets", "s3:GetBucketLocation", "s3:GetBucketPolicy",
      "s3:GetBucketAcl", "s3:GetEncryptionConfiguration", "s3:GetBucketVersioning",
      "elasticloadbalancing:Describe*", "autoscaling:Describe*",
      "cloudwatch:GetMetricData", "cloudwatch:ListMetrics", "cloudwatch:GetMetricStatistics",
      "iam:GetAccountSummary", "iam:ListRoles", "iam:ListUsers", "iam:GetRole",
      "iam:ListAccessKeys", "iam:GetAccessKeyLastUsed",
      "ce:GetCostAndUsage", "ce:GetCostForecast",
      "tag:GetResources", "sts:GetCallerIdentity",
      "lambda:ListFunctions", "lambda:GetFunction",
      "dynamodb:ListTables", "dynamodb:DescribeTable",
      "sns:ListTopics", "sqs:ListQueues",
    ],
    Resource: "*",
  }],
}, null, 2);

/* ═══════════════════════════════════════════════════════════════════
   SCAN PHASES — Timeline for the agent scan experience
   ═══════════════════════════════════════════════════════════════════ */

type ScanPhase = {
  id: string;
  label: string;
  description: string;
  icon: typeof CloudIcon;
  color: string;
  bg: string;
  durationMs: number;
};

const SCAN_PHASES: ScanPhase[] = [
  { id: "validate", label: "Validating connection", description: "Confirming IAM role access and permissions", icon: LockClosedIcon, color: "text-emerald-400", bg: "bg-emerald-500/10", durationMs: 2000 },
  { id: "inventory", label: "Reading inventory", description: "Discovering resources across all active regions", icon: ServerStackIcon, color: "text-blue-400", bg: "bg-blue-500/10", durationMs: 4000 },
  { id: "snapshot", label: "Normalizing snapshot", description: "Building unified resource state with cost metadata", icon: EyeIcon, color: "text-cyan-400", bg: "bg-cyan-500/10", durationMs: 3000 },
  { id: "savings", label: "Detecting savings", description: "Identifying unused resources and right-sizing opportunities", icon: CurrencyDollarIcon, color: "text-amber-400", bg: "bg-amber-500/10", durationMs: 3000 },
  { id: "risks", label: "Detecting risks", description: "Scanning for public access, IAM exposure, encryption gaps", icon: ShieldCheckIcon, color: "text-red-400", bg: "bg-red-500/10", durationMs: 3000 },
  { id: "reasoning", label: "Generating reasoning trace", description: "AI engine ranking findings by blast radius and urgency", icon: CpuChipIcon, color: "text-violet-400", bg: "bg-violet-500/10", durationMs: 4000 },
  { id: "report", label: "Preparing report", description: "Compiling intelligence report with execution recommendations", icon: DocumentCheckIcon, color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", durationMs: 2000 },
];

/* ═══════════════════════════════════════════════════════════════════
   STEP INDICATOR — Premium 5-step horizontal stepper
   ═══════════════════════════════════════════════════════════════════ */

function StepIndicator({ current }: { current: OnboardingStep }) {
  const steps = [
    { num: 1, label: "Account", icon: UserIcon },
    { num: 2, label: "Connect", icon: CloudIcon },
    { num: 3, label: "Scan", icon: EyeIcon },
    { num: 4, label: "Report", icon: ChartBarIcon },
    { num: 5, label: "Execute", icon: CommandLineIcon },
  ];

  return (
    <div className="flex items-center justify-center gap-0.5 sm:gap-1.5 mb-12">
      {steps.map((s, i) => {
        const isActive = s.num === current;
        const isDone = s.num < current;
        const Icon = s.icon;
        return (
          <div key={s.num} className="flex items-center gap-0.5 sm:gap-1.5">
            <div className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3.5 py-1.5 sm:py-2 rounded-full text-xs font-medium transition-all duration-500 ${
              isActive
                ? "bg-white/[0.08] text-white border border-white/[0.15] shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                : isDone
                  ? "text-emerald-400/90"
                  : "text-zinc-600"
            }`}>
              {isDone ? (
                <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
              ) : (
                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-all duration-500 ${
                  isActive
                    ? "bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-[0_0_12px_rgba(139,92,246,0.4)]"
                    : "bg-white/[0.04] border border-white/[0.06]"
                }`}>
                  <Icon className={`h-2.5 w-2.5 ${isActive ? "text-white" : "text-zinc-600"}`} />
                </div>
              )}
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < 4 && (
              <div className={`w-4 sm:w-8 h-px transition-all duration-700 ${
                isDone ? "bg-gradient-to-r from-emerald-500/50 to-emerald-500/10" : "bg-white/[0.04]"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   CAPABILITY DOT
   ═══════════════════════════════════════════════════════════════════ */

function CapabilityDot({ status }: { status: CapabilityStatus }) {
  if (status === "active") {
    return (
      <span className="relative flex items-center justify-center">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
        <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-30" />
      </span>
    );
  }
  if (status === "building") return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />;
  return <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />;
}

/* ═══════════════════════════════════════════════════════════════════
   COPY BLOCK
   ═══════════════════════════════════════════════════════════════════ */

function CopyBlock({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
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
          {copied ? <CheckCircleIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="relative group">
        <pre className={`bg-[#0a0a0c] border border-white/[0.06] rounded-lg px-4 py-3 text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all group-hover:border-white/[0.12] transition-colors duration-200 ${mono ? "font-mono" : ""}`}>
          {value}
        </pre>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AWS SETUP INSTRUCTIONS
   ═══════════════════════════════════════════════════════════════════ */

function AWSSetupInstructions({ externalId }: { externalId: string }) {
  const [expandedPolicy, setExpandedPolicy] = useState<"trust" | "permissions" | null>(null);

  const steps = [
    {
      num: 1,
      title: "Open IAM Console",
      content: (
        <div>
          <p>Navigate to <strong className="text-zinc-200">IAM → Roles → Create Role</strong>.</p>
          <p className="mt-1.5">Select <strong className="text-zinc-200">&quot;Another AWS account&quot;</strong> as trusted entity type.</p>
          <a href="https://console.aws.amazon.com/iam/home#/roles$new?step=type&roleType=crossAccount" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-400 hover:text-violet-300 mt-3 transition-colors group">
            Open AWS IAM Console <ArrowTopRightOnSquareIcon className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      ),
    },
    {
      num: 2,
      title: "Configure trust relationship",
      content: (
        <div className="space-y-3">
          <p>Enter the Axiom broker account ID and external ID:</p>
          <CopyBlock label="Account ID" value={BROKER_ACCOUNT_ID} />
          <CopyBlock label="External ID (required for security)" value={externalId} />
          <a
            href="/docs/aws-setup#option-2"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
          >
            Why External ID? Read more →
          </a>
        </div>
      ),
    },
    {
      num: 3,
      title: "Attach read-only policy",
      content: (
        <div>
          <p>Attach the AWS-managed <strong className="text-zinc-200">ReadOnlyAccess</strong> policy, or use our minimal custom policy.</p>
          <button onClick={() => setExpandedPolicy(expandedPolicy === "permissions" ? null : "permissions")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300 mt-2.5 transition-colors">
            <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${expandedPolicy === "permissions" ? "rotate-180" : ""}`} />
            {expandedPolicy === "permissions" ? "Hide" : "View"} custom policy
          </button>
          {expandedPolicy === "permissions" && <div className="mt-3"><CopyBlock label="Permissions Policy (JSON)" value={IAM_PERMISSIONS_POLICY} /></div>}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <a href="/docs/aws-setup#permissions-explained" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
              What does Axiom access? →
            </a>
            <a href="/docs/permissions-model" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300 transition-colors">
              Permissions model →
            </a>
          </div>
        </div>
      ),
    },
    {
      num: 4,
      title: "Name and create the role",
      content: <p>Name the role <strong className="text-zinc-200">AxiomAgentReadOnly</strong> (or any name). Click Create Role.</p>,
    },
    {
      num: 5,
      title: "Copy the Role ARN",
      content: (
        <div>
          <p>Open the role summary page and copy the <strong className="text-zinc-200">Role ARN</strong>. Paste it in the validation form below.</p>
          <a
            href="/docs/aws-setup"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-violet-400 hover:text-violet-300 mt-2 transition-colors"
          >
            Full AWS setup guide →
          </a>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Security card */}
      <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.03] p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
            <LockClosedIcon className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-emerald-300 mb-1.5">Read-only by default</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Axiom assumes an IAM Role with <strong className="text-zinc-300">read-only permissions</strong> via STS.
              No access keys stored. No write access. Revoke anytime by deleting the role.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {["Zero stored credentials", "No write access", "Revoke instantly", "External ID protection"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400/90 bg-emerald-500/[0.06] border border-emerald-500/10 rounded-full px-2.5 py-1">
                  <ShieldCheckIcon className="h-3 w-3" /> {t}
                </span>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
              <a href="/docs/security-model" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                Read security model →
              </a>
              <a href="/docs/aws-setup" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                AWS setup guide →
              </a>
              <a href="/docs/permissions-model" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
                Permissions model →
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
        <h3 className="text-sm font-semibold text-zinc-200 mb-5">Create the IAM Role</h3>
        <ol className="space-y-5 text-sm text-zinc-400">
          {steps.map((s) => (
            <li key={s.num} className="flex gap-3.5">
              <span className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center text-[10px] font-bold text-violet-300 flex-shrink-0 mt-0.5">
                {s.num}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-zinc-200 mb-1.5">{s.title}</p>
                <div className="text-sm text-zinc-400">{s.content}</div>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-5 pt-4 border-t border-white/[0.04]">
          <button onClick={() => setExpandedPolicy(expandedPolicy === "trust" ? null : "trust")}
            className="inline-flex items-center gap-1 text-xs text-zinc-600 hover:text-zinc-400 transition-colors">
            <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${expandedPolicy === "trust" ? "rotate-180" : ""}`} />
            {expandedPolicy === "trust" ? "Hide" : "View"} trust policy JSON
          </button>
          {expandedPolicy === "trust" && <div className="mt-3"><CopyBlock label="Trust Policy (JSON)" value={IAM_TRUST_POLICY(externalId)} /></div>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PROVIDER ADAPTER PREVIEW — Premium modal for Azure/GCP
   ═══════════════════════════════════════════════════════════════════ */

function ProviderAdapterPreview({ provider, onClose }: { provider: CloudProvider; onClose: () => void }) {
  const info = PROVIDERS[provider];
  const activeCount = info.capabilities.filter((c) => c.status === "active").length;
  const buildingCount = info.capabilities.filter((c) => c.status === "building").length;
  const totalCaps = info.capabilities.length;
  const completedMilestones = info.roadmapMilestones.filter((m) => m.done).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />
      <div className="relative max-w-lg w-full rounded-2xl border border-white/[0.08] bg-[#0a0a0c] shadow-[0_20px_60px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}>

        {/* Header with gradient accent */}
        <div className={`relative rounded-t-2xl border-b border-white/[0.06] p-6 overflow-hidden`}>
          <div className={`absolute inset-0 ${info.accentBg} opacity-30`} />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-11 h-11 rounded-xl ${info.accentBg} border ${info.accentBorder} flex items-center justify-center`}>
                <span className={`text-sm font-bold ${info.accentColor}`}>{info.shortName}</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">{info.name}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${info.statusColor} animate-pulse`} />
                  <span className="text-xs font-semibold text-zinc-400">{info.statusLabel}</span>
                  <span className="text-[10px] text-zinc-600 ml-1">{info.backendReadiness}% ready</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-1">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Connection method */}
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
            <div className="flex items-center gap-2 mb-2">
              <LockClosedIcon className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-300">Security Model</span>
            </div>
            <p className="text-xs text-zinc-500">{info.connectionMethod}</p>
            <p className="text-xs text-zinc-600 mt-1">{info.securityModel}</p>
          </div>

          {/* Capability matrix */}
          <div>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-semibold text-zinc-300">Capabilities</span>
              <span className="text-zinc-600">{activeCount} active · {buildingCount} building · {totalCaps - activeCount - buildingCount} planned</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {info.capabilities.map((cap) => (
                <div key={cap.label} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-3 hover:border-white/[0.08] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <CapabilityDot status={cap.status} />
                    <span className={`text-xs font-medium ${cap.status === "active" ? "text-zinc-200" : cap.status === "building" ? "text-zinc-400" : "text-zinc-600"}`}>
                      {cap.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-600 leading-relaxed">{cap.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Roadmap milestones */}
          <div>
            <div className="flex items-center justify-between text-xs mb-3">
              <span className="font-semibold text-zinc-300">Roadmap</span>
              <span className="text-zinc-600">{completedMilestones}/{info.roadmapMilestones.length} milestones</span>
            </div>
            <div className="flex gap-1.5 mb-2">
              {info.roadmapMilestones.map((m, i) => (
                <div key={i} className={`flex-1 h-1.5 rounded-full transition-colors ${m.done ? "bg-emerald-500/60" : "bg-zinc-800"}`} />
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {info.roadmapMilestones.map((m, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[10px]">
                  {m.done ? <CheckCircleIcon className="h-3 w-3 text-emerald-400 flex-shrink-0" /> : <ClockIcon className="h-3 w-3 text-zinc-700 flex-shrink-0" />}
                  <span className={m.done ? "text-zinc-400" : "text-zinc-600"}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Architecture info */}
          <div className="flex items-center gap-2 text-xs text-zinc-500 bg-white/[0.02] border border-white/[0.04] rounded-lg px-3 py-2.5">
            <GlobeAltIcon className="h-3.5 w-3.5 flex-shrink-0 text-zinc-600" />
            <span>Same agent architecture as AWS — provider adapters share the scan → reason → plan → execute pipeline.</span>
          </div>

          {/* Docs links */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] pt-1">
            <Link href={provider === "azure" ? "/docs/azure-setup" : provider === "gcp" ? "/docs/gcp-setup" : "/docs"} target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Read {info.shortName} setup guide →
            </Link>
            <Link href="/docs/permissions-model" target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Permissions model →
            </Link>
            <Link href="/docs/security-model" target="_blank" className="text-violet-400 hover:text-violet-300 transition-colors font-medium">
              Security model →
            </Link>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-6 pt-0">
          <button onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-white/[0.08] text-sm font-medium text-zinc-300 hover:bg-white/[0.04] hover:border-white/[0.15] transition-all">
            Close
          </button>
          <Link href="/contact"
            className={`flex-1 px-4 py-2.5 rounded-xl ${info.accentBg} border ${info.accentBorder} text-sm font-semibold ${info.accentColor} text-center hover:opacity-80 transition-opacity`}>
            Join {info.shortName} rollout
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AGENT CORE VISUALIZATION
   ═══════════════════════════════════════════════════════════════════ */

function AgentCorePanel() {
  const nodes = [
    { label: "Read-only access", desc: "No credentials stored, revoke anytime", icon: LockClosedIcon, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Deep infrastructure scan", desc: "All regions, all resource types", icon: EyeIcon, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "AI reasoning engine", desc: "Priority by risk, cost, blast radius", icon: CpuChipIcon, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Approval-gated execution", desc: "Terraform plans, human approval required", icon: CommandLineIcon, color: "text-fuchsia-400", bg: "bg-fuchsia-500/10" },
    { label: "Immutable audit trail", desc: "Every action logged and verifiable", icon: DocumentCheckIcon, color: "text-amber-400", bg: "bg-amber-500/10" },
  ];

  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
      <div className="flex items-center gap-2 mb-4">
        <CpuChipIcon className="h-4 w-4 text-violet-400" />
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Agent Architecture</span>
      </div>
      <div className="space-y-0">
        {nodes.map((node, i) => {
          const Icon = node.icon;
          return (
            <div key={node.label} className="flex items-stretch gap-3.5">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-lg ${node.bg} flex items-center justify-center flex-shrink-0 z-10`}>
                  <Icon className={`h-3.5 w-3.5 ${node.color}`} />
                </div>
                {i < nodes.length - 1 && <div className="w-px flex-1 bg-gradient-to-b from-white/[0.08] to-white/[0.02] min-h-[12px]" />}
              </div>
              <div className="pb-3.5 pt-1 flex-1 min-w-0">
                <span className="text-xs font-semibold text-zinc-200">{node.label}</span>
                <p className="text-[11px] text-zinc-600 mt-0.5">{node.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SCAN TIMELINE — Animated progress for agent scan
   ═══════════════════════════════════════════════════════════════════ */

function ScanTimeline({ currentPhaseIndex, isComplete }: { currentPhaseIndex: number; isComplete: boolean }) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0c] p-6">
      <div className="flex items-center gap-2 mb-5">
        <span className="relative flex items-center justify-center">
          <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? "bg-emerald-400" : "bg-violet-400"}`} />
          {!isComplete && <span className="absolute w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping opacity-40" />}
        </span>
        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
          {isComplete ? "Scan Complete" : "Agent Scan Pipeline"}
        </span>
      </div>
      <div className="space-y-0">
        {SCAN_PHASES.map((phase, i) => {
          const Icon = phase.icon;
          const isDone = i < currentPhaseIndex;
          const isActive = i === currentPhaseIndex && !isComplete;
          const isPending = i > currentPhaseIndex && !isComplete;

          return (
            <div key={phase.id} className={`flex items-stretch gap-3.5 transition-opacity duration-500 ${isPending ? "opacity-30" : "opacity-100"}`}>
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 z-10 transition-all duration-500 ${
                  isDone || isComplete ? "bg-emerald-500/10" : isActive ? phase.bg : "bg-zinc-800/30"
                }`}>
                  {isDone || isComplete ? (
                    <CheckCircleIcon className="h-4 w-4 text-emerald-400" />
                  ) : isActive ? (
                    <div className="relative">
                      <Icon className={`h-4 w-4 ${phase.color}`} />
                      <span className={`absolute -inset-1 rounded-lg ${phase.bg} animate-pulse`} />
                    </div>
                  ) : (
                    <Icon className="h-4 w-4 text-zinc-700" />
                  )}
                </div>
                {i < SCAN_PHASES.length - 1 && (
                  <div className={`w-px flex-1 min-h-[10px] transition-colors duration-500 ${
                    isDone || isComplete ? "bg-emerald-500/30" : "bg-white/[0.04]"
                  }`} />
                )}
              </div>
              <div className="pb-3 pt-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold transition-colors duration-300 ${
                    isDone || isComplete ? "text-emerald-400" : isActive ? "text-white" : "text-zinc-700"
                  }`}>{phase.label}</span>
                  {isActive && <span className="w-3.5 h-3.5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />}
                </div>
                <p className={`text-[11px] mt-0.5 transition-colors duration-300 ${
                  isActive ? "text-zinc-400" : "text-zinc-700"
                }`}>{phase.description}</p>
              </div>
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
          step: ([1, 2, 3, 4, 5] as number[]).includes(parsed.step) ? parsed.step : 1,
          provider: parsed.provider ?? null,
        };
      }
    }
  } catch { /* no-op */ }
  const id = generateExternalId();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ externalId: id, step: 1, provider: null })); } catch { /* no-op */ }
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
  const [adapterPreview, setAdapterPreview] = useState<CloudProvider | null>(null);
  const [validating, setValidating] = useState(false);
  const [connected, setConnected] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanPhaseIndex, setScanPhaseIndex] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanReport, setScanReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validationDetail, setValidationDetail] = useState<string | null>(null);
  const [verifiedAccount, setVerifiedAccount] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const arnRegex = /^arn:aws(?:-cn|-us-gov)?:iam::\d{12}:role\/[\w+=,.@-]+$/;
  const accountIdRegex = /^\d{12}$/;
  const arnAccountId = roleArn.match(/:(\d{12}):/)?.[1] ?? "";

  const setStep = useCallback((s: OnboardingStep) => {
    setStepRaw(s);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, step: s, provider: selectedProvider }));
    } catch { /* no-op */ }
  }, [selectedProvider]);

  useEffect(() => {
    return () => { if (scanInterval.current) clearInterval(scanInterval.current); };
  }, []);

  /* ── Provider selection ────────────────────────────────────── */
  const handleProviderNext = async () => {
    if (!selectedProvider) return;
    setError(null);

    if (selectedProvider !== "aws") {
      setAdapterPreview(selectedProvider);
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

  /* ── Validate AWS connection ───────────────────────────────── */
  const handleValidateConnection = async () => {
    setError(null);
    setValidationDetail(null);
    const trimmedArn = roleArn.trim();
    const trimmedAccountId = (awsAccountId.trim() || arnAccountId).trim();

    if (!trimmedArn) { setError("Role ARN is required."); return; }
    if (!arnRegex.test(trimmedArn)) { setError("Invalid Role ARN format. Expected: arn:aws:iam::123456789012:role/RoleName"); return; }
    if (!trimmedAccountId || !accountIdRegex.test(trimmedAccountId)) { setError("AWS Account ID is required (12 digits)."); return; }

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
        body: JSON.stringify({ connectorType: "aws", authMethod: "assume-role", roleArn: trimmedArn, awsAccountId: trimmedAccountId, externalId }),
      });
      const linkData = await linkRes.json();

      if (!linkRes.ok) {
        const msg = linkData.error ?? "Connection validation failed.";
        setError(msg);
        if (linkRes.status === 403) setValidationDetail("Your session could not be verified. Please refresh and try again.");
        else if (linkRes.status === 503) setValidationDetail("AWS connector is being configured. Please try again shortly.");
        else if (msg.includes("Role ARN") || msg.includes("External ID")) setValidationDetail("Verify the Role ARN matches the role you created and the External ID matches.");
        return;
      }

      setConnected(true);
      setVerifiedAccount(linkData.account ?? trimmedAccountId);
      setConnectionPhase("validate");
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
      setTimeout(() => setStep(3), 1200);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setValidating(false);
    }
  };

  /* ── Run infrastructure scan with phased progress ──────────── */
  const handleAnalyze = async () => {
    if (!token) { setError("No session token. Please go back and reconnect."); return; }
    setAnalyzing(true);
    setError(null);
    setScanPhaseIndex(0);
    setScanComplete(false);

    const totalPhases = SCAN_PHASES.length;
    let phase = 0;
    scanInterval.current = setInterval(() => {
      phase++;
      if (phase < totalPhases) {
        setScanPhaseIndex(phase);
      }
    }, 3000);

    try {
      const res = await fetch(`/api/architecture/analyze?token=${token}`, { method: "POST" });
      const data = await res.json();

      if (scanInterval.current) { clearInterval(scanInterval.current); scanInterval.current = null; }

      if (!res.ok) {
        setError(data.error ?? "Analysis failed. Please try again.");
        setAnalyzing(false);
        return;
      }

      setScanPhaseIndex(totalPhases);
      setScanComplete(true);
      setScanReport(data);
      setAnalyzing(false);
      setTimeout(() => setStep(4), 1500);
    } catch {
      if (scanInterval.current) { clearInterval(scanInterval.current); scanInterval.current = null; }
      setError("Scan failed. Please check your connection and try again.");
      setAnalyzing(false);
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen bg-[#09090b] text-slate-100 relative">
      {/* Atmosphere */}
      <div className="fixed inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full bg-violet-600/[0.04] blur-[150px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-fuchsia-600/[0.03] blur-[120px]" />
        <div className="absolute top-1/3 -left-20 w-[300px] h-[300px] rounded-full bg-blue-600/[0.03] blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-20 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center group-hover:border-violet-500/40 transition-colors">
              <CpuChipIcon className="h-4 w-4 text-violet-400" />
            </div>
            <span className="font-bold text-white tracking-[-0.02em]">Axiom</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider">Agent Activation</span>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 relative z-10">
        <StepIndicator current={step} />

        {/* ════════════════════════════════════════════════════════
           STEP 1: ACCOUNT — Welcome & Agent Pipeline
           ════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <Reveal direction="up" blur>
            <div className="text-center max-w-xl mx-auto">
              <div className="relative w-20 h-20 mx-auto mb-8">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 blur-2xl animate-pulse" />
                <div className="absolute inset-[-8px] rounded-3xl border border-violet-500/10" />
                <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.25)]">
                  <CpuChipIcon className="h-9 w-9 text-white" />
                </div>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold mb-3 tracking-[-0.04em] leading-tight">
                Activate <span className="text-gradient">Axiom Agent</span>
              </h1>
              <p className="text-zinc-400 text-sm mb-2 max-w-md mx-auto">
                Connect your cloud to an intelligent, secure AI operator that scans, reasons, plans, and safely executes infrastructure improvements.
              </p>
              <p className="text-zinc-600 text-xs mb-10">5-minute setup · No credit card · Revoke access anytime</p>

              {/* Agent pipeline */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 text-left mb-8">
                <div className="flex items-center gap-2 mb-5">
                  <span className="relative flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping opacity-30" />
                  </span>
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">What Axiom Does</span>
                </div>
                <Stagger delay={0.1} interval={0.08} className="space-y-0">
                  {[
                    { icon: LockClosedIcon, color: "text-emerald-400", bg: "bg-emerald-500/10", label: "Connect", desc: "Read-only IAM role — zero stored credentials, revoke anytime" },
                    { icon: EyeIcon, color: "text-blue-400", bg: "bg-blue-500/10", label: "Scan", desc: "Full infrastructure inventory across all regions and resource types" },
                    { icon: CpuChipIcon, color: "text-violet-400", bg: "bg-violet-500/10", label: "Reason", desc: "AI prioritization by blast radius, cost savings, and compliance risk" },
                    { icon: CommandLineIcon, color: "text-fuchsia-400", bg: "bg-fuchsia-500/10", label: "Execute", desc: "Terraform plans with human approval gates and pre-verified rollback" },
                    { icon: DocumentCheckIcon, color: "text-amber-400", bg: "bg-amber-500/10", label: "Audit", desc: "Immutable trail — who approved, what changed, cost impact, rollback status" },
                  ].map((item, i) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-stretch gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center flex-shrink-0 z-10`}>
                            <Icon className={`h-4 w-4 ${item.color}`} />
                          </div>
                          {i < 4 && <div className="w-px flex-1 bg-gradient-to-b from-white/[0.08] to-white/[0.02] min-h-[14px]" />}
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
                Begin Activation <ArrowRightIcon className="h-4 w-4" />
              </AnimatedButton>
            </div>
          </Reveal>
        )}

        {/* ════════════════════════════════════════════════════════
           STEP 2: CONNECT CLOUD
           ════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <Reveal direction="up" blur>
            <div>
              <button onClick={() => {
                if (connectionPhase === "setup") { setConnectionPhase("select"); setError(null); }
                else setStep(1);
              }} className="flex items-center gap-1.5 text-sm text-zinc-600 hover:text-zinc-300 mb-6 transition-colors">
                <ArrowLeftIcon className="h-3.5 w-3.5" /> Back
              </button>

              {/* Provider selection */}
              {connectionPhase === "select" && (
                <>
                  <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                      Connect your <span className="text-gradient">cloud</span>
                    </h1>
                    <p className="text-zinc-500 text-sm">
                      Select your infrastructure provider. Axiom connects via read-only access for autonomous scanning.
                    </p>
                  </div>

                  <div className="grid gap-3 mb-6">
                    {(Object.keys(PROVIDERS) as CloudProvider[]).map((p) => {
                      const info = PROVIDERS[p];
                      const isSelected = selectedProvider === p;
                      const isActive = info.status === "active";
                      const activeCapCount = info.capabilities.filter((c) => c.status === "active").length;

                      return (
                        <button key={p}
                          onClick={() => {
                            setSelectedProvider(p);
                            setError(null);
                            try { const raw = localStorage.getItem(STORAGE_KEY); const c = raw ? JSON.parse(raw) : {}; localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...c, provider: p })); } catch { /* no-op */ }
                          }}
                          className={`group w-full text-left rounded-xl border p-5 transition-all duration-300 ${
                            isSelected
                              ? `border-violet-500/40 bg-violet-500/[0.04] shadow-[0_0_25px_rgba(139,92,246,0.08)]`
                              : "border-white/[0.06] bg-white/[0.015] hover:border-white/[0.12] hover:bg-white/[0.03]"
                          }`}>
                          <div className="flex items-start gap-4">
                            <div className={`w-11 h-11 rounded-xl ${info.accentBg} border ${isSelected ? info.accentBorder : "border-transparent"} flex items-center justify-center transition-colors`}>
                              <span className={`text-sm font-bold ${info.accentColor}`}>{info.shortName}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold text-sm text-white">{info.name}</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`w-1.5 h-1.5 rounded-full ${info.statusColor} ${!isActive ? "animate-pulse" : ""}`} />
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isActive ? "text-emerald-400/80" : "text-zinc-500"}`}>
                                    {info.statusLabel}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs text-zinc-500 mb-3">{info.description}</p>
                              <div className="flex items-center gap-3 text-[10px] text-zinc-600">
                                <span>{activeCapCount}/{info.capabilities.length} capabilities active</span>
                                <span>·</span>
                                <span>{info.connectionMethod}</span>
                              </div>
                            </div>
                            {isSelected && <CheckCircleIcon className="h-5 w-5 text-violet-400 flex-shrink-0 mt-1" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-6"><AgentCorePanel /></div>

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-4 py-3 mb-4">
                      <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" /> {error}
                    </div>
                  )}

                  <AnimatedButton onClick={handleProviderNext} disabled={!selectedProvider || checkingAvailability} variant="primary" className="w-full justify-center py-3.5">
                    {checkingAvailability ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-zinc-900 rounded-full animate-spin" /> Checking availability...</>
                    ) : selectedProvider && selectedProvider !== "aws" ? (
                      <>View {PROVIDERS[selectedProvider].shortName} Architecture <ArrowRightIcon className="h-4 w-4" /></>
                    ) : (
                      <>Continue with {selectedProvider ? PROVIDERS[selectedProvider].shortName : "provider"} <ArrowRightIcon className="h-4 w-4" /></>
                    )}
                  </AnimatedButton>
                </>
              )}

              {/* AWS IAM Role Setup */}
              {connectionPhase === "setup" && selectedProvider === "aws" && (
                <>
                  <div className="mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                      Set up <span className="text-gradient">AWS access</span>
                    </h1>
                    <p className="text-zinc-500 text-sm">Create a read-only IAM Role, then validate below.</p>
                  </div>

                  <AWSSetupInstructions externalId={externalId} />

                  {/* Validation form */}
                  <div className="mt-6">
                    <div className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5">
                      <h3 className="text-sm font-semibold text-zinc-200 mb-5">Validate connection</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1.5">Role ARN <span className="text-red-400/80">*</span></label>
                          <input type="text" value={roleArn}
                            onChange={(e) => { setRoleArn(e.target.value); setError(null); const m = e.target.value.match(/:(\d{12}):/); if (m) setAwsAccountId(m[1]); }}
                            placeholder="arn:aws:iam::123456789012:role/AxiomAgentReadOnly"
                            className="w-full rounded-lg border border-white/[0.08] bg-[#0a0a0c] px-4 py-3 text-slate-100 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500/40 text-sm font-mono transition-all" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-500 mb-1.5">AWS Account ID <span className="text-red-400/80">*</span></label>
                          <input type="text" value={awsAccountId}
                            onChange={(e) => { setAwsAccountId(e.target.value.replace(/\D/g, "").slice(0, 12)); setError(null); }}
                            placeholder="123456789012"
                            className="w-full rounded-lg border border-white/[0.08] bg-[#0a0a0c] px-4 py-3 text-slate-100 placeholder:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/25 focus:border-violet-500/40 text-sm font-mono transition-all" />
                          {arnAccountId && awsAccountId && arnAccountId !== awsAccountId && (
                            <p className="text-xs text-amber-400/80 mt-1.5">Account ID in ARN ({arnAccountId}) differs from field. We&apos;ll use the field value.</p>
                          )}
                        </div>
                      </div>

                      {error && (
                        <div className="mt-4 text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-4 py-3">
                          <div className="flex items-start gap-2">
                            <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              {error}
                              {validationDetail && <p className="text-xs text-red-300/60 mt-1.5">{validationDetail}</p>}
                              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                                <a
                                  href="/docs/troubleshooting#aws-connection"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-red-300 hover:text-red-200 underline underline-offset-2 font-medium"
                                >
                                  Troubleshoot this error →
                                </a>
                                <a
                                  href="/docs/aws-setup"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-red-300 hover:text-red-200 underline underline-offset-2 font-medium"
                                >
                                  Review AWS setup steps →
                                </a>
                              </div>
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

                      <div className="mt-5 flex gap-3">
                        <AnimatedButton onClick={handleValidateConnection} disabled={validating || connected || !roleArn.trim()} variant="primary" className="flex-1 justify-center py-3.5">
                          {validating ? (
                            <><span className="w-4 h-4 border-2 border-white/30 border-t-zinc-900 rounded-full animate-spin" /> Validating...</>
                          ) : connected ? (
                            <><CheckCircleIcon className="h-4 w-4" /> Connected</>
                          ) : (
                            <><ShieldCheckIcon className="h-4 w-4" /> Validate Connection</>
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

        {/* ════════════════════════════════════════════════════════
           STEP 3: SECURE SCAN
           ════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <Reveal direction="up" blur>
            <div className="max-w-xl mx-auto">
              {!analyzing && !scanComplete && (
                <>
                  <div className="text-center mb-8">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 blur-2xl animate-pulse" />
                      <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                        <CheckCircleIcon className="h-7 w-7 text-white" />
                      </div>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                      Cloud <span className="text-gradient">connected</span>
                    </h1>
                    <p className="text-zinc-400 text-sm">
                      AWS account {verifiedAccount ? `(${verifiedAccount})` : ""} verified. Ready to scan.
                    </p>
                  </div>

                  <ScanTimeline currentPhaseIndex={0} isComplete={false} />

                  {error && (
                    <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-4 py-3 mt-4">
                      <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" /> {error}
                    </div>
                  )}

                  <div className="mt-6 flex gap-3">
                    <button onClick={() => setStep(2)} className="px-4 py-3 rounded-xl border border-white/[0.08] text-sm font-medium text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all">
                      <ArrowLeftIcon className="h-4 w-4" />
                    </button>
                    <AnimatedButton onClick={handleAnalyze} variant="primary" className="flex-1 justify-center py-3.5">
                      <BoltIcon className="h-4 w-4" /> Start Secure Scan
                    </AnimatedButton>
                  </div>

                  <p className="text-xs text-zinc-600 text-center mt-4">
                    Read-only scan. Typically 30–60 seconds. No changes to your infrastructure.
                  </p>
                </>
              )}

              {analyzing && (
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                    Scanning <span className="text-gradient">infrastructure</span>
                  </h1>
                  <p className="text-zinc-500 text-sm mb-8">
                    Axiom Agent is analyzing your AWS environment. This takes 30–60 seconds.
                  </p>
                  <ScanTimeline currentPhaseIndex={scanPhaseIndex} isComplete={false} />
                </div>
              )}

              {scanComplete && !analyzing && (
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-6">
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-emerald-500/25 to-green-500/25 blur-xl" />
                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-500 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                      <CheckCircleIcon className="h-7 w-7 text-white" />
                    </div>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                    Scan <span className="text-gradient">complete</span>
                  </h1>
                  <p className="text-zinc-400 text-sm mb-6">Preparing your intelligence report...</p>
                  <ScanTimeline currentPhaseIndex={SCAN_PHASES.length} isComplete={true} />
                </div>
              )}
            </div>
          </Reveal>
        )}

        {/* ════════════════════════════════════════════════════════
           STEP 4: INTELLIGENCE REPORT PREVIEW
           ════════════════════════════════════════════════════════ */}
        {step === 4 && (
          <Reveal direction="up" blur>
            <div className="max-w-xl mx-auto">
              <div className="text-center mb-8">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 blur-xl animate-pulse" />
                  <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
                    <ChartBarIcon className="h-7 w-7 text-white" />
                  </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold mb-2 tracking-[-0.04em]">
                  Intelligence <span className="text-gradient">report</span>
                </h1>
                <p className="text-zinc-500 text-sm">
                  Your first infrastructure analysis is ready.
                </p>
              </div>

              {/* Report summary */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-6 mb-6">
                <div className="flex items-center gap-2 mb-5">
                  <SparklesIcon className="h-4 w-4 text-violet-400" />
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Report Summary</span>
                </div>

                {scanReport ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-[#0a0a0c] border border-white/[0.06] p-4">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Resilience Score</span>
                        <div className="text-2xl font-bold text-violet-400 mt-1">
                          {(scanReport.resilienceScore as number) ?? "--"}<span className="text-sm text-zinc-600">/100</span>
                        </div>
                      </div>
                      <div className="rounded-lg bg-[#0a0a0c] border border-white/[0.06] p-4">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider">Cost Impact</span>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">
                          {(scanReport.estimatedCostImpact as number) ? `$${Math.abs(scanReport.estimatedCostImpact as number).toLocaleString()}/mo` : "--"}
                        </div>
                      </div>
                    </div>

                    {(scanReport.risks as Array<{ description: string }>) && (scanReport.risks as Array<unknown>).length > 0 && (
                      <div className="rounded-lg bg-[#0a0a0c] border border-white/[0.06] p-4">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">Top Findings</span>
                        <div className="space-y-2">
                          {(scanReport.risks as Array<{ description: string }>).slice(0, 3).map((risk, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                              <ExclamationCircleIcon className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                              <span>{risk.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(scanReport.nextSteps as string[]) && (scanReport.nextSteps as string[]).length > 0 && (
                      <div className="rounded-lg bg-[#0a0a0c] border border-white/[0.06] p-4">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2 block">Recommended Actions</span>
                        <div className="space-y-1.5">
                          {(scanReport.nextSteps as string[]).slice(0, 3).map((step, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                              <ArrowRightIcon className="h-3 w-3 text-violet-400 flex-shrink-0 mt-0.5" />
                              <span>{step}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-sm text-zinc-500">No scan data available.</p>
                    <p className="text-xs text-zinc-600 mt-1">Connect AWS and run a scan to generate your first report.</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="px-4 py-3 rounded-xl border border-white/[0.08] text-sm font-medium text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all">
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <AnimatedButton onClick={() => setStep(5)} variant="primary" className="flex-1 justify-center py-3.5">
                  View Execution Plan <ArrowRightIcon className="h-4 w-4" />
                </AnimatedButton>
              </div>
            </div>
          </Reveal>
        )}

        {/* ════════════════════════════════════════════════════════
           STEP 5: EXECUTION PLAN — Dashboard redirect
           ════════════════════════════════════════════════════════ */}
        {step === 5 && (
          <Reveal direction="up" blur>
            <div className="text-center max-w-xl mx-auto">
              <div className="relative w-16 h-16 mx-auto mb-6">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-fuchsia-500/25 to-violet-500/25 blur-xl animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-500 flex items-center justify-center shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                  <CommandLineIcon className="h-7 w-7 text-white" />
                </div>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mb-3 tracking-[-0.04em]">
                Your execution plan is <span className="text-gradient">ready</span>
              </h1>
              <p className="text-zinc-400 text-sm mb-2">
                Axiom has identified improvements for your infrastructure. Review findings, approve changes, and let the agent execute safely.
              </p>
              <p className="text-zinc-600 text-xs mb-8">
                Every action requires your approval. Every change is logged and reversible.
              </p>

              {/* What happens next */}
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-5 mb-8 text-left">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-4 block">In your dashboard</span>
                <div className="space-y-3">
                  {[
                    { icon: ChartBarIcon, label: "Full intelligence report", desc: "Resource inventory, cost analysis, security findings" },
                    { icon: CommandLineIcon, label: "Terraform execution plans", desc: "Review and approve infrastructure changes" },
                    { icon: ArrowPathIcon, label: "Scheduled operations", desc: "Configure recurring scans and optimization runs" },
                    { icon: DocumentCheckIcon, label: "Audit trail", desc: "Complete history of actions, approvals, and outcomes" },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-violet-400" />
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-zinc-200">{item.label}</span>
                          <p className="text-[11px] text-zinc-600">{item.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 justify-center">
                <button onClick={() => setStep(4)}
                  className="px-4 py-3 rounded-xl border border-white/[0.08] text-sm font-medium text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all">
                  <ArrowLeftIcon className="h-4 w-4" />
                </button>
                <AnimatedButton
                  onClick={() => router.push(token ? `/dashboard/resilience?token=${token}` : "/dashboard")}
                  variant="primary" className="px-8 py-3.5">
                  Open Dashboard <ArrowRightIcon className="h-4 w-4" />
                </AnimatedButton>
              </div>

              <div className="mt-6 flex items-center justify-center gap-4 text-[10px] text-zinc-600">
                <span className="flex items-center gap-1"><LockClosedIcon className="h-3 w-3" /> Read-only access</span>
                <span className="flex items-center gap-1"><ShieldCheckIcon className="h-3 w-3" /> Approval-gated</span>
                <span className="flex items-center gap-1"><DocumentCheckIcon className="h-3 w-3" /> Full audit trail</span>
              </div>
            </div>
          </Reveal>
        )}
      </div>

      {/* Adapter preview modal */}
      {adapterPreview && (
        <ProviderAdapterPreview provider={adapterPreview} onClose={() => setAdapterPreview(null)} />
      )}
    </div>
  );
}
