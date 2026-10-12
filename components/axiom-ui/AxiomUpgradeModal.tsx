"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  XMarkIcon,
  ShieldCheckIcon,
  BoltIcon,
  ArrowPathIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { AxiomButton } from "./AxiomButton";

export type UpgradeTrigger =
  | "fix-automatically"
  | "continuous-monitoring"
  | "deeper-analysis"
  | "deploy-fix";

type AxiomUpgradeModalProps = {
  open: boolean;
  onClose: () => void;
  trigger: UpgradeTrigger;
  leadId?: string;
  insightTitle?: string;
};

const TRIGGER_CONTENT: Record<
  UpgradeTrigger,
  {
    headline: string;
    description: string;
    features: { icon: typeof ShieldCheckIcon; label: string }[];
    example: { heading: string; content: string };
    cta: string;
  }
> = {
  "fix-automatically": {
    headline: "Turn this into a governed change",
    description:
      "Ask the Agent to prepare a repository change. Axiom pauses before every write so an authorized reviewer can inspect and approve it.",
    features: [
      { icon: BoltIcon, label: "Repository-scoped GitHub changes" },
      { icon: ShieldCheckIcon, label: "Explicit approval before every write" },
      { icon: ArrowPathIcon, label: "Proposal and execution audit history" },
    ],
    example: {
      heading: "Example · simulated proposal",
      content: "Repository: acme/widgets\nBranch: axiom/readme-fix\nAction: Commit one reviewed file\nRisk: Medium · approval required",
    },
    cta: "Choose Pro",
  },
  "continuous-monitoring": {
    headline: "Automate the release checkpoint",
    description:
      "Schedule governed deployment automation around verified Airflow DAG completion and configured release conditions.",
    features: [
      { icon: ArrowPathIcon, label: "Scheduled Airflow condition checks" },
      { icon: ChartBarIcon, label: "Batch and dependency status" },
      { icon: ShieldCheckIcon, label: "Approval-gated PR and deploy actions" },
    ],
    example: {
      heading: "Example · simulated condition",
      content: "When: daily_transform succeeds\nCheck: upstream dependencies complete\nThen: propose deployment to Development\nFailure: retry, notify, and preserve evidence",
    },
    cta: "Choose Pro",
  },
  "deeper-analysis": {
    headline: "Keep the full decision context",
    description:
      "Give the Agent repository, branch, environment, and connected-system context while keeping every consequential action governed.",
    features: [
      { icon: ChartBarIcon, label: "Workspace-aware release context" },
      { icon: ShieldCheckIcon, label: "Risk classification that only escalates" },
      { icon: BoltIcon, label: "GitHub, AWS ECS, and Airflow tools" },
    ],
    example: {
      heading: "Example · simulated context",
      content: "Repository: acme/widgets · main\nEnvironment: Development\nDeployment target: AWS ECS\nAgent result: plan ready for review",
    },
    cta: "Choose Pro",
  },
  "deploy-fix": {
    headline: "Move from approval to verified deployment",
    description:
      "Dispatch the tenant-owned AWS ECS workflow after approval, wait for steady state, and retain the rollback result with the release record.",
    features: [
      { icon: BoltIcon, label: "GitHub Actions OIDC · no stored AWS key" },
      { icon: ShieldCheckIcon, label: "Environment and role-scoped target" },
      { icon: ArrowPathIcon, label: "ECS steady-state check and rollback" },
    ],
    example: {
      heading: "Example · simulated release",
      content: "Target: Development · api-service\nGate: Admin approval recorded\nValidation: ECS steady state\nRecovery: previous task definition",
    },
    cta: "Choose Pro",
  },
};

export function AxiomUpgradeModal({
  open,
  onClose,
  trigger,
  insightTitle,
}: AxiomUpgradeModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  const handleUpgrade = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: "pro",
          billingInterval: "monthly",
        }),
      });
      const payload = await res.json() as {
        data?: { ok?: boolean; url?: string; reason?: string };
        error?: { userMessage?: string };
      };
      if (payload.data?.ok && payload.data.url) {
        window.location.href = payload.data.url;
        return;
      }
      setError(payload.data?.reason || payload.error?.userMessage || "Checkout is not available yet.");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const content = TRIGGER_CONTENT[trigger];

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-2xl border border-white/[0.06] bg-white/[0.02] p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            {insightTitle && (
              <p className="text-[10px] font-medium uppercase tracking-wide text-orange-400 mb-1">
                {insightTitle}
              </p>
            )}
            <h2 className="text-lg font-semibold text-white">
              {content.headline}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/[0.04] text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-zinc-400 mb-5 leading-relaxed">
          {content.description}
        </p>

        <div className="space-y-3 mb-5">
          {content.features.map((feat) => (
            <div key={feat.label} className="flex items-center gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <feat.icon className="h-4 w-4 text-orange-400" />
              </div>
              <span className="text-sm text-zinc-300">
                {feat.label}
              </span>
            </div>
          ))}
        </div>

        <div className="mb-5 rounded-lg border border-orange-500/20 bg-orange-500/[0.06] p-3">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wide mb-1.5">
            {content.example.heading}
          </p>
          <pre className="text-[11px] text-zinc-300 font-mono leading-relaxed whitespace-pre-wrap">
            {content.example.content}
          </pre>
          <p className="mt-1.5 text-[10px] text-zinc-500">Illustrative data. The desktop app shows verified workspace context and never executes a write without the required approval.</p>
        </div>

        {error && (
          <p className="text-xs text-red-400 mb-3">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <AxiomButton onClick={handleUpgrade} disabled={loading}>
            {loading ? "Redirecting..." : content.cta}
          </AxiomButton>
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-white transition-colors py-1"
          >
            Not now
          </button>
        </div>
      </div>
    </dialog>
  );
}
