import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInsightBySlug,
  getAllInsightSlugs,
} from "@/lib/insightsContent";
import { Navigation } from "@/components/Navigation";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";

type Props = { params: Promise<{ slug: string }> };

export async function generateStaticParams() {
  return getAllInsightSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = getInsightBySlug(slug);
  if (!article) return { title: "Insight | Vision XIX Labs" };
  return {
    title: `${article.title} | Insights`,
    description: article.excerpt,
    openGraph: {
      title: article.title,
      description: article.excerpt,
      url: `https://visionxixlabs.com/insights/${article.slug}`,
    },
    alternates: { canonical: `https://visionxixlabs.com/insights/${article.slug}` },
  };
}

export default async function InsightArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = getInsightBySlug(slug);
  if (!article) notFound();

  const currentIndex = getAllInsightSlugs().indexOf(slug);
  const prevSlug = currentIndex > 0 ? getAllInsightSlugs()[currentIndex - 1] : null;
  const nextSlug =
    currentIndex >= 0 && currentIndex < getAllInsightSlugs().length - 1
      ? getAllInsightSlugs()[currentIndex + 1]
      : null;
  const prevArticle = prevSlug ? getInsightBySlug(prevSlug) : null;
  const nextArticle = nextSlug ? getInsightBySlug(nextSlug) : null;

  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Huly aurora */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] opacity-20 pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />
      <div className="ambient-drift absolute top-0 left-1/4 w-[480px] h-[400px] rounded-full bg-brand-violet/[0.07] blur-[130px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-1/4 right-[5%] w-[360px] h-[280px] rounded-full bg-brand-coral/[0.05] blur-[120px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="ambient-drift absolute bottom-1/4 left-[5%] w-[320px] h-[240px] rounded-full bg-cyan-500/[0.04] blur-[110px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />

      <Navigation />
      <article className="relative z-10 max-w-6xl mx-auto px-6 md:px-10 pt-24 pb-16">
        <Reveal direction="up" blur delay={0.05}>
          <nav className="mb-8" aria-label="Breadcrumb">
            <Link
              href="/insights"
              className="inline-flex items-center text-sm text-zinc-400 hover:text-violet-400 transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" />
              Insights
            </Link>
          </nav>
        </Reveal>

        <Reveal direction="up" blur delay={0.1}>
          <header className="mb-8">
            <h1 className="relative text-3xl md:text-4xl font-bold text-white mb-3 tracking-[-0.04em] leading-[1.06] pl-5">
              <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] rounded-full bg-gradient-to-b from-brand-coral via-fuchsia-400 to-brand-violet opacity-85" />
              {article.title}
            </h1>
            <p className="text-zinc-500 text-[12px] font-mono uppercase tracking-[0.16em]">
              <time dateTime={article.date}>
                {new Date(article.date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </time>
              <span className="text-zinc-700 mx-2">·</span>
              {article.readTime} read
            </p>
          </header>
        </Reveal>

        <Reveal direction="up" blur delay={0.15}>
          <div className="article-body max-w-none">
            {article.body.map((paragraph, i) => (
              <p key={i} className="mb-4 text-zinc-300 leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>

        <div className="section-divider my-10" />

        <Reveal direction="up" blur delay={0.2}>
          <section className="glass-card glow-border-card rounded-2xl p-6 text-center">
            <h2 className="text-lg font-bold text-white mb-2 tracking-[-0.04em]">
              Try <span className="text-gradient">Axiom Agent</span>
            </h2>
            <p className="text-zinc-400 text-sm mb-4">
              Autonomous cloud operations for AWS, Azure, and GCP. Connect your cloud in minutes.
            </p>
            <Link
              href="/download"
              className="btn-huly cta-glow inline-flex items-center px-5 py-2.5 rounded-full bg-white text-zinc-900 text-sm font-semibold hover:bg-zinc-100 transition-colors"
            >
              Download Axiom Agent
              <ArrowRightIcon className="ml-2 h-4 w-4" />
            </Link>
          </section>
        </Reveal>

        <nav className="mt-12 pt-8 border-t border-white/[0.06] flex flex-col sm:flex-row justify-between gap-4">
          {prevArticle ? (
            <Link
              href={`/insights/${prevArticle.slug}`}
              className="text-sm font-medium text-violet-400 hover:underline hover-lift transition-all inline-block"
            >
              &larr; {prevArticle.title}
            </Link>
          ) : (
            <span />
          )}
          {nextArticle ? (
            <Link
              href={`/insights/${nextArticle.slug}`}
              className="text-sm font-medium text-violet-400 hover:underline sm:text-right hover-lift transition-all inline-block"
            >
              {nextArticle.title} &rarr;
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  );
}
