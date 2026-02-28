"use client";

import Link from "next/link";
import {
  SparklesIcon,
  ChartBarIcon,
  CloudIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

function WebsiteBuilderVisual() {
  return (
    <div className="relative w-full aspect-[4/3] max-h-[200px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200/80 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200/80 dark:border-slate-700 shadow-inner">
      {/* Browser frame */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-slate-300/80 dark:border-slate-600 bg-white/90 dark:bg-slate-900/90">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shadow-sm" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm" />
        <div className="flex-1 mx-3 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center text-slate-500 text-[10px] pl-3 font-medium">
          visionxixlabs.com/website-builder
        </div>
      </div>
      {/* Animated content area */}
      <div className="p-4 space-y-3 bg-white/50 dark:bg-slate-900/50">
        {/* Typing line with cursor */}
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[85%]">
            Build immigration consulting site...
          </span>
          <span className="w-2 h-4 bg-violet-500 rounded-sm animate-cursor-blink flex-shrink-0" />
        </div>
        {/* Animated CTA button */}
        <div className="flex gap-2">
          <div className="h-8 w-24 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">Build</span>
          </div>
          <div className="h-8 w-16 rounded-lg bg-slate-200 dark:bg-slate-700" />
        </div>
        {/* Site preview blocks — animated appearance */}
        <div className="grid grid-cols-4 gap-1.5 pt-2 animate-demo-scale-in" style={{ animationDelay: "0.3s", opacity: 0, animationFillMode: "forwards" }}>
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-12 rounded-lg bg-gradient-to-br from-violet-200/80 to-fuchsia-200/80 dark:from-violet-700/40 dark:to-fuchsia-700/40 border border-violet-200/60 dark:border-violet-600/30 animate-demo-scale-in"
              style={{ animationDelay: `${0.4 + i * 0.1}s`, opacity: 0, animationFillMode: "forwards" }}
            />
          ))}
        </div>
        {/* Live badge with glow */}
        <div className="flex items-center gap-1.5 pt-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">Live site deployed</span>
        </div>
      </div>
    </div>
  );
}

function AxiomVisual() {
  return (
    <div className="relative w-full aspect-[4/3] max-h-[200px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-blue-50/50 dark:from-slate-800 dark:to-slate-900 dark:to-blue-950/20 border-2 border-slate-200/80 dark:border-slate-700 shadow-inner">
      <div className="p-4 space-y-4">
        {/* Score cards — animated bars */}
        <div className="flex gap-2">
          {[
            { label: "Overall", value: "72", color: "blue", delay: 0 },
            { label: "Cost", value: "68", color: "amber", delay: 0.2 },
            { label: "Sec", value: "81", color: "emerald", delay: 0.4 },
          ].map((s, i) => (
            <div
              key={s.label}
              className="flex-1 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 p-2 flex flex-col items-center gap-1 shadow-sm"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <span className={`text-sm font-black text-${s.color}-600 dark:text-${s.color}-400`} style={{ color: s.color === "blue" ? "#2563eb" : s.color === "amber" ? "#d97706" : "#059669" }}>
                {s.value}
              </span>
              <span className="text-[9px] font-medium text-slate-500 dark:text-slate-400">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Animated progress bars */}
        <div className="space-y-2.5">
          {[
            { label: "Landing zones", width: 72, delay: 0.5 },
            { label: "CI/CD", width: 85, delay: 0.7 },
            { label: "Cost opt.", width: 61, delay: 0.9 },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 origin-left"
                  style={
                    {
                      "--fill-width": `${item.width}%`,
                      animation: "progress-fill 2s ease-out both",
                      animationDelay: `${item.delay}s`,
                    } as React.CSSProperties
                  }
                />
              </div>
              <span className="text-[9px] text-slate-600 dark:text-slate-400 w-14 truncate">{item.label}</span>
            </div>
          ))}
        </div>
        {/* Roadmap ready badge */}
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/80 dark:border-emerald-800/50 px-2.5 py-1.5 animate-demo-pulse-glow">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" style={{ animationDuration: "2s" }} />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">30-day roadmap ready</span>
        </div>
      </div>
    </div>
  );
}

function CloudSolutionsVisual() {
  const clouds = [
    { letter: "A", color: "orange", delay: 0 },
    { letter: "A", color: "blue", delay: 0.15 },
    { letter: "G", color: "red", delay: 0.3 },
  ];
  return (
    <div className="relative w-full aspect-[4/3] max-h-[200px] rounded-xl overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200/50 dark:from-slate-800 dark:to-slate-900 border-2 border-slate-200/80 dark:border-slate-700 shadow-inner">
      <div className="p-4 space-y-4">
        {/* Floating cloud logos */}
        <div className="flex justify-center items-center gap-4">
          {clouds.map((c, i) => (
            <div
              key={i}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg shadow-lg animate-demo-float`}
              style={{
                backgroundColor: c.color === "orange" ? "rgba(249, 115, 22, 0.2)" : c.color === "blue" ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)",
                color: c.color === "orange" ? "#ea580c" : c.color === "blue" ? "#2563eb" : "#dc2626",
                animationDelay: `${c.delay}s`,
              }}
            >
              {c.letter}
            </div>
          ))}
        </div>
        {/* Connecting flow dots */}
        <div className="flex justify-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <span
              key={i}
              className="w-2 h-2 rounded-full bg-violet-400 dark:bg-violet-500 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s`, animationDuration: "1.5s" }}
            />
          ))}
        </div>
        {/* Capability pills */}
        <div className="grid grid-cols-2 gap-2">
          {["IaC", "CI/CD", "FinOps", "SLO"].map((t, i) => (
            <div
              key={t}
              className="h-8 rounded-xl bg-white/90 dark:bg-slate-800/90 border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center shadow-sm animate-demo-scale-in"
              style={{ animationDelay: `${0.2 + i * 0.1}s`, opacity: 0, animationFillMode: "forwards" }}
            >
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t}</span>
            </div>
          ))}
        </div>
        <div className="text-center">
          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400">Landing zones · Security · Observability</span>
        </div>
      </div>
    </div>
  );
}

