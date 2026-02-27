"use client";

import Link from "next/link";

/**
 * Huly MetaBrain-style: glowing pipeline connecting services — visual metaphor for unified membership
 */
const SERVICES = [
  { name: "Axiom", href: "/cloud-operator", short: "Infra scores" },
  { name: "AI Chatbots", href: "/visionxix-ai", short: "White-label" },
  { name: "Website Builder", href: "/website-builder", short: "Prompt-first" },
  { name: "Cloud Studio", href: "/cloud-studio", short: "Cloud setup" },
  { name: "Cloud Solutions", href: "/cloud-solutions", short: "AWS · Azure · GCP" },
];

export function ServicePipeline() {
  return (
    <div className="relative py-8">
      {/* Glowing pipeline ribbon (decorative) */}
      <div
        className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full pipeline-glow opacity-40 hidden md:block"
        style={{ maxWidth: "90%", margin: "0 auto" }}
        aria-hidden
      />
      <div className="relative flex flex-wrap justify-center gap-4 md:gap-6">
        {SERVICES.map((s, i) => (
          <Link
            key={s.name}
            href={s.href}
            className="group flex flex-col items-center gap-1 rounded-2xl border-2 border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-800/90 backdrop-blur px-5 py-4 shadow-lg shadow-slate-200/30 dark:shadow-none card-hover hover:border-violet-300 dark:hover:border-violet-600 hover:shadow-violet-500/10 transition-all"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <span className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
              {s.name}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{s.short}</span>
          </Link>
        ))}
      </div>
      <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-4">
        One membership · All connected
      </p>
    </div>
  );
}
