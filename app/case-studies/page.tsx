import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Case Studies | Vision XIX Labs",
  description:
    "Case study templates for cloud solutions delivered on AWS and Azure. We share specific, relevant examples on request.",
};

const templates = [
  {
    title: "Example template – modernizing a SaaS platform",
    challenge:
      "A growing SaaS product needed a more reliable, cost-effective cloud platform without disrupting feature delivery.",
    approach:
      "We assessed the current AWS setup, introduced a clearer environment structure, implemented CI/CD improvements, and established basic observability and cost guardrails.",
    outcome:
      "The team gained a more predictable release process and clearer visibility into performance and spend, with a roadmap for further improvements.",
  },
  {
    title: "Example template – internal enterprise application",
    challenge:
      "An internal line-of-business application needed to move from on-premises hosting to the cloud while maintaining uptime for business users.",
    approach:
      "We designed a landing zone on AWS or Azure, created migration runbooks, and introduced monitoring, backup, and access controls aligned to existing policies.",
    outcome:
      "The application moved to the cloud with clearer operations practices and a platform ready for future enhancements.",
  },
  {
    title: "Example template – cost and reliability review",
    challenge:
      "An engineering team had a working cloud platform but rising costs and ad-hoc incident handling.",
    approach:
      "We performed a focused assessment across cost, reliability, and observability, then implemented targeted changes and documented runbooks with the team.",
    outcome:
      "The team saw fewer surprises during incidents and more predictable monthly cloud costs, backed by a prioritized improvement roadmap.",
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-xs text-slate-500 dark:text-slate-400"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Case Studies
              </li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Case Studies
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
              The examples below are templates that illustrate how we describe
              work. We don&apos;t list client names or specifics here; we&apos;re
              happy to share relevant, anonymized examples on request.
            </p>
          </header>

          {/* Template cards */}
          <section className="grid gap-6 md:grid-cols-3 mb-8">
            {templates.map((template) => (
              <article
                key={template.title}
                className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full"
              >
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  {template.title}
                </h2>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Challenge
                    </p>
                    <p>{template.challenge}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Approach
                    </p>
                    <p>{template.approach}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      Outcome
                    </p>
                    <p>{template.outcome}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>

          <section className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            <p className="mb-3">
              These templates are intentionally generic. They show the level of
              detail we provide when we walk through real work, including
              architecture choices, trade-offs, and lessons learned.
            </p>
            <p>
              If you&apos;d like examples that are closer to your context,
              we&apos;re happy to share relevant anonymized case studies during
              a conversation.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

