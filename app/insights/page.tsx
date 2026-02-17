import type { Metadata } from "next";
import Link from "next/link";
import { insightsArticles } from "@/lib/insightsContent";
import { Navigation } from "@/components/Navigation";
import { ArrowRightIcon, DocumentTextIcon } from "@heroicons/react/24/outline";

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        <header className="mb-12 text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">
            Insights
          </h1>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Technical deep-dives on cloud security, IAM, AI integration, DevOps automation, and cost optimization. No hype — practical guidance for modern infrastructure.
          </p>
        </header>

        <ul className="space-y-6">
          {insightsArticles.map((article) => (
            <li key={article.slug}>
              <Link
                href={`/insights/${article.slug}`}
                className="block rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 p-3">
                    <DocumentTextIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {article.title}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {article.excerpt}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
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
                  <ArrowRightIcon className="h-5 w-5 flex-shrink-0 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-16 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Free Cloud &amp; AI Review
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-4 max-w-xl mx-auto">
            Get a focused 30-minute review of your cloud and AI setup. No obligation — we’ll share practical recommendations and next steps.
          </p>
          <Link
            href="/free-review"
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Request your free review
            <ArrowRightIcon className="ml-2 h-4 w-4" />
          </Link>
        </section>
      </main>
    </div>
  );
}
