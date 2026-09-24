import type { Metadata } from "next";
import Link from "next/link";
import {
  cloudSolutionCards,
  solutionDetails,
  type SolutionDetail,
} from "../../../lib/cloudContent";
import { CTASection } from "../../../components/CTASection";
import { Navigation } from "../../../components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

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

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  const detail = getSolutionDetail(resolvedParams.solutionId);
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

export default async function SolutionDetailPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const resolvedParams = await params;
  const solutionId = resolvedParams.solutionId;
  const detail = getSolutionDetail(solutionId);
  const normalizedId = normalizeId(solutionId);
  const cardMeta =
    cloudSolutionCards.find((c) => normalizeId(c.id) === normalizedId) ??
    cloudSolutionCards.find((c) =>
      normalizeId(c.href.split("/").filter(Boolean).slice(-1)[0] ?? "") ===
      normalizedId,
    );

  if (!detail || !cardMeta) {
    return (
      <div className="min-h-screen bg-[#09090b]">
        <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">
              Solution not found
            </h1>
            <p className="text-sm text-zinc-400 mb-6">
              The cloud solution you were looking for could not be found.
            </p>
            <Link
              href="/cloud-solutions"
              className="text-sm font-semibold text-violet-400 hover:text-violet-300 underline underline-offset-4"
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
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="spotlight-orb absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-30 pointer-events-none" />
      <div className="bg-dots absolute inset-0 pointer-events-none" />

      <Navigation />
      <main className="relative z-10 pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          {/* Breadcrumb */}
          <Reveal direction="up" blur delay={0.05}>
            <nav
              aria-label="Breadcrumb"
              className="mb-6 text-xs text-zinc-500"
            >
              <ol className="flex items-center space-x-2">
                <li>
                  <Link
                    href="/"
                    className="hover:text-violet-400 transition-colors"
                  >
                    Home
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <Link
                    href="/cloud-solutions"
                    className="hover:text-violet-400 transition-colors"
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
          </Reveal>

          {/* Hero */}
          <Reveal direction="up" blur delay={0.1}>
            <section className="mb-10">
              <p className="mono-label inline-flex items-center gap-3 mb-4">
                <span className="text-brand-coral/90 tabular-nums">CS</span>
                <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
                Cloud solution
              </p>
              <h1 className="font-display text-4xl md:text-5xl font-bold mb-3 leading-[1.04]">
                <span className="relative inline-block">
                  {detail.title}
                  <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
                </span>
              </h1>
              <p className="text-sm md:text-base text-zinc-400 max-w-3xl mb-3">
                {detail.intro}
              </p>
              <p className="text-xs text-zinc-500">
                <span className="font-semibold">Best for:</span> {cardMeta.bestFor}
              </p>
              {detail.idealFor.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {detail.idealFor.map((item) => (
                    <span
                      key={item}
                      className="huly-badge"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </section>
          </Reveal>

          <div className="section-divider my-8" />

          {/* Sections */}
          <section className="space-y-8 mb-10">
            <Stagger delay={0.15} interval={0.08}>
              {detail.sections.map((section) => (
                <div
                  key={section.heading}
                  className="glass-card card-hover animated-border card-inner-glow rounded-2xl p-6"
                >
                  <h2 className="text-lg md:text-xl font-bold text-white mb-2 tracking-[-0.04em]">
                    {section.heading}
                  </h2>
                  <p className="text-sm md:text-base text-zinc-400 mb-3">
                    {section.body}
                  </p>
                  {section.bullets && (
                    <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </Stagger>
          </section>

          <div className="section-divider my-8" />

          {/* Related providers */}
          <Reveal direction="up" blur delay={0.1}>
            <section className="mb-12">
              <h2 className="text-sm font-semibold text-white mb-3 tracking-[-0.04em]">
                Related cloud provider offerings
              </h2>
              <div className="flex flex-wrap gap-3 text-xs">
                {providerLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="huly-badge hover:text-violet-400 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </section>
          </Reveal>

          <div className="section-divider my-8" />

          {/* CTA */}
          <Reveal direction="up" blur delay={0.15}>
            <CTASection
              title="Discuss this solution with an engineer."
              subtitle="If this area matches a pain point you're seeing today, we can walk through what it would look like in your environment and define clear next steps."
              primaryLabel="Talk to an Engineer"
              primaryHref="/contact"
              secondaryLabel="Download Axiom Agent"
              secondaryHref="/download"
              plansHref="/operator/pricing"
            />
          </Reveal>
        </div>
      </main>
    </div>
  );
}
