"use client";

import USCISFilingGuidance from "@/components/USCISFilingGuidance";
import USCISFeedbackWidget from "@/components/USCISFeedbackWidget";
import USCISDisclaimer from "@/components/USCISDisclaimer";
import USCISOfficialNotice from "@/components/USCISOfficialNotice";
import Link from "next/link";
import Image from "next/image";
import { DocumentTextIcon } from "@heroicons/react/24/outline";
import { HERO_IMAGES } from "@/lib/images";

export default function FilingGuidancePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)] gov-page-bg">
      {/* USCIS-style Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex items-start gap-4 relative z-10">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/25 flex-shrink-0">
              <DocumentTextIcon className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Filing Guidance
              </h1>
              <p className="text-white/90 text-sm sm:text-base leading-relaxed max-w-3xl">
                This page contains filing locations, checklists and other resources to help you understand our forms and filing requirements. To find a complete list of our forms, visit the{" "}
                <Link href="/guides" className="underline hover:no-underline font-semibold">
                  All Forms
                </Link>{" "}
                page.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 sm:py-10 w-full min-w-0">
        <USCISFilingGuidance />

        {/* FBI Privacy Notice */}
        <div className="mt-10">
          <USCISOfficialNotice type="fbi-privacy" />
        </div>

        {/* Form Warning */}
        <div className="mt-6">
          <USCISOfficialNotice type="form-warning" />
        </div>

        {/* Official Disclaimer */}
        <div className="mt-10">
          <USCISDisclaimer />
        </div>

        {/* Feedback Widget */}
        <USCISFeedbackWidget />
      </main>
    </div>
  );
}
