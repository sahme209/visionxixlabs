import type { Metadata } from "next";
import Link from "next/link";
import { insightsArticles } from "@/lib/insightsContent";
import { Navigation } from "@/components/Navigation";
import { ArrowRightIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

export const metadata: Metadata = {
  title: "Insights | Cloud & AI Engineering",
  description:
    "Technical articles on cloud security, IAM, AI integration risks, DevOps automation, and cost optimization.",
  openGraph: {
    title: "Insights | Vision XIX Labs",
    description: "Technical insights on cloud security, DevOps, and production AI.",
    url: "https://visionxixlabs.com/insights",
  },
  alternates: { canonical: "https://visionxixlabs.com/insights" },
};

export default function InsightsPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Huly aurora */}
      <div className="absolute inset-0 bg-grid-mesh opacity-10 pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute -top-40 left-1/3 w-[520px] h-[480px] rounded-full bg-brand-violet/[0.08] blur-[140px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-1/4 right-[5%] w-[420px] h-[340px] rounded-full bg-brand-coral/[0.06] blur-[120px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="ambient-drift absolute bottom-32 left-[5%] w-[360px] h-[280px] rounded-full bg-cyan-500/[0.04] blur-[110px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />

      <Navigation />
      <main className="max-w-6xl mx-auto px-6 md:px-10 pt-32 pb-16 relative">
        <Reveal direction="up" blur delay={0.05}>
          <header className="mb-12">
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
              <span className="text-brand-coral/90 tabular-nums">I1</span>
              <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              Insights
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.04em] leading-[1.04] mb-4">
              Field notes from{" "}
              <span className="relative inline-block">
                production.
                <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-85" />
              </span>
            </h1>
            <p className="text-zinc-400 max-w-2xl">
              Technical deep-dives on production AI, RAG vs. fine-tuning, AI cost management, internal assistants, cloud security, IAM, and DevOps. No hype — practical guidance for modern infrastructure.
            </p>
          </header>
        </Reveal>

        <Stagger delay={0.1} interval={0.06}>
          <ul className="space-y-6">
            {insightsArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/insights/${article.slug}`}
                  className="block animated-border card-inner-glow card-hover rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 shadow-sm hover:border-white/[0.12] transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 rounded-lg bg-violet-500/10 p-3">
                      <DocumentTextIcon className="h-6 w-6 text-violet-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-white group-hover:text-violet-400 transition-colors">
                        {article.title}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                        {article.excerpt}
                      </p>
                      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500">
                        <time dateTime={article.date}>
                          {new Date(article.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </time>
                        <span>{article.readTime} read</span>
                      </div>
                    </div>
                    <ArrowRightIcon className="h-5 w-5 flex-shrink-0 text-zinc-500 group-hover:text-violet-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Stagger>

        <div className="section-divider my-12" />

        <Reveal direction="up" blur delay={0.15}>
          <section className="glass-card rounded-2xl border border-violet-500/20 bg-violet-500/10 p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2 tracking-[-0.04em]">
              Try <span className="text-gradient">Axiom Agent</span>
            </h2>
            <p className="text-zinc-400 text-sm mb-4 max-w-xl mx-auto">
              Autonomous cloud operations for AWS, Azure, and GCP. Connect your cloud and let Axiom handle the rest.
            </p>
            <AnimatedButton variant="primary" href="/auth/signup?redirect=/dashboard/connect-cloud">
              Run Axiom
            </AnimatedButton>
          </section>
        </Reveal>
      </main>
    </div>
  );
}
