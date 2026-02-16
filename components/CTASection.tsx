"use client";

import Link from "next/link";

type CTASectionProps = {
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
};

export function CTASection({
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: CTASectionProps) {
  const isEmail = secondaryHref.startsWith("mailto:");

  const SecondaryComponent: any = isEmail ? "a" : Link;

  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl px-8 py-12 text-center text-white shadow-2xl">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
        <p className="text-base md:text-lg text-indigo-100 mb-8">{subtitle}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href={primaryHref}
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl bg-white text-indigo-700 font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            {primaryLabel}
          </Link>
          <SecondaryComponent
            href={secondaryHref}
            className="inline-flex items-center justify-center px-8 py-3 rounded-xl border border-indigo-200/70 bg-indigo-700/40 text-white font-semibold hover:bg-indigo-700/70 hover:-translate-y-0.5 transition-all"
          >
            {secondaryLabel}
          </SecondaryComponent>
        </div>
      </div>
    </section>
  );
}