const DEMOS = [
  {
    id: "website-builder",
    title: "AI Website Builder",
    tagline: "Design, structure, graphics — one prompt.",
    href: "/builder",
    icon: SparklesIcon,
    gradient: "from-violet-500 to-fuchsia-500",
    steps: ["Describe your site", "AI builds everything", "Deploy to cloud"],
    visual: <WebsiteBuilderVisual />,
  },
  {
    id: "axiom",
    title: "Axiom — AI Cloud Analysis",
    tagline: "Infra scores, roadmap, cost optimization.",
    href: "/cloud-operator",
    icon: ChartBarIcon,
    gradient: "from-blue-500 to-indigo-600",
    steps: ["Connect your cloud", "AI analyzes infra", "Get scores & roadmap"],
    visual: <AxiomVisual />,
  },
  {
    id: "cloud-solutions",
    title: "Cloud Solutions",
    tagline: "AWS, Azure, GCP — design, automate, optimize.",
    href: "/cloud-solutions",
    icon: CloudIcon,
    gradient: "from-orange-500 to-red-500",
    steps: ["Choose cloud", "We design & build", "Production-ready"],
    visual: <CloudSolutionsVisual />,
  },
];

export function ProductDemoShowcase() {
  return (
    <section
      className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200/80 dark:border-slate-700/80 relative overflow-hidden"
      aria-labelledby="product-demo-heading"
    >
      {/* Subtle background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-50/30 via-transparent to-fuchsia-50/20 dark:from-violet-950/20 dark:via-transparent dark:to-fuchsia-950/10 pointer-events-none" aria-hidden />
      <div className="max-w-6xl mx-auto relative">
        <div className="text-center mb-14">
          <h2
            id="product-demo-heading"
            className="text-2xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4"
          >
            See what we build
          </h2>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
            From a single prompt to a live site, from cloud chaos to a clear roadmap — our products give you clarity and control.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 lg:gap-10">
          {DEMOS.map((demo, idx) => {
            const Icon = demo.icon;
            return (
              <Link
                key={demo.id}
                href={demo.href}
                className="group block rounded-3xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/95 dark:bg-slate-800/95 backdrop-blur overflow-hidden shadow-xl shadow-slate-200/40 dark:shadow-none hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-2xl hover:shadow-violet-500/15 transition-all duration-500 hover:-translate-y-2"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="p-5 bg-slate-50/90 dark:bg-slate-900/50 border-b border-slate-200/80 dark:border-slate-700/80">
                  {demo.visual}
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r ${demo.gradient} text-white shadow-lg`}>
                      <Icon className="h-6 w-6" />
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      {demo.title}
                    </h3>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                    {demo.tagline}
                  </p>
                  <ul className="space-y-2 mb-5">
                    {demo.steps.map((step, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-400 text-xs font-bold">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ul>
                  <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 group-hover:gap-3 transition-all">
                    Try it
                    <ArrowRightIcon className="h-5 w-5" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="text-center text-slate-500 dark:text-slate-400 mt-10 text-sm">
          All products work together — build a site, run Axiom for infra analysis, or go deep with cloud engineering.
        </p>
      </div>
    </section>
  );
}
