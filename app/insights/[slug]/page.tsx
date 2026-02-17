import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInsightBySlug,
  getAllInsightSlugs,
} from "@/lib/insightsContent";
import { Navigation } from "@/components/Navigation";
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <nav className="mb-8" aria-label="Breadcrumb">
          <Link
            href="/insights"
            className="inline-flex items-center text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Insights
          </Link>
        </nav>

        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            {article.title}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            <time dateTime={article.date}>
              {new Date(article.date).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            {" · "}
            {article.readTime} read
          </p>
        </header>

        <div className="prose prose-slate dark:prose-invert max-w-none">
          {article.body.map((paragraph, i) => (
            <p key={i} className="mb-4 text-slate-700 dark:text-slate-300 leading-relaxed">
              {paragraph}
            </p>
          ))}
        </div>

        <section className="mt-12 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-6 text-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">
            Free Cloud &amp; AI Review
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
            Get a focused 30-minute review of your cloud and AI setup. No obligation.
          </p>
          <Link
            href="/free-review"
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Request your free review
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
        </section>

        <nav className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between gap-4">
          {prevArticle ? (
            <Link
              href={`/insights/${prevArticle.slug}`}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              ← {prevArticle.title}
            </Link>
          ) : (
            <span />
          )}
          {nextArticle ? (
            <Link
              href={`/insights/${nextArticle.slug}`}
              className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline sm:text-right"
            >
              {nextArticle.title} →
            </Link>
          ) : null}
        </nav>
      </article>
    </div>
  );
}
