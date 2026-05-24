"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AwsKeyConnect } from "./AwsKeyConnect";
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
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { AnimatedButton } from "@/components/ui/AnimatedButton";
import { MotherboardBackdrop } from "@/components/ui/MotherboardBackdrop";
import { MagneticCard } from "@/components/ui/MagneticCard";

/* Futuristic terminal-style corner ticks. Pure decoration. */
function CornerBrackets() {
  return (
    <>
      <span aria-hidden className="pointer-events-none absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-white/20" />
      <span aria-hidden className="pointer-events-none absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-white/20" />
      <span aria-hidden className="pointer-events-none absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-white/20" />
      <span aria-hidden className="pointer-events-none absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-white/20" />
    </>
  );
}

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

function generateExternalId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "axiom-";
  for (let i = 0; i < 16; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

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
  const [adapterPreview, setAdapterPreview] = useState<CloudProvider | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [scanPhaseIndex, setScanPhaseIndex] = useState(0);
  const [scanComplete, setScanComplete] = useState(false);
  const [scanReport, setScanReport] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verifiedAccount, setVerifiedAccount] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const scanInterval = useRef<ReturnType<typeof setInterval> | null>(null);

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

      {/* Nav — cinematic full-bleed, terminal-feel right meta */}
      <nav className="relative z-20 border-b border-white/[0.06] bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/20 flex items-center justify-center group-hover:border-violet-500/40 transition-colors">
              <CpuChipIcon className="h-4 w-4 text-violet-400" />
            </div>
            <span className="font-bold text-white tracking-[-0.02em]">Axiom</span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono text-zinc-600 tracking-wider">v0.1 · preview</span>
          </Link>
          <div className="flex items-center gap-3 text-[10px] font-mono text-zinc-500 tracking-wider">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
              live · workspace
            </span>
            <span className="text-zinc-700">·</span>
            <span className="hidden sm:inline">agent ready</span>
          </div>
        </div>
      </nav>

      <div className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-12 sm:py-16 relative z-10">
        <StepIndicator current={step} />

        {/* ════════════════════════════════════════════════════════
           STEP 1: ACCOUNT — Workspace welcome (Huly-style)
           ════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <Reveal direction="up">
            <div className="relative">
              {/* Cinematic backdrop layers — fill full step height */}
              <div className="absolute inset-x-[-4rem] top-[-2rem] -bottom-20 -z-0 overflow-hidden pointer-events-none">
                <MotherboardBackdrop radius={620} tint="violet" baseOpacity={0.05} peakOpacity={0.24} />
                <div aria-hidden className="absolute top-1/4 left-1/4 w-[640px] h-[640px] rounded-full bg-violet-600/[0.10] blur-[180px]" />
                <div aria-hidden className="absolute bottom-0 right-1/4 w-[520px] h-[520px] rounded-full bg-fuchsia-600/[0.07] blur-[160px]" />
                <div aria-hidden className="absolute top-1/2 -right-32 w-[420px] h-[420px] rounded-full bg-cyan-600/[0.05] blur-[140px]" />
              </div>

              <div className="relative z-10 space-y-16">
                {/* ── HERO ─────────────────────────────────────────── */}
                <div className="grid lg:grid-cols-12 gap-10 items-center pt-2">
                  {/* Left — headline + CTAs (col-span-7) */}
                  <div className="lg:col-span-7">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-violet-500/25 bg-violet-500/[0.07] backdrop-blur-sm mb-7">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                      <span className="text-[11px] font-mono text-violet-200 tracking-[0.18em] uppercase">workspace · ready</span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-[11px] font-mono text-zinc-400">awaiting cloud connection</span>
                    </div>

                    <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.5rem] font-bold tracking-[-0.05em] leading-[0.96]">
                      <span className="block text-white">Your autonomous</span>
                      <span className="block">
                        <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">multi-cloud</span>
                      </span>
                      <span className="block text-zinc-400 italic font-light">— starts here.</span>
                    </h1>

                    <p className="mt-8 text-lg sm:text-xl text-zinc-400 leading-relaxed max-w-2xl">
                      Provision one read-only IAM role with an External ID. Axiom scans every region,
                      reasons about findings, builds approval-gated execution plans, and renders the
                      audit trail in real time.
                    </p>

                    <div className="mt-10 flex items-center gap-4 flex-wrap">
                      <AnimatedButton onClick={() => setStep(2)} variant="primary" className="px-7 py-4 text-base group">
                        <span className="font-mono text-[11px] tracking-wider mr-2 text-violet-200/80">[01]</span>
                        Begin activation <ArrowRightIcon className="h-4 w-4" />
                      </AnimatedButton>
                      <Link
                        href="/docs/aws-setup"
                        className="inline-flex items-center gap-2 px-5 py-3.5 rounded-full border border-white/[0.12] bg-white/[0.025] backdrop-blur-sm text-zinc-200 hover:bg-white/[0.06] hover:border-white/[0.22] text-sm font-semibold transition-all"
                      >
                        Read the setup guide
                        <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                      </Link>
                    </div>

                    {/* Metric row — terminal-feel telemetry */}
                    <div className="mt-12 grid grid-cols-3 gap-6 max-w-2xl border-t border-white/[0.06] pt-6">
                      {[
                        { k: "setup time",   v: "~5 min",      tone: "text-zinc-300"    },
                        { k: "access mode",  v: "read-only",   tone: "text-emerald-300" },
                        { k: "revoke",       v: "one_click",   tone: "text-amber-300"   },
                      ].map((m) => (
                        <div key={m.k}>
                          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.18em] mb-1.5">{m.k}</p>
                          <p className={`text-sm font-mono font-semibold ${m.tone}`}>{m.v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right — floating agent console (col-span-5) */}
                  <div className="lg:col-span-5">
                    <MagneticCard tint="violet" maxTilt={3} radius={260} className="rounded-2xl">
                      <div className="relative rounded-2xl border border-white/[0.09] bg-gradient-to-br from-[#0e0e14] via-[#0a0a0f] to-[#070709] p-6 overflow-hidden shadow-[0_30px_80px_-20px_rgba(139,92,246,0.35)]">
                        <CornerBrackets />
                        <div aria-hidden className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-violet-500/[0.18] blur-[110px] pointer-events-none" />

                        <div className="relative z-10">
                          {/* Window chrome */}
                          <div className="flex items-center justify-between mb-5 pb-3 border-b border-white/[0.06]">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/70" />
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
                              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-600 tracking-wider">axiom://agent.boot</span>
                          </div>

                          {/* Boot sequence */}
                          <div className="space-y-1.5 font-mono text-[11.5px] leading-relaxed">
                            {[
                              { p: "$", t: "axiom init --provider aws --mode read-only", c: "text-zinc-300" },
                              { p: "→", t: "validating identity broker…",                c: "text-zinc-500" },
                              { p: "✓", t: "STS AssumeRole · sts.amazonaws.com",          c: "text-emerald-300" },
                              { p: "✓", t: "GetCallerIdentity verified",                  c: "text-emerald-300" },
                              { p: "→", t: "discovering regions × resource kinds…",       c: "text-zinc-500" },
                              { p: "▷", t: "scan plan ready · 22 controls · 4 scopes",    c: "text-violet-300" },
                              { p: "→", t: "awaiting operator approval to apply",         c: "text-amber-300" },
                            ].map((row, i) => (
                              <div key={i} className="flex gap-3">
                                <span className={`w-3 shrink-0 ${row.c}`}>{row.p}</span>
                                <span className={row.c}>{row.t}</span>
                              </div>
                            ))}
                            <div className="flex gap-3 pt-1">
                              <span className="w-3 shrink-0 text-violet-300">$</span>
                              <span className="text-zinc-200">
                                <span className="inline-block w-2 h-3.5 bg-violet-300 align-middle animate-pulse" />
                              </span>
                            </div>
                          </div>

                          {/* Footer meter */}
                          <div className="mt-6 pt-4 border-t border-white/[0.05] grid grid-cols-3 gap-3">
                            {[
                              { k: "trace",   v: "live",     tone: "text-emerald-300" },
                              { k: "policy",  v: "enforced", tone: "text-violet-300"  },
                              { k: "audit",   v: "writing",  tone: "text-cyan-300"    },
                            ].map((m) => (
                              <div key={m.k}>
                                <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-[0.18em] mb-0.5">{m.k}</p>
                                <p className={`text-[11px] font-mono font-semibold ${m.tone}`}>{m.v}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </MagneticCard>
                  </div>
                </div>

                {/* ── HORIZONTAL PIPELINE ─────────────────────────── */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2.5">
                      <SignalIcon className="h-3.5 w-3.5 text-cyan-300" />
                      <span className="text-[10px] font-mono text-cyan-300/90 uppercase tracking-[0.22em]">// agent pipeline</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-600 tracking-[0.18em]">5 phases · approval-gated · reversible</span>
                  </div>

                  <div className="relative rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm overflow-hidden">
                    <CornerBrackets />
                    {/* Horizontal rail */}
                    <div aria-hidden className="absolute left-8 right-8 top-[3.25rem] h-px bg-gradient-to-r from-emerald-500/30 via-violet-500/30 to-amber-500/30 hidden md:block" />
                    <div className="grid md:grid-cols-5 gap-0 p-6">
                      {[
                        { icon: LockClosedIcon,   color: "text-emerald-300", bg: "bg-emerald-500/10 border-emerald-500/40", label: "01 · CONNECT", desc: "Read-only IAM role + External ID — assumed on demand." },
                        { icon: EyeIcon,          color: "text-blue-300",    bg: "bg-blue-500/10 border-blue-500/40",       label: "02 · SCAN",    desc: "Multi-region inventory across every resource kind." },
                        { icon: CpuChipIcon,      color: "text-violet-300",  bg: "bg-violet-500/10 border-violet-500/40",   label: "03 · REASON",  desc: "Risk × cost × compliance prioritisation." },
                        { icon: CommandLineIcon,  color: "text-fuchsia-300", bg: "bg-fuchsia-500/10 border-fuchsia-500/40", label: "04 · EXECUTE", desc: "Terraform / CLI plans — approval-gated apply." },
                        { icon: DocumentCheckIcon,color: "text-amber-300",   bg: "bg-amber-500/10 border-amber-500/40",     label: "05 · AUDIT",   desc: "Immutable trail · exportable evidence bundles." },
                      ].map((item) => {
                        const Icon = item.icon;
                        return (
                          <div key={item.label} className="relative px-3 py-2">
                            <div className={`relative z-10 w-10 h-10 rounded-xl ${item.bg} border-2 flex items-center justify-center shadow-[0_0_24px_-4px_rgba(139,92,246,0.4)] mb-3`}>
                              <Icon className={`h-4 w-4 ${item.color}`} />
                            </div>
                            <p className="text-[11px] font-mono font-bold text-white tracking-[0.12em] mb-1">{item.label}</p>
                            <p className="text-[11.5px] text-zinc-500 leading-relaxed max-w-[18ch]">{item.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── TRUST STRIP ─────────────────────────────────── */}
                <div>
                  <div className="flex items-center gap-2.5 mb-5">
                    <ShieldCheckIcon className="h-3.5 w-3.5 text-violet-300" />
                    <span className="text-[10px] font-mono text-violet-300/90 uppercase tracking-[0.22em]">// safety model</span>
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { Icon: ShieldCheckIcon, title: "Read-only by default",    detail: "IAM role grants only what the setup guide lists. Writes are opt-in.",            tone: "emerald" },
                      { Icon: LockClosedIcon,  title: "Zero stored credentials", detail: "Axiom assumes the role on demand. Nothing about your account persists at rest.", tone: "violet"  },
                      { Icon: BoltIcon,        title: "Approval-gated changes",  detail: "Every proposed action requires human review. Execution is reversible by design.", tone: "amber"   },
                      { Icon: SignalIcon,      title: "Real-time audit trail",   detail: "Every scan, plan, approval, and apply becomes an exportable audit record.",       tone: "cyan"    },
                    ].map(({ Icon, title, detail, tone }) => (
                      <MagneticCard key={title} tint={tone === "amber" ? "amber" : tone === "cyan" ? "cyan" : tone === "violet" ? "violet" : "emerald"} maxTilt={2.5} radius={180} className="rounded-xl h-full">
                        <div className="group relative rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 overflow-hidden h-full transition-colors hover:border-white/[0.18]">
                          <CornerBrackets />
                          <div aria-hidden className={`absolute -top-14 -right-14 w-36 h-36 rounded-full blur-[50px] pointer-events-none opacity-0 group-hover:opacity-80 transition-opacity ${
                            tone === "emerald" ? "bg-emerald-500/30" :
                            tone === "violet"  ? "bg-violet-500/30"  :
                            tone === "amber"   ? "bg-amber-500/30"   :
                                                  "bg-cyan-500/30"
                          }`} />
                          <div className="relative z-10">
                            <div className={`inline-flex w-9 h-9 rounded-lg items-center justify-center mb-4 border ${
                              tone === "emerald" ? "bg-emerald-500/10 border-emerald-500/30" :
                              tone === "violet"  ? "bg-violet-500/10 border-violet-500/30"   :
                              tone === "amber"   ? "bg-amber-500/10 border-amber-500/30"     :
                                                    "bg-cyan-500/10 border-cyan-500/30"
                            }`}>
                              <Icon className={`h-4 w-4 ${
                                tone === "emerald" ? "text-emerald-300" :
                                tone === "violet"  ? "text-violet-300"  :
                                tone === "amber"   ? "text-amber-300"   :
                                                      "text-cyan-300"
                              }`} />
                            </div>
                            <p className="text-[13px] font-semibold text-white mb-1.5 tracking-tight">{title}</p>
                            <p className="text-[12px] text-zinc-500 leading-relaxed">{detail}</p>
                          </div>
                        </div>
                      </MagneticCard>
                    ))}
                  </div>
                </div>
              </div>
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
                    <h1 className="text-2xl sm:text-3xl font-semibold mb-1.5 tracking-[-0.03em]">
                      Connect your <span className="text-gradient">AWS account</span>
                    </h1>
                    <p className="text-zinc-500 text-[13.5px] leading-relaxed">One click in AWS, one click back — no copy-paste.</p>
                  </div>

                  <AwsKeyConnect
                    onValidated={async ({ accountId, roleArn, externalId: validatedExternalId }) => {
                      setVerifiedAccount(accountId ?? null);
                      // Provision a scanner session + register the connector before advancing to scan.
                      try {
                        const startRes = await fetch("/api/cloud-operator/start", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ provider: "aws" }),
                        });
                        const startData = await startRes.json();
                        if (!startRes.ok || !startData.token) {
                          setError(startData.error ?? "Could not start a scan session. Try again in a moment.");
                          return;
                        }
                        setToken(startData.token);
                        const linkRes = await fetch(`/api/connectors/link?token=${startData.token}`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            connectorType: "aws",
                            authMethod: "assume-role",
                            roleArn,
                            awsAccountId: accountId ?? "",
                            externalId: validatedExternalId,
                          }),
                        });
                        if (!linkRes.ok) {
                          const linkData = await linkRes.json().catch(() => ({}));
                          setError(linkData.error ?? "Could not register the AWS connector. Try again in a moment.");
                          return;
                        }
                        try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
                        setTimeout(() => setStep(3), 1200);
                      } catch {
                        setError("Network error while finishing the AWS connection. Please try again.");
                      }
                    }}
                  />
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
            <div className="max-w-3xl mx-auto">
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
            <div className="max-w-3xl mx-auto">
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
            <div className="text-center max-w-3xl mx-auto">
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
