"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CheckCircleIcon, ArrowRightIcon } from "@heroicons/react/24/outline";
import { PARENT_WEBSITE } from "@/lib/constants/company";

export default function ThankYouPage() {
  const searchParams = useSearchParams();
  const min = Number(searchParams.get("min")) || 0;
  const max = Number(searchParams.get("max")) || 0;
  const hasEstimate = min > 0 && max > 0;
  const formatted =
    hasEstimate
      ? `$${min.toLocaleString()} - $${max.toLocaleString()}`
      : "—";

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      <nav className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link
            href={PARENT_WEBSITE}
            className="font-semibold text-[var(--text-primary)] hover:text-[var(--uscis-blue)]"
          >
            Vision XIX Labs
          </Link>
          <Link
            href="/request"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--uscis-blue)]"
          >
            New request
          </Link>
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl text-center">
          <div className="flex justify-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--uscis-green)]/20 text-[var(--uscis-green)]">
              <CheckCircleIcon className="h-10 w-10" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3">
            Thank you!
          </h1>
          <p className="text-[var(--text-secondary)] mb-8">
            We&apos;ve received your website request and will be in touch within 1–2 business days.
          </p>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 mb-8 text-left">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              Estimated Project Range
            </h2>
            <p className="text-2xl font-bold text-[var(--uscis-blue)] mb-4">
              {formatted}
            </p>
            <p className="text-sm text-[var(--text-tertiary)]">
              This is an estimate only. Final pricing will be confirmed after review.
            </p>
          </div>

          <Link
            href={PARENT_WEBSITE}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-6 py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
          >
            Back to Vision XIX Labs
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
