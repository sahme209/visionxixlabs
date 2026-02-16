import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Work we've done",
  description:
    "Examples of cloud and platform engineering we've delivered: SaaS modernization, migrations, CI/CD, cost optimization. Anonymized; we share more detail on request.",
  openGraph: {
    title: "Work we've done | Case studies | Vision XIX Labs",
    description: "Cloud and platform engineering examples: SaaS, migrations, CI/CD, FinOps.",
    url: "https://visionxixlabs.com/case-studies",
  },
  alternates: { canonical: "https://visionxixlabs.com/case-studies" },
};

const caseStudies = [
  {
    title: "Modernizing a SaaS platform",
    challenge:
      "A growing SaaS product needed a more reliable, cost-effective cloud platform without disrupting feature delivery.",
    approach:
      "We assessed the current AWS setup, introduced a clearer environment structure, implemented CI/CD improvements, and established basic observability and cost guardrails.",
    outcome:
      "The team gained a more predictable release process and clearer visibility into performance and spend, with a roadmap for further improvements.",
    delivered: "Landing zone design · IaC baseline · GitHub + Octopus pipelines · Cost dashboards",
  },
  {
    title: "Internal enterprise application to cloud",
    challenge:
      "An internal line-of-business application needed to move from on-premises hosting to the cloud while maintaining uptime for business users.",
    approach:
      "We designed a landing zone on AWS or Azure, created migration runbooks, and introduced monitoring, backup, and access controls aligned to existing policies.",
    outcome:
      "The application moved to the cloud with clearer operations practices and a platform ready for future enhancements.",
    delivered: "Landing zone · Migration runbooks · Monitoring and backup · Access model",
  },
  {
    title: "Cost and reliability review",
    challenge:
      "An engineering team had a working cloud platform but rising costs and ad-hoc incident handling.",
    approach:
      "We performed a focused assessment across cost, reliability, and observability, then implemented targeted changes and documented runbooks with the team.",
    outcome:
      "The team saw fewer surprises during incidents and more predictable monthly cloud costs, backed by a prioritized improvement roadmap.",
    delivered: "Cost and reliability assessment · Runbooks · Alerting and dashboards · Prioritized roadmap",
  },
  {
    title: "CI/CD and release governance",
    challenge:
      "Releases were manual, slow, and inconsistent across teams; audit and rollback were unclear.",
    approach:
      "We defined a branching and promotion strategy, implemented pipeline-based deployments with GitHub and Octopus Deploy, and added approval steps and audit trails.",
    outcome:
      "Faster, safer releases with a clear audit trail and consistent promotion from dev to production.",
    delivered: "Pipeline design · Branching strategy · Octopus release workflows · Runbooks",
  },
];

export default function CaseStudiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
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
                Work we&apos;ve done
              </li>
            </ol>
          </nav>

          {/* Header */}
          <header className="mb-10">
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Work we&apos;ve done
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl">
              Examples of the kind of engagements we deliver. Anonymized; we&apos;re happy to share more relevant detail in a conversation.
            </p>
          </header>

          {/* Case study cards */}
          <section className="grid gap-6 md:grid-cols-2 mb-10">
            {caseStudies.map((study) => (
              <article
                key={study.title}
                className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 flex flex-col h-full"
              >
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  {study.title}
                </h2>
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-400 flex-grow">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Challenge</p>
                    <p>{study.challenge}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">What we did</p>
                    <p>{study.approach}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Outcome</p>
                    <p>{study.outcome}</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-500 pt-2 border-t border-slate-200 dark:border-slate-700">
                    Delivered: {study.delivered}
                  </p>
                </div>
              </article>
            ))}
          </section>

          <section className="max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            <p>
              Want examples closer to your context? We&apos;re happy to walk through relevant anonymized work in a call.
            </p>
            <Link
              href="/contact"
              className="mt-4 inline-flex items-center text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
            >
              Talk to us
              <ArrowRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </section>
        </div>
      </main>
    </div>
  );
}

