"use client";

import { FormEvent, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useAxiomPanel } from "@/lib/contexts/AxiomPanelContext";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowRightIcon,
  BoltIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  CloudIcon,
  CpuChipIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  SparklesIcon,
  ShieldCheckIcon,
  VariableIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  ArrowTopRightOnSquareIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { AxiomLoadingState } from "@/components/axiom-ui/AxiomLoadingState";
import { AxiomMetricCard } from "@/components/axiom-ui/AxiomMetricCard";
import { AxiomSection } from "@/components/axiom-ui/AxiomSection";
import { AxiomCard } from "@/components/axiom-ui/AxiomCard";
import { AxiomButton } from "@/components/axiom-ui/AxiomButton";
import { AxiomUpgradeModal } from "@/components/axiom-ui/AxiomUpgradeModal";
import type { UpgradeTrigger } from "@/components/axiom-ui/AxiomUpgradeModal";
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
  environmentSummary?: string;
  architectureGraph?: {
    nodes: Array<{ id: string; type: string; label?: string }>;
    edges: Array<{ from: string; to: string }>;
    region?: string;
  };
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
  awsSnapshot?: {
    accountId: string;
    callerArn: string;
    regions: string[];
    ec2InstanceCount: number;
    s3BucketCount: number;
    ec2?: { success: boolean; count: number; error?: string };
    s3?: { success: boolean; count: number; error?: string };
    flags: { singleRegion: boolean; noBackupsDetected: boolean };
    insights: Array<{ title: string; message: string; severity: "low" | "medium" | "high"; impact: string; actions: string[]; explanation?: string }>;
    scannedAt: string;
  } | null;
  previousAwsSnapshot?: {
    ec2InstanceCount: number;
    s3BucketCount: number;
    insights: Array<{ severity: "low" | "medium" | "high" }>;
    scannedAt: string;
  } | null;
};

type ConnectorStatusEntry = {
  status: string;
  linkedAt?: string;
  verifiedAccountId?: string;
  verifiedCallerArn?: string;
};

function ConnectorStatusDisplay({
  token,
  connectors,
}: {
  token: string | null;
  connectors: Record<string, ConnectorStatusEntry> | null;
}) {
  const aws = connectors?.aws;
  if (!aws) return null;
  if (aws.status === "unavailable") {
    return (
      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
        AWS connector is not enabled in this environment.
      </p>
    );
  }
  if (aws.status === "invalid") {
    return (
      <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
        Could not verify AWS role. Check Role ARN / External ID.
      </p>
    );
  }
  if (aws.status === "linked" && (aws.verifiedAccountId || aws.verifiedCallerArn)) {
    return (
      <div className="mt-1 space-y-0.5">
        {aws.verifiedAccountId && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Account: {aws.verifiedAccountId}</p>
        )}
        {aws.verifiedCallerArn && (
          <p className="text-xs text-slate-600 dark:text-slate-400 truncate" title={aws.verifiedCallerArn}>
            {aws.verifiedCallerArn}
          </p>
        )}
      </div>
    );
  }
  return null;
}

const AWS_BROKER_ACCOUNT_ID = "590183704419";
const AWS_EXTERNAL_ID_PREFIX = "cloudoperator";

function generateAwsExternalId(): string {
  return `${AWS_EXTERNAL_ID_PREFIX}-${Math.random().toString(36).slice(2, 10)}`;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-500 transition-colors"
        >
          <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-mono break-all whitespace-pre-wrap">
        {value}
      </pre>
    </div>
  );
}

