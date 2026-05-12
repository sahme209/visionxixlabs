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
      {/* Background effects */}
      <div className="absolute inset-0 bg-grid-mesh opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 left-1/3 w-[450px] h-[450px] rounded-full bg-violet-600/[0.06] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-40 right-0 w-72 h-72 rounded-full bg-fuchsia-600/[0.04] blur-[100px] pointer-events-none" aria-hidden />

      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 relative">
        <Reveal direction="up" blur delay={0.05}>
          <header className="mb-12 text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em]">
              <span className="text-gradient">Insights</span>
            </h1>
            <p className="text-zinc-400 max-w-2xl mx-auto">
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
              Free Cloud &amp; AI <span className="text-gradient">Review</span>
            </h2>
            <p className="text-zinc-400 text-sm mb-4 max-w-xl mx-auto">
              Get a focused 30-minute review of your cloud and AI setup. No obligation — we'll share practical recommendations and next steps.
            </p>
            <AnimatedButton variant="primary" href="/free-review">
              Request your free review
            </AnimatedButton>
          </section>
        </Reveal>
      </main>
    </div>
  );
}
