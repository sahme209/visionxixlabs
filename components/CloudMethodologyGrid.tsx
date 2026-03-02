"use client";

import { Reveal } from "@/components/motion/Reveal";
import { HoverCard } from "@/components/ui/HoverCard";

const steps = [
  { title: "Discovery", description: "Understand your products, teams, constraints, and current AWS/Azure landscape." },
  { title: "Architecture & Roadmap", description: "Define target architectures and a prioritized roadmap that balances risk and impact." },
  { title: "Implementation", description: "Deliver changes in small, safe increments with your teams involved throughout." },
  { title: "Hardening & Automation", description: "Bake reliability, security, and automation into the platform and pipelines." },
  { title: "Handover & Documentation", description: "Document decisions, patterns, and runbooks so your teams can own the platform." },
  { title: "Optimization & Support", description: "Refine cost, performance, and processes based on real usage and business feedback." },
];

export function CloudMethodologyGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {steps.map((step, idx) => (
        <Reveal key={step.title} direction="up" delay={idx * 0.06}>
          <HoverCard className="p-6 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {step.title}
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                {String(idx + 1).padStart(2, "0")}
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {step.description}
            </p>
          </HoverCard>
        </Reveal>
      ))}
    </div>
  );
}