function AWSConnectorForm({
  token,
  onConnected,
}: {
  token: string | null;
  onConnected: () => void;
}) {
  const [phase, setPhase] = useState<"instructions" | "validate">("instructions");
  const [externalId] = useState(generateAwsExternalId);
  const [roleArn, setRoleArn] = useState("");
  const [awsAccountId, setAwsAccountId] = useState("");
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [verifiedAccount, setVerifiedAccount] = useState<string | null>(null);

  const arnRegex = /^arn:aws(?:-cn|-us-gov)?:iam::\d{12}:role\/[\w+=,.@-]+$/;
  const arnAccountId = roleArn.match(/:(\d{12}):/)?.[1] ?? "";

  const handleValidate = async () => {
    setError(null);
    const trimmedArn = roleArn.trim();
    const trimmedAccountId = (awsAccountId.trim() || arnAccountId).trim();

    if (!trimmedArn) { setError("Role ARN is required."); return; }
    if (!arnRegex.test(trimmedArn)) { setError("Invalid Role ARN format. Expected: arn:aws:iam::123456789012:role/RoleName"); return; }
    if (!trimmedAccountId || !/^\d{12}$/.test(trimmedAccountId)) { setError("AWS Account ID is required (12 digits)."); return; }

    setValidating(true);
    try {
      const linkRes = await fetch(`/api/connectors/link?token=${token}`, {
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
        setError(linkData.error ?? "Connection validation failed.");
        return;
      }
      setConnected(true);
      setVerifiedAccount(linkData.account ?? trimmedAccountId);
      onConnected();
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setValidating(false);
    }
  };

  if (connected) {
    return (
      <AxiomCard className="p-5 border-l-4 border-l-emerald-500">
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircleIcon className="h-5 w-5" />
          AWS connected — Account {verifiedAccount}
        </div>
      </AxiomCard>
    );
  }

  return (
    <AxiomCard className="p-6 space-y-5">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
          <LockClosedIcon className="h-4 w-4 text-orange-500" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connect AWS via IAM Role</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Read-only access. No credentials stored. Revoke anytime.</p>
        </div>
      </div>

      {phase === "instructions" && (
        <div className="space-y-4">
          <div className="text-xs text-slate-600 dark:text-slate-400 space-y-3">
            <p>Create a cross-account IAM Role in your AWS console:</p>
            <ol className="list-decimal list-inside space-y-2 ml-1">
              <li>Go to <strong className="text-slate-800 dark:text-slate-200">IAM → Roles → Create Role</strong></li>
              <li>Select <strong className="text-slate-800 dark:text-slate-200">&quot;Another AWS account&quot;</strong> and enter:</li>
            </ol>
            <div className="space-y-2 ml-4">
              <CopyField label="Account ID" value={AWS_BROKER_ACCOUNT_ID} />
              <CopyField label="External ID (required)" value={externalId} />
            </div>
            <ol className="list-decimal list-inside space-y-2 ml-1" start={3}>
              <li>Attach <strong className="text-slate-800 dark:text-slate-200">ReadOnlyAccess</strong> managed policy</li>
              <li>Name it <strong className="text-slate-800 dark:text-slate-200">CloudOperatorReadOnly</strong> and create it</li>
              <li>Copy the <strong className="text-slate-800 dark:text-slate-200">Role ARN</strong> from the summary page</li>
            </ol>
          </div>
          <a
            href="https://console.aws.amazon.com/iam/home#/roles$new?step=type&roleType=crossAccount"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 hover:underline"
          >
            Open AWS IAM Console <ArrowTopRightOnSquareIcon className="h-3 w-3" />
          </a>
          <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-lg px-3 py-2">
            <ShieldCheckIcon className="h-4 w-4 flex-shrink-0" />
            No write access. No credentials stored. Revoke anytime from your AWS console.
          </div>
          <button
            onClick={() => setPhase("validate")}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
          >
            I&apos;ve created the role — enter ARN
            <ArrowRightIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {phase === "validate" && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Role ARN <span className="text-red-500">*</span>
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
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              AWS Account ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={awsAccountId}
              onChange={(e) => { setAwsAccountId(e.target.value.replace(/\D/g, "").slice(0, 12)); setError(null); }}
              placeholder="123456789012"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 text-sm font-mono"
            />
            {arnAccountId && awsAccountId && arnAccountId !== awsAccountId && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Account ID in ARN ({arnAccountId}) doesn&apos;t match the field above.</p>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 rounded-lg px-3 py-2">
              <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={() => setPhase("instructions")}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
            >
              ← Back to setup
            </button>
            <button
              onClick={handleValidate}
              disabled={validating || !roleArn.trim() || !token}
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 text-sm font-semibold transition-colors"
            >
              {validating ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <ShieldCheckIcon className="h-4 w-4" />
                  Validate Connection
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </AxiomCard>
  );
}

const AXIOM_CHAT_CONVERSATION_KEY = (t: string) => `axiom-chat-conversation:${t}`;
const AXIOM_CHAT_MESSAGES_KEY = (t: string) => `axiom-chat-messages:${t}`;

type DevOpsPlanStep =
  | { action: "run_plugin"; pluginId: string; input?: Record<string, unknown> }
  | { action: "generate_report" }
  | { action: "run_analysis" }
  | { action: "view_execution_history" }
  | { action: "export_report" };
type DevOpsPlan = { goal: string; steps: DevOpsPlanStep[] };
const MAX_DISPLAY_MESSAGES = 20;

const QUICK_ACTIONS = [
  { label: "Secure AWS account", message: "Secure my AWS account." },
  { label: "Run analysis", message: "Run the Cloud Operator analysis." },
  { label: "Run IAM scan", message: "Run an IAM exposure scan." },
  { label: "Discover Infrastructure", message: "Discover my AWS infrastructure (EC2, S3, RDS, VPC)." },
  { label: "Show execution history", message: "Show execution history." },
  { label: "Export pack", message: "Export the Axiom pack." },
] as const;

type SuggestedAction =
  | { type: "run_plugin"; pluginId: string }
  | { type: "view_execution_history" }
  | { type: "export_report" }
  | { type: "run_analysis" }
  | { type: "generate_report" }
  | { type: "open_connectors" }
  | { type: "connect_aws" }
  | { type: "learn_connect_aws" };

function actionLabel(a: SuggestedAction): string {
  switch (a.type) {
    case "run_plugin":
      return a.pluginId === "aws:iam-exposure-scan" ? "Run IAM scan" : a.pluginId === "aws:infra-discovery" ? "Discover Infrastructure" : a.pluginId === "aws:cost-explorer-summary" ? "View cost summary" : a.pluginId === "aws:s3-public-bucket-scan" ? "Scan S3 public buckets" : a.pluginId === "github:create-cicd-pipeline" ? "Create CI/CD pipeline" : a.pluginId;
    case "view_execution_history":
      return "View execution history";
    case "export_report":
      return "Export pack";
    case "run_analysis":
      return "Run analysis";
    case "generate_report":
      return "Send report";
    case "open_connectors":
      return "Open Connectors";
    case "connect_aws":
      return "Connect AWS";
    case "learn_connect_aws":
      return "Learn how to connect AWS";
    default:
      return "Action";
  }
}

type WorkflowStep = {
  id: number;
  label: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  action?: { label: string; tab?: string; message?: string };
};

function WorkflowProgressPanel({
  token,
  steps,
  onTabChange,
  onSendToAskAxiom,
}: {
  token: string | null;
  steps: WorkflowStep[];
  onTabChange: (tab: string) => void;
  onSendToAskAxiom?: (message: string) => void;
}) {
  if (!token || steps.length === 0) return null;

  const handleAction = (s: WorkflowStep) => {
    if (!s.action) return;
    if (s.action.message && onSendToAskAxiom) {
      onSendToAskAxiom(s.action.message);
    } else if (s.action.tab) {
      onTabChange(s.action.tab);
    }
  };

  return (
    <AxiomCard className="p-4 mb-6 border-l-4 border-l-violet-500">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
        Axiom Workflow
      </h3>
      <div className="flex flex-wrap items-center gap-2 sm:gap-0">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-colors ${
                  s.status === "COMPLETE"
                    ? "bg-emerald-500 text-white"
                    : s.status === "IN_PROGRESS"
                      ? "bg-violet-500 text-white ring-2 ring-violet-300 dark:ring-violet-700"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                }`}
              >
                {s.status === "COMPLETE" ? (
                  <CheckCircleIcon className="h-5 w-5" />
                ) : (
                  s.id
                )}
              </div>
              <span
                className={`mt-1.5 text-[11px] font-medium max-w-[72px] text-center leading-tight ${
                  s.status === "COMPLETE"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : s.status === "IN_PROGRESS"
                      ? "text-violet-600 dark:text-violet-400"
                      : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {s.label}
              </span>
              {s.action && (
                <button
                  type="button"
                  onClick={() => handleAction(s)}
                  className="mt-1 text-[10px] font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 hover:underline"
                >
                  {s.action.label}
                </button>
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`hidden sm:block w-8 sm:w-12 lg:w-16 h-0.5 mx-1 ${
                  s.status === "COMPLETE" ? "bg-emerald-300 dark:bg-emerald-700" : "bg-slate-200 dark:bg-slate-700"
                }`}
                aria-hidden
              />
            )}
          </div>
        ))}
      </div>
    </AxiomCard>
  );
}

type EnvironmentStatus = {
  connectors: { aws?: boolean; github?: boolean };
  lastScanTimestamp: string | null;
  hasIamScan: boolean;
  axiomScore: { infrastructureScore?: number | null; riskExposureLevel?: string | null } | null;
  suggestedActions: Array<{
    id: string;
    label: string;
    type: "run_plugin" | "view_execution_history" | "run_analysis";
    pluginId?: string;
  }>;
};

function AskAxiomPanel({ token, onTabChange }: { token: string | null; onTabChange?: (tab: string) => void }) {
  const axiomPanel = useAxiomPanel();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    axiomPanel?.setIsAxiomOpen(open);
  }, [open, axiomPanel]);
  const [envStatus, setEnvStatus] = useState<EnvironmentStatus | null>(null);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      content: string;
      actions?: SuggestedAction[];
      plan?: DevOpsPlan;
      requiresApproval?: boolean;
    }>
  >([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  conversationIdRef.current = conversationId;

  useEffect(() => {
    if (!token) return;
    fetch(`/api/cloud-operator/environment-status?token=${encodeURIComponent(token)}`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => data && setEnvStatus(data))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    try {
      const cid = localStorage.getItem(AXIOM_CHAT_CONVERSATION_KEY(token));
      conversationIdRef.current = cid || null;
      setConversationId(cid || null);
      const raw = localStorage.getItem(AXIOM_CHAT_MESSAGES_KEY(token));
      if (raw) {
        const parsed = JSON.parse(raw) as Array<{
          id: string;
          role: "user" | "assistant";
          content: string;
          actions?: SuggestedAction[];
          plan?: DevOpsPlan;
          requiresApproval?: boolean;
        }>;
        setMessages(parsed.slice(-MAX_DISPLAY_MESSAGES));
      } else {
        setMessages([]);
      }
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined" || !token || messages.length === 0) return;
    try {
      const toSave = messages.slice(-MAX_DISPLAY_MESSAGES).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        ...(m.actions?.length ? { actions: m.actions } : {}),
        ...(m.plan ? { plan: m.plan, requiresApproval: m.requiresApproval } : {}),
      }));
      localStorage.setItem(AXIOM_CHAT_MESSAGES_KEY(token), JSON.stringify(toSave));
    } catch {
      // ignore
    }
  }, [token, messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !token || loading) return;
      const msg = text.trim();
      setInput("");
      setError(null);
      const userMsg = { id: crypto.randomUUID(), role: "user" as const, content: msg };
      setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), userMsg]);
      setLoading(true);

      try {
        const res = await fetch("/api/cloud-operator/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: conversationIdRef.current || undefined, message: msg, token }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data?.error ?? "Something went wrong. Please try again.");
          setMessages((prev) => prev.slice(0, -1));
          return;
        }

        if (data.conversationId) {
          conversationIdRef.current = data.conversationId;
          setConversationId(data.conversationId);
          localStorage.setItem(AXIOM_CHAT_CONVERSATION_KEY(token), data.conversationId);
        }

        const assistantContent = [
          data.assistantMessage ?? "",
          data.toolResultsSummary?.length ? `\n\n${data.toolResultsSummary.join("\n")}` : "",
        ]
          .filter(Boolean)
          .join("");
        const assistantMsg = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          content: assistantContent,
          actions: data.actions as SuggestedAction[] | undefined,
          plan: data.plan as DevOpsPlan | undefined,
          requiresApproval: data.requiresApproval,
        };
        setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), assistantMsg]);
      } catch {
        setError("Network error. Please try again.");
        setMessages((prev) => prev.slice(0, -1));
      } finally {
        setLoading(false);
      }
    },
    [token, loading]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [planExecuting, setPlanExecuting] = useState<string | null>(null);

  const executePlan = useCallback(
    async (plan: DevOpsPlan, messageId: string) => {
      if (!token || planExecuting) return;
      setPlanExecuting(messageId);
      setError(null);
      try {
        const hasDestructiveStep = plan.steps.some(
          (s) => s.action === "run_plugin" && s.pluginId === "aws:disable-unused-access-key"
        );
        const res = await fetch("/api/cloud-operator/execute-plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            plan,
            ...(hasDestructiveStep ? { confirmation: "CONFIRM APPLY" } : {}),
          }),
        });
        const data = await res.json();
        if (res.ok) {
          const summary = data.summary ?? "Plan completed.";
          const details = data.results
            ?.map((r: { step: number; action: string; pluginId?: string; ok: boolean; summary?: string }) =>
              `• Step ${r.step}: ${r.action}${r.pluginId ? ` (${r.pluginId})` : ""} — ${r.ok ? r.summary ?? "OK" : "failed"}`
            )
            .join("\n");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === messageId && m.plan
                ? { ...m, plan: undefined, requiresApproval: false, content: `${m.content}\n\n**Execution results:**\n${summary}\n${details ?? ""}` }
                : m
            )
          );
        } else {
          setError(data?.error ?? "Plan execution failed");
        }
      } catch {
        setError("Plan execution failed");
      } finally {
        setPlanExecuting(null);
      }
    },
    [token, planExecuting]
  );

  const executeAction = useCallback(
    async (action: SuggestedAction) => {
      if (!token) return;
      const key = action.type === "run_plugin" ? `${action.type}:${action.pluginId}` : action.type;
      setActionLoading(key);
      setError(null);
      try {
        if (action.type === "run_plugin") {
          const res = await fetch("/api/execution/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pluginId: action.pluginId, token, dryRun: true }),
          });
          const data = await res.json();
          if (res.ok) {
            const summary = data.resultSummary ?? "Done";
            setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), { id: crypto.randomUUID(), role: "assistant", content: `${action.pluginId} completed. ${summary}` }]);
          } else {
            setError(data?.error ?? "Execution failed");
          }
        } else if (action.type === "view_execution_history") {
          const res = await fetch(`/api/cloud-operator/execution-history?token=${encodeURIComponent(token)}`);
          const data = await res.json();
          if (res.ok && data.entries?.length) {
            const lines = data.entries.slice(0, 5).map((e: { pluginId: string; status: string; summary?: string }) =>
              `• ${e.pluginId} (${e.status}): ${e.summary ?? ""}`
            );
            const reply = `Execution history (${data.entries.length} entries):\n${lines.join("\n")}`;
            setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), { id: crypto.randomUUID(), role: "assistant", content: reply }]);
          } else if (res.ok) {
            setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), { id: crypto.randomUUID(), role: "assistant", content: "No execution history yet. Run a scan to create entries." }]);
          } else {
            setError(data?.error ?? "Failed to fetch history");
          }
        } else if (action.type === "export_report") {
          const res = await fetch(`/api/cloud-operator/export?token=${encodeURIComponent(token)}`);
          if (res.ok) {
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "axiom-export-pack.zip";
            a.click();
            URL.revokeObjectURL(url);
            setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), { id: crypto.randomUUID(), role: "assistant", content: "Export pack downloaded. Check your downloads folder." }]);
          } else {
            const data = await res.json();
            setError(data?.error ?? "Export failed");
          }
        } else if (action.type === "run_analysis") {
          const res = await fetch(`/api/cloud-operator/trigger?token=${encodeURIComponent(token)}`, {
            method: "POST",
          });
          const data = await res.json();
          if (res.ok) {
            setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), { id: crypto.randomUUID(), role: "assistant", content: "Analysis triggered. Refresh the page or wait a moment for it to complete." }]);
          } else {
            setError(data?.error ?? "Trigger failed");
          }
        } else if (action.type === "generate_report") {
          const res = await fetch(`/api/cloud-operator/send-report?token=${encodeURIComponent(token)}`, {
            method: "POST",
          });
          const data = await res.json();
          if (res.ok) {
            setMessages((prev) => [...prev.slice(-MAX_DISPLAY_MESSAGES - 1), { id: crypto.randomUUID(), role: "assistant", content: "Report sent to your email." }]);
          } else {
            setError(data?.error ?? "Failed to send report");
          }
        } else if (
          (action.type === "open_connectors" || action.type === "connect_aws" || action.type === "learn_connect_aws") &&
          onTabChange
        ) {
          onTabChange("connectors");
        }
      } catch {
        setError("Request failed");
      } finally {
        setActionLoading(null);
      }
    },
    [token, onTabChange]
  );

  if (!token) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Ask Axiom"
        className="fixed right-4 bottom-6 z-[9998] flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-slate-100 shadow-lg border-2 border-slate-200 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-violet-500 transition-all hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
          <ChatBubbleLeftRightIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <span className="text-sm font-semibold pr-1">Ask Axiom</span>
      </button>

      {open && (
        <div
          className="fixed right-0 top-0 bottom-0 w-full max-w-md z-[9999] flex flex-col overflow-hidden bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl"
          role="dialog"
          aria-label="Ask Axiom chat"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-violet-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-sm font-semibold text-white">Ask Axiom</h2>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <p className="px-4 py-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50">
            Read-only by default. To apply changes, type: <strong>CONFIRM APPLY</strong>
          </p>

          {envStatus?.suggestedActions && envStatus.suggestedActions.length > 0 && (
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-2">Suggested for you</p>
              <div className="flex flex-wrap gap-2">
                {envStatus.suggestedActions.map((s) => {
                  const action: SuggestedAction =
                    s.type === "run_plugin" && s.pluginId
                      ? { type: "run_plugin", pluginId: s.pluginId }
                      : s.type === "run_analysis"
                        ? { type: "run_analysis" }
                        : { type: "view_execution_history" };
                  const key = action.type === "run_plugin" ? `${action.type}:${action.pluginId}` : action.type;
                  const loading = actionLoading === (action.type === "run_plugin" ? `${action.type}:${action.pluginId}` : action.type);
                  return (
                    <button
                      key={s.id}
                      onClick={() => executeAction(action)}
                      disabled={!!actionLoading}
                      className="flex items-center gap-2 rounded-lg border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30 px-3 py-2 text-left text-xs font-medium text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50 transition-colors"
                    >
                      {loading ? "..." : s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-800/50"
          >
            {messages.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center text-center py-8">
                <ChatBubbleLeftRightIcon className="h-10 w-10 text-slate-400 dark:text-slate-500 mb-3" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Ask about your infrastructure</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Run scans, export, or get help.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {QUICK_ACTIONS.map((a) => (
                    <button
                      key={a.label}
                      onClick={() => sendMessage(a.message)}
                      className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-left text-xs text-slate-600 dark:text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400"
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m) => (
                  <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-violet-600 text-white rounded-br-md"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-md"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                    {m.role === "assistant" && m.plan && m.requiresApproval && (
                      <div className="mt-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 p-3">
                        <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 mb-2">
                          Execution Plan — {m.plan.goal}
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-xs text-slate-700 dark:text-slate-300 mb-3">
                          {m.plan.steps.map((s, i) => (
                            <li key={i}>
                              {s.action === "run_plugin" ? `Run ${s.pluginId}` : s.action.replace(/_/g, " ")}
                            </li>
                          ))}
                        </ol>
                        <button
                          onClick={() => executePlan(m.plan!, m.id)}
                          disabled={!!planExecuting}
                          className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          {planExecuting === m.id ? "Executing…" : "Approve & Execute"}
                        </button>
                      </div>
                    )}
                    {m.role === "assistant" && m.actions && m.actions.length > 0 && !m.plan && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.actions.map((a, i) => {
                          const key = `${a.type}${a.type === "run_plugin" ? `-${a.pluginId}` : ""}-${i}`;
                          const loading = actionLoading === (a.type === "run_plugin" ? `${a.type}:${a.pluginId}` : a.type);
                          return (
                            <button
                              key={key}
                              onClick={() => executeAction(a)}
                              disabled={!!actionLoading}
                              className="rounded-lg border border-violet-300 dark:border-violet-600 bg-violet-50 dark:bg-violet-900/30 px-2.5 py-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/50 disabled:opacity-50"
                            >
                              {loading ? "..." : actionLabel(a)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex gap-1 rounded-2xl rounded-bl-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-600" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-600 [animation-delay:0.2s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-violet-600 [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 p-3 bg-white dark:bg-slate-900">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.message)}
                  disabled={loading}
                  className="rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 hover:text-violet-700 dark:hover:text-violet-300 disabled:opacity-50"
                >
                  {a.label}
                </button>
              ))}
            </div>
            {error && <p className="mb-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Axiom..."
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-60"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-violet-600 px-3 py-2.5 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Send"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

type IAMFinding = {
  type: string;
  severity: string;
  principal?: string;
  principalType?: string;
  detail: string;
  policyArn?: string;
  accessKeyId?: string;
  daysUnused?: number;
};

type IAMScanData = {
  status?: string;
  region?: string;
  users?: Array<{
    userName: string;
    arn: string;
    accessKeys: Array<{ accessKeyId: string; status: string; lastUsed?: string; daysUnused?: number | null }>;
    attachedPolicies: string[];
  }>;
  roles?: Array<{ roleName: string; arn: string; attachedPolicies: string[] }>;
  findings?: IAMFinding[];
  summary?: {
    usersCount: number;
    rolesCount: number;
    findingsCount: number;
    findingsByType?: Record<string, number>;
  };
};

function RunScanCard({
  token,
  connectorStatus,
  onSuccess,
}: {
  token: string | null;
  connectorStatus: Record<string, ConnectorStatusEntry> | null;
  onSuccess?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: string; resultSummary?: string; error?: string; data?: IAMScanData } | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<IAMFinding | null>(null);
  const [disabling, setDisabling] = useState(false);
  const [disableResult, setDisableResult] = useState<{ success: boolean; error?: string } | null>(null);

  const aws = connectorStatus?.aws;
  const awsLinked = aws?.status === "linked" && !!aws?.verifiedAccountId;

  const runScan = async () => {
    if (!token) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/execution/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "aws:iam-exposure-scan",
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
        data: data.data as IAMScanData | undefined,
      });
      if (data.status === "success") onSuccess?.();
    } catch (e) {
      setResult({
        status: "failed",
        error: e instanceof Error ? e.message : "Scan failed",
      });
    } finally {
      setRunning(false);
    }
  };

  const runDisableKey = async (f: IAMFinding) => {
    if (!token || !f.accessKeyId || !f.principal || f.type !== "UnusedAccessKey") return;
    setDisabling(true);
    setDisableResult(null);
    try {
      const res = await fetch("/api/execution/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "aws:disable-unused-access-key",
          input: { accessKeyId: f.accessKeyId, userName: f.principal },
          apply: true,
          confirmation: "CONFIRM APPLY",
          token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to disable key");
      setDisableResult({ success: true });
      setConfirmDisable(null);
      onSuccess?.();
      if (result?.data?.findings) {
        setResult({
          ...result,
          data: {
            ...result.data,
            findings: result.data.findings.filter((x) => !(x.type === "UnusedAccessKey" && x.accessKeyId === f.accessKeyId)),
            summary: result.data.summary
              ? { ...result.data.summary, findingsCount: Math.max(0, result.data.summary.findingsCount - 1) }
              : undefined,
          },
        });
      }
    } catch (e) {
      setDisableResult({ success: false, error: e instanceof Error ? e.message : "Failed" });
    } finally {
      setDisabling(false);
    }
  };

  return (
    <AxiomCard className="p-5 border-l-4 border-l-amber-500">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
        <MagnifyingGlassIcon className="h-4 w-4 text-amber-500" />
        IAM Exposure Scan
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
        Read-only scan of IAM users, roles, policies. Detects AdministratorAccess, wildcard policies, unused access keys (&gt;90 days).
      </p>
      {!awsLinked && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          AWS not connected. Link and verify your AWS account in Connectors to run the scan.
        </p>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 italic">
        Read-only by default. No changes are made.
      </p>
      <button
        type="button"
        onClick={runScan}
        disabled={running || !token || !awsLinked}
        className="inline-flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50 disabled:opacity-50"
      >
        {running ? "Running…" : "Run IAM Scan (Read-only)"}
        <MagnifyingGlassIcon className="h-3.5 w-3.5" />
      </button>
      {result && (
        <div className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3 text-xs space-y-3">
          <p className={`font-medium ${result.status === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {result.status === "success" ? "Success" : "Failed"}
          </p>
          {result.resultSummary && <p className="text-slate-600 dark:text-slate-400">{result.resultSummary}</p>}
          {result.error && <p className="text-rose-600 dark:text-rose-400">{result.error}</p>}
          {result.status === "success" && result.data && (
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
              {result.data.summary && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded bg-white dark:bg-slate-800/80 px-2 py-1">
                    <span className="text-slate-500 dark:text-slate-400">Users</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{result.data.summary.usersCount}</p>
                  </div>
                  <div className="rounded bg-white dark:bg-slate-800/80 px-2 py-1">
                    <span className="text-slate-500 dark:text-slate-400">Roles</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{result.data.summary.rolesCount}</p>
                  </div>
                  <div className="rounded bg-white dark:bg-slate-800/80 px-2 py-1">
                    <span className="text-slate-500 dark:text-slate-400">Findings</span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{result.data.summary.findingsCount}</p>
                  </div>
                </div>
              )}
              {result.data.findings && result.data.findings.length > 0 && (
                <div>
                  <p className="font-medium text-slate-700 dark:text-slate-300 mb-1">Findings ({result.data.findings.length})</p>
                  {confirmDisable && (
                    <div className="mb-2 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/30 p-2">
                      <p className="text-xs text-slate-700 dark:text-slate-300 mb-2">
                        Disable unused key {confirmDisable.accessKeyId?.slice(0, 8)}**** for user {confirmDisable.principal}?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => runDisableKey(confirmDisable)}
                          disabled={disabling}
                          className="rounded px-2 py-1 text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                        >
                          {disabling ? "Disabling…" : "Confirm Disable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmDisable(null); setDisableResult(null); }}
                          disabled={disabling}
                          className="rounded px-2 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600"
                        >
                          Cancel
                        </button>
                      </div>
                      {disableResult && (
                        <p className={`mt-2 text-xs ${disableResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {disableResult.success ? "Key disabled." : disableResult.error}
                        </p>
                      )}
                    </div>
                  )}
                  <ul className="space-y-1 max-h-48 overflow-y-auto">
                    {result.data.findings.map((f, i) => (
                      <li
                        key={i}
                        className={`flex flex-wrap items-center gap-1 rounded px-2 py-1 ${
                          f.severity === "high"
                            ? "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-200"
                            : f.severity === "medium"
                              ? "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200"
                              : "bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span className="font-medium">{f.type}</span>
                        <span className="text-[10px] uppercase font-semibold opacity-80">({f.severity})</span>
                        {f.principal && <span>— {f.principal}</span>}
                        <span>{f.detail}</span>
                        {f.daysUnused != null && <span>({f.daysUnused}d unused)</span>}
                        {f.type === "UnusedAccessKey" && f.accessKeyId && f.principal && (
                          <button
                            type="button"
                            onClick={() => setConfirmDisable(f)}
                            className="ml-auto rounded px-2 py-0.5 text-[10px] font-medium bg-slate-700 dark:bg-slate-600 text-white hover:bg-slate-800 dark:hover:bg-slate-500"
                          >
                            Disable Key
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.data.users && result.data.users.length > 0 && (
                <details className="group">
                  <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">Users ({result.data.users.length})</summary>
                  <ul className="mt-1 space-y-0.5 pl-2 text-slate-600 dark:text-slate-400">
                    {result.data.users.slice(0, 10).map((u) => (
                      <li key={u.userName}>
                        {u.userName} — {u.accessKeys?.length ?? 0} key(s), {u.attachedPolicies?.length ?? 0} policy(s)
                      </li>
                    ))}
                    {result.data.users.length > 10 && (
                      <li className="text-slate-500">+{result.data.users.length - 10} more</li>
                    )}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </AxiomCard>
  );
}

type InfraDiscoveryData = {
  ec2Count?: number;
  s3Count?: number;
  rdsCount?: number;
  vpcCount?: number;
  summary?: string;
  region?: string;
};

function InfraDiscoveryCard({
  token,
  connectorStatus,
  onSuccess,
}: {
  token: string | null;
  connectorStatus: Record<string, ConnectorStatusEntry> | null;
  onSuccess?: () => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ status: string; resultSummary?: string; error?: string; data?: InfraDiscoveryData } | null>(null);

  const aws = connectorStatus?.aws;
  const awsLinked = aws?.status === "linked" && !!aws?.verifiedAccountId;

  const runDiscovery = async () => {
    if (!token) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await fetch("/api/execution/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pluginId: "aws:infra-discovery",
          dryRun: true,
          input: {},
          token,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      setResult({
        status: data.status ?? "unknown",
        resultSummary: data.resultSummary,
        error: data.error,
        data: data.data as InfraDiscoveryData | undefined,
      });
      if (data.status === "success") onSuccess?.();
    } catch (e) {
      setResult({
        status: "failed",
        error: e instanceof Error ? e.message : "Discovery failed",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <AxiomCard className="p-5 border-l-4 border-l-indigo-500">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
        <CloudIcon className="h-4 w-4 text-indigo-500" />
        Infrastructure Discovery
      </h3>
      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
        Discover EC2 instances, S3 buckets, RDS databases, and VPCs in your AWS account. Read-only.
      </p>
      {!awsLinked && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
          AWS not connected. Link and verify your AWS account in Connectors to run discovery.
        </p>
      )}
      <AxiomButton
        onClick={runDiscovery}
        disabled={running || !token || !awsLinked}
        className="bg-indigo-600 hover:bg-indigo-700 text-white"
      >
        {running ? "Discovering…" : "Discover Infrastructure"}
      </AxiomButton>
      {result && (
        <div className="mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50">
          {result.status === "success" && result.data ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-500 dark:text-slate-400">EC2</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{result.data.ec2Count ?? 0}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">S3</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{result.data.s3Count ?? 0}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">RDS</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{result.data.rdsCount ?? 0}</p>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">VPC</span>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{result.data.vpcCount ?? 0}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-rose-600 dark:text-rose-400">{result.error ?? "Discovery failed"}</p>
          )}
        </div>
      )}
    </AxiomCard>
  );
}

type ArchitectureGraphData = {
  nodes: Array<{ id: string; type: string; label?: string }>;
  edges: Array<{ from: string; to: string }>;
  region?: string;
};

function ArchitectureGraphView({ graph }: { graph: ArchitectureGraphData }) {
  const { nodes, edges, region } = graph;
  if (!nodes.length) return null;

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const typeColors: Record<string, string> = {
    VPC: "bg-violet-100 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700 text-violet-800 dark:text-violet-200",
    EC2: "bg-amber-100 dark:bg-amber-900/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-200",
    RDS: "bg-emerald-100 dark:bg-emerald-900/40 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200",
    S3: "bg-sky-100 dark:bg-sky-900/40 border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200",
  };

  // Simple layout: VPCs with their children (EC2/RDS), S3 standalone
  const vpcNodes = nodes.filter((n) => n.type === "VPC");
  const s3Nodes = nodes.filter((n) => n.type === "S3");

  return (
    <AxiomCard className="p-5 border-l-4 border-l-violet-500">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
        <ChartBarIcon className="h-4 w-4 text-violet-500" />
        Architecture Overview
        {region && (
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({region})</span>
        )}
      </h3>
      <div className="space-y-4">
        {/* VPCs and their children */}
        <div className="space-y-3">
          {vpcNodes.map((vpc) => {
            const children = edges
              .filter((e) => e.from === vpc.id)
              .map((e) => nodeMap.get(e.to))
              .filter(Boolean) as typeof nodes;
            return (
              <div key={vpc.id} className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div
                  className={`px-3 py-2 border-b border-slate-200 dark:border-slate-700 font-medium text-xs ${typeColors["VPC"] ?? "bg-slate-100 dark:bg-slate-800"}`}
                >
                  {vpc.label ?? vpc.type}
                </div>
                <div className="p-2 flex flex-wrap gap-2">
                  {children.map((c) => (
                    <span
                      key={c.id}
                      className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${typeColors[c.type] ?? "bg-slate-100 dark:bg-slate-800"}`}
                    >
                      {c.label ?? c.type}
                    </span>
                  ))}
                  {children.length === 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">Empty VPC</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* S3 buckets (standalone) */}
        {s3Nodes.length > 0 && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-2">Storage (S3)</span>
            <div className="flex flex-wrap gap-2">
              {s3Nodes.map((n) => (
                <span
                  key={n.id}
                  className={`inline-flex px-2 py-1 rounded text-xs font-medium border ${typeColors["S3"] ?? "bg-slate-100 dark:bg-slate-800"}`}
                >
                  {n.label ?? n.type}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Generated from infrastructure discovery. Run &quot;Discover Infrastructure&quot; in Connectors to refresh.
      </p>
    </AxiomCard>
  );
}

type ExecutionLogEntry = {
  id: string;
  action?: string;
  pluginId: string;
  status: string;
  dryRun: boolean;
  executedAt: string;
  summary: string;
};

function CloudTimelinePanel({ token }: { token: string | null }) {
  const [entries, setEntries] = useState<ExecutionLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/cloud-operator/execution-history?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.entries) setEntries(data.entries);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <AxiomSection className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Cloud Timeline</h2>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Execution logs, scans, and fixes applied. Sorted by time (most recent first).
      </p>
      {loading ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">No timeline entries yet. Run a scan or apply a fix.</p>
      ) : (
        <div className="relative">
          <div className="absolute left-3 top-0 bottom-0 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
          <ul className="space-y-0">
            {entries.map((e) => (
              <li key={e.id} className="relative flex gap-4 pl-10 pb-4 last:pb-0">
                <div
                  className={`absolute left-0 w-3 h-3 rounded-full mt-1.5 -translate-x-[5px] ${
                    e.status === "success"
                      ? "bg-emerald-500"
                      : e.status === "failed"
                        ? "bg-rose-500"
                        : "bg-slate-400 dark:bg-slate-500"
                  }`}
                  aria-hidden
                />
                <div className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {e.action ?? "plugin_run"}
                    </span>
                    <code className="text-xs font-mono text-slate-600 dark:text-slate-400">{e.pluginId}</code>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        e.status === "success"
                          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300"
                          : e.status === "failed"
                            ? "bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {e.status}
                    </span>
                    {e.dryRun && (
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                        dry-run
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span>{new Date(e.executedAt).toLocaleString()}</span>
                  </div>
                  {e.summary && (
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 truncate">{e.summary}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AxiomSection>
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
  const [activeTab, setActiveTab] = useState<"overview" | "roadmap" | "playbooks" | "strategic" | "trends" | "export" | "connectors" | "timeline">("overview");
  const [applyFixSelected, setApplyFixSelected] = useState<Set<number>>(new Set());
  const [applyFixSubmitting, setApplyFixSubmitting] = useState(false);
  const [applyFixResult, setApplyFixResult] = useState<{ success?: boolean; message?: string } | null>(null);
  const [connectorStatus, setConnectorStatus] = useState<Record<string, ConnectorStatusEntry> | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<WorkflowStep[]>([]);
  const [awsSnapshot, setAwsSnapshot] = useState<OperatorStatus["awsSnapshot"]>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [formValid, setFormValid] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeTrigger, setUpgradeTrigger] = useState<UpgradeTrigger>("fix-automatically");
  const [upgradeInsightTitle, setUpgradeInsightTitle] = useState<string | undefined>();

  const openUpgradeModal = useCallback((trigger: UpgradeTrigger, insightTitle?: string) => {
    setUpgradeTrigger(trigger);
    setUpgradeInsightTitle(insightTitle);
    setUpgradeModalOpen(true);
  }, []);

  const fetchAwsSnapshot = useCallback(async () => {
    if (!token) return;
    setSnapshotLoading(true);
    try {
      const res = await fetch(`/api/cloud-operator/aws-snapshot?token=${encodeURIComponent(token)}`);
      if (res.ok) {
        const data = await res.json();
        setAwsSnapshot(data);
      }
    } catch {
      // ignore — snapshot is optional
    } finally {
      setSnapshotLoading(false);
    }
  }, [token]);

  const checkFormValidity = useCallback(() => {
    if (formRef.current) setFormValid(formRef.current.checkValidity());
  }, []);

  const fetchConnectorStatus = useCallback(async () => {
    if (!token) return null;
    try {
      const res = await fetch(`/api/connectors/status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok && data.connectors) return data.connectors as Record<string, ConnectorStatusEntry>;
    } catch {
      // ignore
    }
    return null;
  }, [token]);

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

  const fetchWorkflowStatus = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/cloud-operator/workflow-status?token=${encodeURIComponent(token)}`);
      const data = await res.json();
      if (res.ok && data.steps) setWorkflowSteps(data.steps);
    } catch {
      setWorkflowSteps([]);
    }
  }, [token]);

  useEffect(() => {
    if (token && activeTab === "connectors") {
      fetchConnectorStatus().then((c) => {
        if (c) setConnectorStatus(c);
        fetchWorkflowStatus();
      });
    }
  }, [token, activeTab, fetchConnectorStatus, fetchWorkflowStatus]);

  useEffect(() => {
    if (token && isReady) fetchWorkflowStatus();
  }, [token, isReady, fetchWorkflowStatus]);

  // Load cached snapshot from status payload, fetch live on overview tab
  useEffect(() => {
    if (status?.awsSnapshot && !awsSnapshot) {
      setAwsSnapshot(status.awsSnapshot);
    }
  }, [status?.awsSnapshot, awsSnapshot]);

  useEffect(() => {
    if (token && isReady && activeTab === "overview" && !awsSnapshot && !snapshotLoading) {
      fetchAwsSnapshot();
    }
  }, [token, isReady, activeTab, awsSnapshot, snapshotLoading, fetchAwsSnapshot]);

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
            status && status.outputStatus === "ready" ? (
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircleIcon className="h-4 w-4" />
                Analysis ready
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                Loading analysis…
              </span>
            )
          )}
        </div>

        <Reveal>
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
        </Reveal>

        {inDashboard && !status && (
          <Reveal delay={0.1}>
          <section className="mb-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shadow-lg p-12">
            <AxiomLoadingState
              variant="full"
              message="Loading your Operator analysis…"
            />
            <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Connecting to your cloud profile, preparing Roadmap, Playbooks, and insights…
            </p>
          </section>
          </Reveal>
        )}

        {inDashboard && status && (
          <section className="mb-8">
            <div className="grid md:grid-cols-5 gap-3">
              {status.outputStatus !== "ready" ? (
                <div className="col-span-full flex flex-col gap-4 w-full">
                  <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-6">
                    <AxiomLoadingState
                      variant="compact"
                      message="Generating your Operator plan…"
                      showCloudIcons={false}
                    />
                    <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-3">
                      Loading Roadmap, Playbooks, Strategic brief & more…
                    </p>
                  </div>
                  <div className="grid md:grid-cols-5 gap-3">
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
                  </div>
                </div>
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
            <form
              ref={formRef}
              onSubmit={handleSubmit}
              onChange={checkFormValidity}
              onInput={checkFormValidity}
              className="operator-form lg:col-span-2"
            >
              {/* Glassmorphism dark card with gradient border */}
              <div className="relative rounded-3xl overflow-hidden">
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/10 to-cyan-500/20 blur-xl" />
                <div className="absolute inset-[1px] rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
                <div className="relative rounded-3xl border border-white/10 bg-slate-900/90 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/30 ring-1 ring-white/5">
                  {/* Hero header with glow */}
                  <div className="relative px-6 md:px-10 pt-8 pb-8 border-b border-white/5">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-fuchsia-600/10" />
                    <div className="relative">
                      <span className="inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-1.5 text-xs font-semibold text-violet-300">
                        <SparklesIcon className="h-3.5 w-3.5" />
                        AI Cloud Operator
                      </span>
                      <h2 className="mt-4 text-2xl md:text-3xl font-extrabold tracking-tight">
                        <span className="bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                          Configure your infrastructure
                        </span>
                      </h2>
                      <p className="mt-2 text-sm text-slate-400 max-w-xl">
                        Answer a few questions. Get a tailored 30-day roadmap, playbooks, and automation signals.
                      </p>
                    </div>
                  </div>

                  <div className="p-6 md:p-10 space-y-8">
                  {error && (
                    <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 px-5 py-4 text-sm text-rose-300">
                      {error}
                    </div>
                  )}

                  <div className="space-y-7">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/80">
                      Project
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />
                  </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    What are you building?
                  </label>
                  <select
                    name="projectType"
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07] hover:border-white/20"
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
                  <label className="block text-sm font-medium text-slate-400 mb-3">
                    Where is it hosted?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {HOSTING_PROVIDERS.map((p) => (
                      <label
                        key={p}
                        className="group flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-medium text-slate-300 cursor-pointer transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white has-[:checked]:border-violet-500 has-[:checked]:bg-violet-500/20 has-[:checked]:text-white has-[:checked]:shadow-[0_0_20px_rgba(139,92,246,0.3)]"
                      >
                        <input
                          type="radio"
                          name="hostingProvider"
                          value={p}
                          className="sr-only"
                          required
                        />
                        <span>{p}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Monthly cloud spend (approx.)
                    </label>
                    <input
                      name="monthlySpend"
                      type="number"
                      min={0}
                      placeholder="e.g. 5000"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Expected traffic level
                    </label>
                    <div className="flex gap-2">
                      {TRAFFIC_LEVELS.map((level) => (
                        <label
                          key={level}
                          className="flex-1 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs sm:text-sm font-medium text-slate-300 cursor-pointer transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white has-[:checked]:border-violet-500 has-[:checked]:bg-violet-500/20 has-[:checked]:text-white has-[:checked]:shadow-[0_0_15px_rgba(139,92,246,0.25)]"
                        >
                          <input
                            type="radio"
                            name="trafficLevel"
                            value={level}
                            className="sr-only"
                            required
                          />
                          <span>{level}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Do you have CI/CD?
                    </label>
                    <div className="flex gap-2">
                      <label className="flex-1 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 cursor-pointer transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white has-[:checked]:border-violet-500 has-[:checked]:bg-violet-500/20 has-[:checked]:text-white has-[:checked]:shadow-[0_0_15px_rgba(139,92,246,0.25)]">
                        <input type="radio" name="hasCiCd" value="yes" className="sr-only" required />
                        <span>Yes</span>
                      </label>
                      <label className="flex-1 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-medium text-slate-300 cursor-pointer transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white has-[:checked]:border-violet-500 has-[:checked]:bg-violet-500/20 has-[:checked]:text-white has-[:checked]:shadow-[0_0_15px_rgba(139,92,246,0.25)]">
                        <input type="radio" name="hasCiCd" value="no" className="sr-only" />
                        <span>No</span>
                      </label>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Public exposure
                    </label>
                    <div className="flex gap-2">
                      {PUBLIC_EXPOSURE.map((opt) => (
                        <label
                          key={opt}
                          className="flex-1 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs sm:text-sm font-medium text-slate-300 cursor-pointer transition-all duration-300 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-white has-[:checked]:border-violet-500 has-[:checked]:bg-violet-500/20 has-[:checked]:text-white has-[:checked]:shadow-[0_0_15px_rgba(139,92,246,0.25)]"
                        >
                          <input
                            type="radio"
                            name="publicExposure"
                            value={opt}
                            className="sr-only"
                            required
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Compliance needs
                    </label>
                    <select
                      name="complianceNeeds"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07]"
                    >
                      {COMPLIANCE_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Git provider
                    </label>
                    <select
                      name="gitProvider"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07]"
                    >
                      {GIT_PROVIDERS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-fuchsia-400/80">
                    Goals & stack
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-fuchsia-500/40 to-transparent" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Primary goal
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {PRIMARY_GOALS.map((g) => (
                      <label
                        key={g}
                        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-300 cursor-pointer transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-fuchsia-500/10 hover:text-white has-[:checked]:border-fuchsia-500 has-[:checked]:bg-fuchsia-500/20 has-[:checked]:text-white has-[:checked]:shadow-[0_0_15px_rgba(217,70,239,0.25)]"
                      >
                        <input
                          type="radio"
                          name="primaryGoal"
                          value={g}
                          className="sr-only"
                          required
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Primary workload type
                  </label>
                  <select
                    name="workloadType"
                    defaultValue="Container (Docker/K8s)"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07]"
                  >
                      {WORKLOAD_TYPES.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Database setup
                    </label>
                    <select
                      name="databaseType"
                      defaultValue="RDS/Managed SQL"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07]"
                    >
                      {DATABASE_TYPES.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Kubernetes usage
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {KUBERNETES_OPTIONS.map((k) => (
                      <label
                        key={k}
                        className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs sm:text-sm font-medium text-slate-300 cursor-pointer transition-all duration-300 hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-white has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/20 has-[:checked]:text-white has-[:checked]:shadow-[0_0_15px_rgba(6,182,212,0.25)]"
                      >
                        <input type="radio" name="kubernetesUsage" value={k} defaultChecked={k === "Evaluating"} className="sr-only" />
                        <span>{k}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

                <div className="flex items-center gap-3 pt-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/80">
                    Operator tier
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                </div>
                <div className="space-y-3">
                <h3 className="text-base font-bold text-white">
                  Choose your Operator tier
                </h3>
                <p className="text-xs text-slate-400">
                  Included with membership: Starter ($35)→Analysis · Growth ($75)→Roadmap · Scale ($249)→Automation Signals · Enterprise→Strategic Advisory.{" "}
                  <Link href="/axiom/pricing" className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors">View plans</Link>
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  {OPERATOR_TIERS.map((t) => (
                    <label
                      key={t.id}
                      className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 cursor-pointer transition-all duration-300 hover:border-cyan-500/50 hover:bg-cyan-500/10 has-[:checked]:border-cyan-500 has-[:checked]:bg-cyan-500/20 has-[:checked]:shadow-[0_0_25px_rgba(6,182,212,0.3)] has-[:checked]:scale-[1.02]"
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={t.id}
                        defaultChecked={t.id === "free"}
                        className="mt-1 h-4 w-4 shrink-0 text-cyan-500 border-white/30 focus:ring-cyan-500"
                      />
                      <div>
                        <p className="font-semibold text-white">
                          {t.label}
                        </p>
                        {t.id === "free" && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Infrastructure scores and summary dashboard. No configs.
                          </p>
                        )}
                        {t.id === "pro" && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Full technical outputs, YAML, Dockerfile, and downloads.
                          </p>
                        )}
                        {t.id === "growth" && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Adds continuous reassessment and advanced optimization logic.
                          </p>
                        )}
                        {t.id === "enterprise" && (
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Strategic engagement and dedicated automation implementation.
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
                </div>

                <div className="pt-6 grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Work email <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="you@company.com"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Name <span className="text-slate-500">(optional)</span>
                  </label>
                  <input
                    name="name"
                    type="text"
                    placeholder="Your name"
                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-5 py-3.5 text-sm text-white placeholder:text-slate-500 transition-all duration-200 focus:border-violet-500/50 focus:ring-2 focus:ring-violet-500/20 focus:outline-none hover:bg-white/[0.07]"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-6 border-t border-white/5 mt-6">
                <p className="text-xs text-slate-500 max-w-sm order-2 sm:order-1 leading-relaxed">
                  Autopilot Mode: Generates step-by-step playbooks and validated configs. Execution
                  requires your approval.
                </p>
                <div className="order-1 sm:order-2 shrink-0">
                <button
                  type="submit"
                  disabled={submitting || !formValid}
                  className={
                    "inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 " +
                    (submitting
                      ? "cursor-wait bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/40 animate-pulse"
                      : formValid
                        ? "cursor-pointer bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-600 text-white shadow-xl shadow-violet-500/40 hover:shadow-violet-500/60 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98] border border-white/20 hover:from-violet-400 hover:via-fuchsia-400 hover:to-violet-500"
                        : "cursor-not-allowed bg-slate-700/80 text-slate-400 border border-slate-600/50")
                  }
                >
                  {submitting ? (
                    <>
                      <ArrowPathIcon className="h-5 w-5 shrink-0 animate-spin" aria-hidden />
                      <span>Please wait, loading…</span>
                      <span className="inline-flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:240ms]" />
                      </span>
                    </>
                  ) : (
                    <>
                      <BoltIcon className="h-5 w-5" />
                      <span>Run AI Cloud Operator</span>
                      <ArrowRightIcon className="h-5 w-5" />
                    </>
                  )}
                </button>
                </div>
              </div>
                  </div>
                </div>
              </div>
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
          <section className="space-y-8">
            <WorkflowProgressPanel
              token={token}
              steps={workflowSteps}
              onTabChange={(tab) => setActiveTab(tab as typeof activeTab)}
            />
            {/* Phase 5: Top tabs */}
            <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
              {[
                { id: "overview" as const, label: "Overview" },
                { id: "roadmap" as const, label: "Roadmap" },
                { id: "playbooks" as const, label: "Playbooks", previewForFree: true },
                { id: "strategic" as const, label: "Strategic", proOnly: true },
                { id: "trends" as const, label: "Trends", proOnly: true },
                { id: "export" as const, label: "Export" },
                { id: "connectors" as const, label: "Connectors" },
                { id: "timeline" as const, label: "Cloud Timeline" },
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
                  <p className="text-sm text-slate-600 dark:text-slate-400 max-w-2xl">
                    Link AWS, Azure, GCP, or GitHub with read-only credentials. Axiom fetches real inventory, cost data, and config—so AI analyzes your actual environment, not just forms.
                  </p>
                </div>
                <AWSConnectorForm
                  token={token}
                  onConnected={() => {
                    fetchConnectorStatus().then((c) => {
                      if (c) setConnectorStatus(c);
                    });
                    fetchWorkflowStatus();
                  }}
                />
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Supported connectors</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <AxiomCard className="p-5 border-l-4 border-l-orange-500">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">AWS</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">Account metadata, resource inventory, cost data. Use assume-role (Role ARN + External ID).</p>
                    <ConnectorStatusDisplay token={token} connectors={connectorStatus} />
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
                <RunScanCard
                  token={token}
                  connectorStatus={connectorStatus}
                  onSuccess={fetchWorkflowStatus}
                />
                <InfraDiscoveryCard
                  token={token}
                  connectorStatus={connectorStatus}
                  onSuccess={() => {
                    fetchStatus().then((d) => d && setStatus(d));
                    fetchWorkflowStatus();
                  }}
                />
                <AxiomCard className="p-5 bg-slate-50 dark:bg-slate-900/50">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    API: POST /api/connectors/link to link. GET /api/connectors/status for status. All connectors are read-only.
                  </p>
                </AxiomCard>
              </AxiomSection>
            )}

            {activeTab === "timeline" && (
              <CloudTimelinePanel token={token} />
            )}

            {activeTab === "overview" && (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                {/* Live AWS Snapshot — real data from the user's account */}
                {awsSnapshot && (
                  <AxiomCard className="p-5 border-l-4 border-l-orange-500">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <CloudIcon className="h-4 w-4 text-orange-500" />
                        Live AWS Snapshot
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                          {new Date(awsSnapshot.scannedAt).toLocaleString()}
                        </span>
                        <button
                          onClick={fetchAwsSnapshot}
                          disabled={snapshotLoading}
                          className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                          title="Refresh snapshot"
                        >
                          <ArrowPathIcon className={`h-3.5 w-3.5 ${snapshotLoading ? "animate-spin" : ""}`} />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 text-center">
                        <p className="text-[10px] font-medium text-slate-500 uppercase">Account</p>
                        <p className="mt-0.5 text-sm font-mono font-semibold text-slate-900 dark:text-slate-100">{awsSnapshot.accountId}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 p-3 text-center">
                        <p className="text-[10px] font-medium text-slate-500 uppercase">Regions</p>
                        <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{awsSnapshot.regions.length}</p>
                      </div>
                      <div className={`rounded-lg p-3 text-center ${awsSnapshot.ec2?.success === false ? "bg-red-50 dark:bg-red-950/30" : "bg-slate-50 dark:bg-slate-900/60"}`}>
                        <p className="text-[10px] font-medium text-slate-500 uppercase">EC2 Instances</p>
                        {awsSnapshot.ec2?.success === false ? (
                          <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400" title={awsSnapshot.ec2.error}>Could not read (missing permission)</p>
                        ) : (
                          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{awsSnapshot.ec2InstanceCount}</p>
                        )}
                      </div>
                      <div className={`rounded-lg p-3 text-center ${awsSnapshot.s3?.success === false ? "bg-red-50 dark:bg-red-950/30" : "bg-slate-50 dark:bg-slate-900/60"}`}>
                        <p className="text-[10px] font-medium text-slate-500 uppercase">S3 Buckets</p>
                        {awsSnapshot.s3?.success === false ? (
                          <p className="mt-0.5 text-[10px] text-red-600 dark:text-red-400" title={awsSnapshot.s3.error}>Could not read (missing permission)</p>
                        ) : (
                          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">{awsSnapshot.s3BucketCount}</p>
                        )}
                      </div>
                    </div>
                    {status?.previousAwsSnapshot && (() => {
                      const prev = status.previousAwsSnapshot;
                      const ec2Delta = awsSnapshot.ec2InstanceCount - prev.ec2InstanceCount;
                      const s3Delta = awsSnapshot.s3BucketCount - prev.s3BucketCount;
                      const prevHighRisks = prev.insights.filter(i => i.severity === "high").length;
                      const currHighRisks = (awsSnapshot.insights ?? []).filter(i => i.severity === "high").length;
                      const riskDelta = currHighRisks - prevHighRisks;
                      const hasChanges = ec2Delta !== 0 || s3Delta !== 0 || riskDelta !== 0;
                      if (!hasChanges) return null;
                      const formatDelta = (d: number, label: string) => {
                        if (d === 0) return null;
                        const sign = d > 0 ? "+" : "";
                        return `${sign}${d} ${label}`;
                      };
                      const items = [
                        formatDelta(ec2Delta, ec2Delta === 1 || ec2Delta === -1 ? "instance" : "instances"),
                        formatDelta(s3Delta, s3Delta === 1 || s3Delta === -1 ? "bucket" : "buckets"),
                        riskDelta < 0 ? `${Math.abs(riskDelta)} fewer high-risk issue${Math.abs(riskDelta) !== 1 ? "s" : ""}` : riskDelta > 0 ? `${riskDelta} new high-risk issue${riskDelta !== 1 ? "s" : ""}` : null,
                      ].filter(Boolean) as string[];
                      return (
                        <div className="mb-4 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-slate-50/50 dark:bg-slate-900/40 p-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">
                            Since last scan <span className="font-normal normal-case">({new Date(prev.scannedAt).toLocaleDateString()})</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {items.map((item) => {
                              const isPositiveRisk = item.includes("new high-risk");
                              const isNegativeRisk = item.includes("fewer high-risk");
                              return (
                                <span
                                  key={item}
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                    isPositiveRisk
                                      ? "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300"
                                      : isNegativeRisk
                                        ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                        : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                  }`}
                                >
                                  {item}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                    {awsSnapshot.insights && awsSnapshot.insights.length > 0 && (
                      <div className="space-y-2 mb-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Key Risks</p>
                        {awsSnapshot.insights.map((insight, i) => (
                          <div
                            key={i}
                            className={`rounded-lg border p-3 ${
                              insight.severity === "high"
                                ? "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30"
                                : insight.severity === "medium"
                                  ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30"
                                  : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40"
                            }`}
                          >
                            <div className="flex items-start gap-2">
                              <ExclamationTriangleIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                                insight.severity === "high"
                                  ? "text-red-500"
                                  : insight.severity === "medium"
                                    ? "text-amber-500"
                                    : "text-slate-400"
                              }`} />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{insight.title}</span>
                                  <span className={`text-[10px] font-bold uppercase ${
                                    insight.severity === "high"
                                      ? "text-red-600 dark:text-red-400"
                                      : insight.severity === "medium"
                                        ? "text-amber-600 dark:text-amber-400"
                                        : "text-slate-500"
                                  }`}>{insight.severity}</span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5 leading-relaxed">{insight.message}</p>
                                {insight.explanation && (
                                  <div className="mt-1.5 flex items-start gap-1.5">
                                    <SparklesIcon className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-500" />
                                    <p className="text-xs text-violet-700 dark:text-violet-300 leading-relaxed italic">{insight.explanation}</p>
                                  </div>
                                )}
                                {insight.impact && (
                                  <p className={`text-xs font-medium mt-1.5 ${
                                    insight.severity === "high"
                                      ? "text-red-700 dark:text-red-300"
                                      : insight.severity === "medium"
                                        ? "text-amber-700 dark:text-amber-300"
                                        : "text-slate-600 dark:text-slate-400"
                                  }`}>
                                    Impact: {insight.impact}
                                  </p>
                                )}
                                {insight.actions && insight.actions.length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Next steps</p>
                                    <ul className="space-y-1">
                                      {insight.actions.map((action, j) => (
                                        <li key={j} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-300">
                                          <ArrowRightIcon className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-500" />
                                          {action}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {insight.severity === "high" && !status?.canViewTechnicalOutputs && (
                                  <button
                                    onClick={() => openUpgradeModal("fix-automatically", insight.title)}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors group"
                                  >
                                    <BoltIcon className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                                    Get step-by-step fix guide
                                  </button>
                                )}
                                {insight.severity === "medium" && !status?.canViewTechnicalOutputs && (
                                  <button
                                    onClick={() => openUpgradeModal("deeper-analysis", insight.title)}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 hover:text-violet-800 dark:hover:text-violet-300 transition-colors group"
                                  >
                                    <MagnifyingGlassIcon className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                                    Get deeper analysis
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Real data from your AWS account via read-only AssumeRole. No credentials stored.
                    </p>
                    {awsSnapshot.insights && awsSnapshot.insights.length > 0 && !status?.canViewTechnicalOutputs && (
                      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60">
                        <button
                          onClick={() => openUpgradeModal("continuous-monitoring")}
                          className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors group"
                        >
                          <ArrowPathIcon className="h-3.5 w-3.5 group-hover:text-violet-500 transition-colors" />
                          <span>Want us to monitor this and alert you if it gets worse?</span>
                        </button>
                      </div>
                    )}
                  </AxiomCard>
                )}
                {!awsSnapshot && snapshotLoading && (
                  <AxiomCard className="p-5 border-l-4 border-l-orange-500">
                    <div className="flex items-center gap-3">
                      <ArrowPathIcon className="h-4 w-4 text-orange-500 animate-spin" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">Scanning your AWS infrastructure...</span>
                    </div>
                  </AxiomCard>
                )}
                {status?.environmentSummary && (
                  <AxiomCard className="p-5 border-l-4 border-l-indigo-500">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                      <CloudIcon className="h-4 w-4 text-indigo-500" />
                      Environment Summary
                    </h3>
                    <div className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                      {status.environmentSummary}
                    </div>
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      Generated from infrastructure discovery and IAM scan. Run &quot;Discover Infrastructure&quot; in Connectors to refresh.
                    </p>
                  </AxiomCard>
                )}
                {status?.architectureGraph && status.architectureGraph.nodes.length > 0 && (
                  <ArchitectureGraphView graph={status.architectureGraph} />
                )}
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
      <AskAxiomPanel token={token} onTabChange={(tab) => setActiveTab(tab as typeof activeTab)} />
      <AxiomUpgradeModal
        open={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        trigger={upgradeTrigger}
        leadId={status?.leadId}
        insightTitle={upgradeInsightTitle}
      />
    </div>
  );
}

export default function CloudOperatorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
          <Navigation />
          <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-20 flex items-center justify-center min-h-[60vh]">
            <AxiomLoadingState message="Loading Axiom AI cloud analysis…" variant="full" />
          </main>
        </div>
      }
    >
      <CloudOperatorPageInner />
    </Suspense>
  );
}


