"use client";

import { ExclamationCircleIcon, PhoneIcon } from "@heroicons/react/24/outline";

/**
 * Travel.State.Gov style banner: STEP enrollment + U.S. citizen emergency contact.
 * Matches travel.state.gov prominence with Apple-style refinement.
 */
export default function TravelStateEmergencyBanner() {
  return (
    <div className="rounded-2xl border border-orange-500/25 bg-gradient-to-br from-orange-500/5 via-orange-500/8 to-transparent overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex items-start gap-3 sm:flex-1">
            <div className="w-10 h-10 rounded-xl bg-orange-500/12 flex items-center justify-center flex-shrink-0">
              <ExclamationCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wider mb-1">
                U.S. citizen travelers
              </p>
              <p className="text-sm text-[var(--text-primary)] font-medium mb-2">
                Enroll in{" "}
                <a href="https://step.state.gov/" target="_blank" rel="noopener noreferrer" className="text-[var(--text-primary)] hover:underline font-semibold">
                  STEP (step.state.gov)
                </a>{" "}
                to receive alerts and ensure the U.S. can locate you in an emergency abroad.
              </p>
            </div>
          </div>
          <div className="sm:border-l sm:border-orange-500/20 sm:pl-5 flex flex-col gap-2">
            <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              In an emergency
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Contact the nearest U.S. Embassy or call:
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="tel:+18884074747" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/5 transition-colors">
                <PhoneIcon className="w-4 h-4" /> 1-888-407-4747
              </a>
              <span className="text-[var(--text-tertiary)] text-xs self-center">U.S./Canada</span>
              <a href="tel:+12025014444" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/5 transition-colors">
                <PhoneIcon className="w-4 h-4" /> +1-202-501-4444
              </a>
              <span className="text-[var(--text-tertiary)] text-xs self-center">Overseas</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
