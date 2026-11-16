import type { Metadata } from "next";
import Link from "next/link";
import { insightsArticles } from "@/lib/insightsContent";
import { Navigation } from "@/components/Navigation";
import { PageHero } from "@/components/marketing/PageHero";
import { Footer } from "@/components/Footer";
import { ArrowRightIcon, DocumentTextIcon } from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

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
    <div className="axiom-canvas min-h-screen relative">

      <Navigation />
      <main className="mx-auto max-w-[1240px] px-5 pb-20 pt-32 sm:px-10 lg:pb-28">
        <PageHero
          eyebrow="Insights"
          title="Field notes from"
          muted="production."
          lead="Technical deep-dives on production AI, RAG vs. fine-tuning, AI cost management, internal assistants, cloud security, IAM, and DevOps. No hype — practical guidance for modern infrastructure."
        />
        <div className="h-12 sm:h-16" aria-hidden="true" />
        <Stagger delay={0.1} interval={0.06}>
          <ul className="space-y-6">
            {insightsArticles.map((article) => (
              <li key={article.slug}>
                <Link
                  href={`/insights/${article.slug}`}
                  className="block rounded-xl border border-white/8 bg-[var(--public-surface)] p-6 sm:p-8 hover:border-white/12 transition-all group"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 rounded-lg bg-white/5 p-3">
                      <DocumentTextIcon className="h-6 w-6 text-zinc-300" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-semibold text-white group-hover:text-white transition-colors">
                        {article.title}
                      </h2>
                      <p className="mt-1 text-sm text-zinc-400 line-clamp-2">
                        {article.excerpt}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
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
                    <ArrowRightIcon className="h-5 w-5 shrink-0 text-zinc-400 group-hover:text-white group-hover:translate-x-0.5 transition-all" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Stagger>

        <div className="section-divider my-12" />

        <Reveal direction="up" blur delay={0.15}>
          <section className="rounded-xl border border-white/8 bg-[var(--public-surface)] p-8 text-center sm:p-12">
            <h2 className="text-xl font-bold text-white mb-2 tracking-[-0.04em]">
              See V19 in context
            </h2>
            <p className="text-zinc-400 text-sm mb-4 max-w-xl mx-auto">
              Watch a scripted repository-to-deployment workflow, then download
              the desktop app to connect a supported system.
            </p>
            <Link className="public-feature-action" href="/download">
              Download V19
            </Link>
          </section>
        </Reveal>
      </main>
      <Footer />
    </div>
  );
}
