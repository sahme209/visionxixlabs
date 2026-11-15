import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInsightBySlug,
  getAllInsightSlugs,
} from "@/lib/insightsContent";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { ArrowLeftIcon, ArrowRightIcon } from "@heroicons/react/24/outline";

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
    <div className="axiom-canvas min-h-screen relative">

      <Navigation />
      <main className="relative mx-auto max-w-[1240px] px-5 pt-32 pb-20 sm:px-10">
          <nav className="mb-8" aria-label="Breadcrumb">
            <Link
              href="/insights"
              className="inline-flex items-center text-sm text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1" aria-hidden="true" />
              Insights
            </Link>
          </nav>

          <header className="mx-auto mb-10 max-w-[70ch]">
            <h1 className="text-[clamp(2.5rem,4.2vw,3.5rem)] font-normal text-white mb-5 tracking-[-0.045em] leading-[1.05] [overflow-wrap:anywhere]">
              {article.title}
            </h1>
            <p className="flex flex-wrap items-center gap-y-2 text-zinc-400 text-xs font-mono uppercase tracking-[0.16em]">
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

          <div className="article-body mx-auto max-w-[70ch] [overflow-wrap:anywhere]">
            {article.body.map((paragraph, i) => (
              <p key={i} className="mb-5 text-[15.5px] leading-[1.75] text-zinc-300">
                {paragraph}
              </p>
            ))}
          </div>

        <div className="section-divider my-10" />

          <section className="mx-auto max-w-[70ch] rounded-xl border border-white/8 bg-[var(--public-surface)] p-6 text-center sm:p-10">
            <h2 className="text-lg font-medium text-white mb-2 tracking-[-0.04em]">
              See V19 in context
            </h2>
            <p className="text-zinc-400 text-sm mb-4">
              Explore the scripted governed workflow, then download the current
              desktop release to connect a supported system.
            </p>
            <Link
              href="/download"
              className="public-feature-action"
            >
              Download V19
              <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
            </Link>
          </section>

        <nav className="mt-12 pt-8 border-t border-white/6 flex flex-col sm:flex-row justify-between gap-4">
          {prevArticle ? (
            <Link
              href={`/insights/${prevArticle.slug}`}
              className="text-sm font-medium text-zinc-300 hover:underline transition-colors inline-block min-w-0 sm:max-w-[45%] [overflow-wrap:anywhere]"
            >
              &larr; {prevArticle.title}
            </Link>
          ) : (
            <span />
          )}
          {nextArticle ? (
            <Link
              href={`/insights/${nextArticle.slug}`}
              className="text-sm font-medium text-zinc-300 hover:underline sm:text-right transition-colors inline-block min-w-0 sm:max-w-[45%] [overflow-wrap:anywhere]"
            >
              {nextArticle.title} &rarr;
            </Link>
          ) : null}
        </nav>
      </main>
      <Footer />
    </div>
  );
}
