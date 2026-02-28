"use client";

import Link from "next/link";
import {
  CheckCircleIcon,
  SparklesIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

export type JourneyStepId = "describe" | "preview" | "deploy" | "axiom" | "membership";

export type JourneyStep = {
  id: JourneyStepId;
  label: string;
  shortLabel?: string;
  done?: boolean;
  current?: boolean;
  href?: string;
  cta?: string;
};

type WebsiteBuilderJourneyProps = {
  /** Current step in the journey */
  currentStep: JourneyStepId;
  /** Whether preview is ready */
  previewReady?: boolean;
  /** Whether user has submitted for deploy */
  deploySubmitted?: boolean;
  /** Optional token for Axiom/thank-you links */
  token?: string;
  /** Variant: compact for inline, full for section */
  variant?: "compact" | "full";
};

const STEP_ORDER: JourneyStepId[] = ["describe", "preview", "deploy", "axiom", "membership"];

export function WebsiteBuilderJourney({
  currentStep,
  previewReady = false,
  deploySubmitted = false,
  token,
  variant = "full",
}: WebsiteBuilderJourneyProps) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  const steps: JourneyStep[] = [
    {
      id: "describe",
      label: "Describe your site",
      shortLabel: "Describe",
      done: currentIdx > 0,
      current: currentStep === "describe",
    },
    {
      id: "preview",
      label: "Preview built",
      shortLabel: "Preview",
      done: previewReady || currentIdx > 1,
      current: currentStep === "preview" && !previewReady,
    },
    {
      id: "deploy",
      label: "Get site deployed",
      shortLabel: "Deploy",
      done: deploySubmitted,
      current: currentStep === "deploy",
      cta: "Enter email to deploy",
    },
    {
      id: "axiom",
      label: "Add Axiom (infra)",
      shortLabel: "Axiom",
      href: token ? `/cloud-operator?ref=${token}` : "/axiom",
      cta: "Run analysis",
    },
    {
      id: "membership",
      label: "Join membership",
      shortLabel: "Membership",
      href: "/builder/pricing",
      cta: "View plans",
    },
  ];

  if (variant === "compact") {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5 shrink-0">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                s.done
                  ? "bg-emerald-500 text-white"
                  : s.current
                    ? "bg-violet-500 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
              }`}
            >
              {s.done ? <CheckCircleIcon className="h-4 w-4" /> : i + 1}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400 hidden sm:inline">
              {s.shortLabel || s.label}
            </span>
            {i < steps.length - 1 && (
              <ArrowRightIcon className="h-4 w-4 text-slate-300 dark:text-slate-600 shrink-0" />
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-3xl border-2 border-violet-200/80 dark:border-violet-800/80 bg-gradient-to-br from-violet-50/80 to-fuchsia-50/60 dark:from-violet-900/20 dark:to-fuchsia-900/20 p-6 sm:p-8">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
        <SparklesIcon className="h-5 w-5 text-violet-500" />
        Your journey
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
        From preview to production — and beyond with membership.
      </p>
      <div className="space-y-4">
        {steps.map((s, i) => (
          <div
            key={s.id}
            className={`flex items-center gap-4 rounded-2xl border-2 p-4 transition-all ${
              s.current
                ? "border-violet-500 bg-white dark:bg-slate-800 shadow-lg shadow-violet-500/10"
                : s.done
                  ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/30 dark:bg-emerald-900/10"
                  : "border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60"
            }`}
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold transition-colors ${
                s.done
                  ? "bg-emerald-500 text-white"
                  : s.current
                    ? "bg-violet-500 text-white"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
              }`}
            >
              {s.done ? <CheckCircleIcon className="h-6 w-6" /> : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 dark:text-slate-100">{s.label}</p>
              {s.cta && !s.done && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{s.cta}</p>
              )}
            </div>
            {s.href && !s.done && (
              <Link
                href={s.href}
                className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-slate-900 dark:bg-slate-100 px-4 py-2 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
              >
                {s.id === "membership" ? (
                  <>
                    <SparklesIcon className="h-4 w-4" />
                    View plans
                  </>
                ) : (
                  <>
                    {s.cta || "Go"}
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </Link>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 pt-6 border-t border-violet-200/80 dark:border-violet-700/80">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          <strong>Membership</strong> unlocks Axiom, chatbots, priority support, and all products. One plan, full access.
        </p>
        <Link
          href="/builder/pricing"
          className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 py-2.5 font-semibold text-white shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all"
        >
          Explore Builder pricing
          <ArrowRightIcon className="h-5 w-5" />
        </Link>
      </div>
    </div>
  );
}
