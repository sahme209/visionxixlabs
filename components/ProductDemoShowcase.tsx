"use client";

import Link from "next/link";
import {
  SparklesIcon,
  ChartBarIcon,
  CloudIcon,
  ArrowRightIcon,
  DocumentTextIcon,
} from "@heroicons/react/24/outline";

const DEMOS = [
  {
    id: "website-builder",
    title: "AI Website Builder",
    tagline: "Design, structure, graphics — one prompt.",
    href: "/website-builder",
    icon: SparklesIcon,
    gradient: "from-violet-500 to-fuchsia-500",
    steps: ["Describe your site", "AI builds everything", "Deploy to cloud"],
    visual: (
      <div className="relative w-full h-full min-h-[140px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        {/* Mock browser chrome */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <span className="w-2 h-2 rounded-full bg-rose-400" />
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <div className="flex-1 mx-2 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] flex items-center text-slate-500 pl-2">
            visionxixlabs.com/website-builder
          </div>
        </div>
        {/* Mock content */}
        <div className="p-3 space-y-2">
          <div className="h-8 rounded-lg bg-gradient-to-r from-violet-200 to-fuchsia-200 dark:from-violet-800/50 dark:to-fuchsia-800/50 animate-pulse" style={{ animationDuration: "2s" }} />
          <div className="h-3 w-3/4 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="h-3 w-2/3 rounded bg-slate-200 dark:bg-slate-700" />
          <div className="flex gap-2 pt-2">
            <div className="h-6 w-20 rounded-md bg-violet-500/80" />
            <div className="h-6 w-16 rounded-md bg-slate-300 dark:bg-slate-600" />
          </div>
          <div className="flex items-center gap-1 pt-1">
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium">✓ Live preview</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "axiom",
    title: "Axiom — AI Cloud Analysis",
    tagline: "Infra scores, roadmap, cost optimization.",
    href: "/cloud-operator",
    icon: ChartBarIcon,
    gradient: "from-blue-500 to-indigo-600",
    steps: ["Connect your cloud", "AI analyzes infra", "Get scores & roadmap"],
    visual: (
      <div className="relative w-full h-full min-h-[140px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        {/* Mock dashboard */}
        <div className="p-3 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 h-10 rounded-lg bg-blue-500/20 dark:bg-blue-500/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300">72</span>
            </div>
            <div className="flex-1 h-10 rounded-lg bg-amber-500/20 dark:bg-amber-500/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">Cost</span>
            </div>
            <div className="flex-1 h-10 rounded-lg bg-emerald-500/20 dark:bg-emerald-500/30 flex items-center justify-center">
              <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Sec</span>
            </div>
          </div>
          <div className="space-y-1.5">
            {["Landing zones", "CI/CD automation", "Cost optimization"].map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                    style={{ width: `${60 + i * 15}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-600 dark:text-slate-400 w-20 truncate">{l}</span>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> 30-day roadmap ready
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "cloud-solutions",
    title: "Cloud Solutions",
    tagline: "AWS, Azure, GCP — design, automate, optimize.",
    href: "/cloud-solutions",
    icon: CloudIcon,
    gradient: "from-orange-500 via-blue-500 to-red-500",
    steps: ["Choose cloud", "We design & build", "Production-ready"],
    visual: (
      <div className="relative w-full h-full min-h-[140px] rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
        <div className="p-3 space-y-3">
          <div className="flex justify-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/40 flex items-center justify-center text-orange-600 dark:text-orange-400 font-bold text-xs">
              A
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs">
              A
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 font-bold text-xs">
              G
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {["IaC", "CI/CD", "FinOps", "SLO"].map((t, i) => (
              <div key={i} className="h-6 rounded-md bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 flex items-center justify-center">
                <span className="text-[9px] font-medium text-slate-600 dark:text-slate-300">{t}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
            <DocumentTextIcon className="w-3 h-3" />
            Landing zones · Security · Observability
          </div>
        </div>
      </div>
    ),
  },
];

export function ProductDemoShowcase() {
  return (
    <section
      className="py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80"
      aria-labelledby="product-demo-heading"
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2
            id="product-demo-heading"
            className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3"
          >
            See what we build
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            From a single prompt to a live site, from cloud chaos to a clear roadmap — our products give you clarity and control.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {DEMOS.map((demo) => {
            const Icon = demo.icon;
            return (
              <Link
                key={demo.id}
                href={demo.href}
                className="group block rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 backdrop-blur overflow-hidden shadow-lg shadow-slate-200/30 dark:shadow-none card-hover hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-violet-500/10 transition-all"
              >
                <div className="p-4 bg-slate-50/80 dark:bg-slate-800/80">
                  {demo.visual}
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r ${demo.gradient} text-white`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {demo.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                    {demo.tagline}
                  </p>
                  <ul className="space-y-2 mb-4">
                    {demo.steps.map((step, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-xs font-bold">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-violet-600 dark:text-violet-400 group-hover:gap-2 transition-all">
                    Try it
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-8">
          All products work together — build a site, run Axiom for infra analysis, or go deep with cloud engineering.
        </p>
      </div>
    </section>
  );
}
