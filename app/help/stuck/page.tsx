"use client";

import Link from "next/link";
import Image from "next/image";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import { HERO_IMAGES, SECTION_IMAGES } from "@/lib/images";

export default function StuckPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.office} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white mb-2">I&apos;m Stuck / What Now?</h1>
          <p className="text-sm text-white/90">Get help when your case is delayed or stuck</p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        <div className="uscis-card relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.05]">
            <Image src={SECTION_IMAGES.documents} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="relative p-6">
            <p className="text-[var(--text-secondary)] mb-6 text-sm">
              If your case seems stuck or delayed, here are your options:
            </p>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4 py-3">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">1. Submit an Inquiry</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  Contact USCIS/NVC/Embassy online or by phone to check on your case status.
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Cost: Free</p>
              </div>
              <div className="border-l-4 border-green-500 pl-4 py-3">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">2. Congressional Inquiry</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  Contact your Congressperson's office for help with your case.
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Cost: Free</p>
              </div>
              <div className="border-l-4 border-orange-500 pl-4 py-3">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">3. Expedite Request</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  Request faster processing - may require evidence of urgent need.
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Cost: Varies</p>
              </div>
              <div className="border-l-4 border-red-500 pl-4 py-3">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2">4. Mandamus Lawsuit</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  Legal action to force a decision. Consult an immigration attorney first.
                </p>
                <p className="text-xs text-[var(--text-secondary)]">Cost: $5,000-$15,000</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-2 font-semibold">
                  ⚠️ This is not legal advice. Consult an immigration attorney before taking legal action.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <BackToHelpCenterLink className="uscis-link text-sm font-semibold" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


