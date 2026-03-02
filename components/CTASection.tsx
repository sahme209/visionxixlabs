"use client";

import Link from "next/link";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

type CTASectionProps = {
  title: string;
  subtitle: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel: string;
  secondaryHref: string;
  /** Optional: Plans & Membership link shown below main CTAs */
  plansHref?: string;
};

export function CTASection({
  title,
  subtitle,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  plansHref,
}: CTASectionProps) {
  return (
    <section className="py-16">
      <div className="max-w-4xl mx-auto bg-gradient-to-r from-indigo-600 to-purple-600 rounded-3xl px-8 py-12 text-center text-white shadow-2xl">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">{title}</h2>
        <p className="text-base md:text-lg text-indigo-100 mb-8">{subtitle}</p>
        <div className="flex flex-wrap justify-center gap-4">
          <AnimatedButton
            href={primaryHref}
            variant="secondary"
            className="bg-white text-indigo-700 hover:bg-indigo-50 px-8 py-3 rounded-xl shadow-lg"
          >
            {primaryLabel}
          </AnimatedButton>
          <AnimatedButton
            href={secondaryHref}
            variant="ghost"
            className="border border-indigo-200/70 bg-indigo-700/40 text-white hover:bg-indigo-700/70 px-8 py-3 rounded-xl"
          >
            {secondaryLabel}
          </AnimatedButton>
        </div>
        {plansHref && (
          <p className="mt-6 text-sm text-indigo-200">
            One membership, full stack —{" "}
            <Link href={plansHref} className="font-semibold text-white underline underline-offset-2 hover:text-indigo-100">
              View plans &amp; membership
            </Link>
          </p>
        )}
      </div>
    </section>
  );
}

