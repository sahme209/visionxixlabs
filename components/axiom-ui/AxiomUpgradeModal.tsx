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
    cta: string;
  }
> = {
  "fix-automatically": {
    headline: "Get step-by-step guidance to fix this",
    description:
      "See exactly what to change, with detailed Terraform configs and implementation steps tailored to your infrastructure.",
    features: [
      { icon: BoltIcon, label: "Ready-to-use Terraform configurations" },
      { icon: ShieldCheckIcon, label: "Step-by-step implementation guide" },
      { icon: ArrowPathIcon, label: "Weekly re-scan to confirm the fix held" },
    ],
    cta: "Unlock detailed fix guide",
  },
  "continuous-monitoring": {
    headline: "Want us to watch this for you?",
    description:
      "We'll re-scan your infrastructure weekly and alert you if anything gets worse or new risks appear.",
    features: [
      { icon: ArrowPathIcon, label: "Automated weekly scans" },
      { icon: ChartBarIcon, label: "Trend tracking over time" },
      { icon: ShieldCheckIcon, label: "Alerts on new high-severity risks" },
    ],
    cta: "Enable continuous monitoring",
  },
  "deeper-analysis": {
    headline: "Go deeper on this infrastructure",
    description:
      "Get a full security audit, cost optimization report, and architecture review across all your regions.",
    features: [
      { icon: ChartBarIcon, label: "Multi-region deep scan" },
      { icon: ShieldCheckIcon, label: "IAM & network security audit" },
      { icon: BoltIcon, label: "Cost optimization recommendations" },
    ],
    cta: "Unlock full analysis",
  },
  "deploy-fix": {
    headline: "See detailed infrastructure recommendations",
    description:
      "Get Terraform configurations, architecture diagrams, and a prioritized implementation roadmap for your environment.",
    features: [
      { icon: BoltIcon, label: "Ready-to-use Terraform configurations" },
      { icon: ShieldCheckIcon, label: "Architecture review and diagrams" },
      { icon: ArrowPathIcon, label: "Prioritized implementation roadmap" },
    ],
    cta: "Unlock full recommendations",
  },
};

export function AxiomUpgradeModal({
  open,
  onClose,
  trigger,
  leadId,
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
      const res = await fetch("/api/billing/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: leadId ?? undefined,
          tier: "pro",
          sourcePage: `cloud-operator:${trigger}`,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      if (data.cta === "contact") {
        window.location.href = `/contact?intent=upgrade&trigger=${trigger}`;
        return;
      }
      setError(data.message || "Something went wrong. Try again.");
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [leadId, trigger]);

  const content = TRIGGER_CONTENT[trigger];

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            {insightTitle && (
              <p className="text-[10px] font-medium uppercase tracking-wide text-violet-600 dark:text-violet-400 mb-1">
                {insightTitle}
              </p>
            )}
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {content.headline}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
          {content.description}
        </p>

        <div className="space-y-3 mb-6">
          {content.features.map((feat) => (
            <div key={feat.label} className="flex items-center gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                <feat.icon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {feat.label}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 mb-3">{error}</p>
        )}

        <div className="flex flex-col gap-2">
          <AxiomButton onClick={handleUpgrade} disabled={loading}>
            {loading ? "Redirecting..." : content.cta}
          </AxiomButton>
          <button
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors py-1"
          >
            Not now
          </button>
        </div>
      </div>
    </dialog>
  );
}
