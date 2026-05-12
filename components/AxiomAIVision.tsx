"use client";

import Link from "next/link";
import {
  BoltIcon,
  CloudArrowUpIcon,
  CpuChipIcon,
  SparklesIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";

/**
 * Vision for AI-powered cloud automation beyond basic analysis:
 * API access to client env, AI-driven remediation, predictive ops
 */
export function AxiomAIVision() {
  const capabilities = [
    {
      icon: CloudArrowUpIcon,
      title: "Connect your cloud via APIs",
      desc: "Link AWS, Azure, GCP with read-only credentials. AI analyzes real inventory, cost data, and security posture—not just forms.",
      status: "Available (Growth+)",
    },
    {
      icon: CpuChipIcon,
      title: "AI-driven analysis & recommendations",
      desc: "Explainable scoring, impact simulation, drift detection. AI identifies anti-patterns, idle resources, and optimization levers.",
      status: "Available",
    },
    {
      icon: SparklesIcon,
      title: "Beyond basic: predictive & autonomous",
      desc: "Roadmap: AI-generated playbooks, automated remediation suggestions, cost anomaly alerts, security drift correction—all with your approval.",
      status: "Roadmap",
    },
    {
      icon: CommandLineIcon,
      title: "Miracles: full automation with guardrails",
      desc: "Future: AI executes approved tasks in your environment—right-sizing, tagging, policy fixes. You approve; AI executes. Audit trail for everything.",
      status: "Enterprise roadmap",
    },
  ];

  return (
    <div className="rounded-2xl border-2 border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-fuchsia-950/10 p-6">
      <div className="flex items-center gap-2 mb-4">
        <BoltIcon className="h-5 w-5 text-violet-400" />
        <h3 className="text-base font-bold text-white">
          AI beyond basic — where we&apos;re headed
        </h3>
      </div>
      <p className="text-sm text-zinc-400 mb-6">
        Axiom is evolving from analysis to automation. Connect your environment via APIs and let AI do more—recommendations today, approved execution tomorrow.
      </p>
      <div className="space-y-4 mb-6">
        {capabilities.map((item) => (
          <div
            key={item.title}
            className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]"
          >
            <item.icon className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-semibold text-white">
                  {item.title}
                </h4>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-300">
                  {item.status}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/contact?subject=Axiom+AI+Autopilot+%26+API+Access"
        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
      >
        <SparklesIcon className="h-4 w-4" />
        Get early access to advanced AI features
      </Link>
    </div>
  );
}
