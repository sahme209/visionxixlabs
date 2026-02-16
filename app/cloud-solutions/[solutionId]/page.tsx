import type { Metadata } from "next";
import Link from "next/link";
import {
  cloudSolutionCards,
  solutionDetails,
  type SolutionDetail,
} from "../../../lib/cloudContent";
import { CTASection } from "../../../components/CTASection";

type Params = {
  solutionId: string;
};

function normalizeId(value: string): string {
  return decodeURIComponent(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
}

function getSolutionDetail(id: string): SolutionDetail | undefined {
  const target = normalizeId(id);
  return solutionDetails.find((s) => normalizeId(s.id) === target);
}

export function generateMetadata({ params }: { params: Params }): Metadata {
  const detail = getSolutionDetail(params.solutionId);
  if (!detail) {
    return {
      title: "Cloud Solution | Vision XIX Labs",
    };
  }

  return {
    title: `${detail.title} | Cloud Solutions | Vision XIX Labs`,
    description: detail.intro,
  };
}

export default function SolutionDetailPage({ params }: { params: Params }) {
  const detail = getSolutionDetail(params.solutionId);
  const normalizedId = normalizeId(params.solutionId);
  const cardMeta =
    cloudSolutionCards.find((c) => normalizeId(c.id) === normalizedId) ??
    cloudSolutionCards.find((c) =>
      normalizeId(c.href.split("/").filter(Boolean).slice(-1)[0] ?? "") ===
      normalizedId,
    );

  if (!detail || !cardMeta) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Solution not found
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
              The cloud solution you were looking for could not be found.
            </p>
            <Link
              href="/cloud-solutions"
              className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 underline underline-offset-4"
            >
              Back to Cloud Solutions
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const providerLinks = detail.relatedProviders.map((provider) => {
    if (provider === "aws") {
      return {
        label: "AWS Cloud Engineering",
        href: "/cloud-solutions/aws",
      };
    }
    if (provider === "azure") {
      return {
        label: "Azure Cloud Engineering",
        href: "/cloud-solutions/azure",
      };
    }
    if (provider === "gcp") {
      return {
        label: "GCP Engineering",
        href: "/cloud-solutions/gcp",
      };
    }
    return {
      label: "Multi-Cloud Strategy",
      href: "/multi-cloud",
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
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
              <li>
                <Link
                  href="/cloud-solutions"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Cloud Solutions
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                {detail.title}
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <section className="mb-10">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400 mb-3">
              Cloud solution
            </p>
            <h1 className="text-3xl md:text-4xl font-extrabold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              {detail.title}
            </h1>
            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-3xl mb-3">
              {detail.intro}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              <span className="font-semibold">Best for:</span> {cardMeta.bestFor}
            </p>
            {detail.idealFor.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {detail.idealFor.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-900 px-3 py-1 text-xs text-slate-700 dark:text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            )}
          </section>

          {/* Sections */}
          <section className="space-y-8 mb-10">
            {detail.sections.map((section) => (
              <div
                key={section.heading}
                className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700"
              >
                <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                  {section.heading}
                </h2>
                <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-3">
                  {section.body}
                </p>
                {section.bullets && (
                  <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1">
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </section>

          {/* Related providers */}
          <section className="mb-12">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Related cloud provider offerings
            </h2>
            <div className="flex flex-wrap gap-3 text-xs">
              {providerLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex items-center px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          {/* CTA */}
          <CTASection
            title="Discuss this solution with an engineer."
            subtitle="If this area matches a pain point you’re seeing today, we can walk through what it would look like in your environment and define clear next steps."
            primaryLabel="Talk to an Engineer"
            primaryHref="/contact"
            secondaryLabel="Email Us"
            secondaryHref="mailto:support@visionxixlabs.com"
          />
        </div>
      </main>
    </div>
  );
}

