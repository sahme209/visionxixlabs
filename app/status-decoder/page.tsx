"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  MagnifyingGlassIcon,
  QuestionMarkCircleIcon,
  CheckCircleIcon,
  LightBulbIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { findExplanation, popularStatuses } from "@/lib/data/statusDecoder";
import USCISDisclaimer from "@/components/USCISDisclaimer";
import { HERO_IMAGES } from "@/lib/images";

export default function StatusDecoderPage() {
  const [input, setInput] = useState("");
  const [searched, setSearched] = useState(false);
  const result = input.trim() ? findExplanation(input) : null;

  const handleSearch = () => setSearched(true);
  const handleChipClick = (text: string) => {
    setInput(text);
    setSearched(true);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.office}
            alt=""
            fill
            className="object-cover object-center opacity-20 w-full"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0, 113, 227, 0.2) 0%, transparent 50%)" }} />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shadow-lg">
              <MagnifyingGlassIcon className="w-6 h-6 text-white" />
            </div>
            <div className="hero-text-white" style={{ color: "#ffffff" }}>
              <h1 className="text-xl sm:text-2xl font-bold !text-white" style={{ color: "#ffffff" }}>Status Decoder</h1>
              <p className="text-sm !text-white mt-0.5" style={{ color: "#ffffff" }}>
                Paste any case status—we decode the legalese into plain English. No more guessing what it means.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-4 mb-6">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">What is a case status?</p>
          <p className="text-sm text-[var(--text-secondary)]">The status appears when you check your case on USCIS.gov. It uses formal language—we decode it into plain English and explain what to expect next.</p>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-md overflow-hidden mb-6">
          <div className="p-5 sm:p-6">
            <label htmlFor="status-input" className="block text-sm font-medium text-[var(--text-primary)] mb-2">
              Your case status text
            </label>
            <div className="flex gap-2">
              <input
                id="status-input"
                type="text"
                placeholder="e.g. Case Was Received and a Receipt Notice Was Sent"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setSearched(false);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 px-4 py-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                className="px-5 py-3 rounded-xl bg-[var(--uscis-blue)] text-white font-semibold hover:bg-[var(--uscis-blue-dark)] hover:shadow-lg hover:shadow-[var(--uscis-blue)]/25 transition-all duration-200 shadow-md"
              >
                Decode
              </button>
            </div>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              Click a common status below for instant decode
            </p>
          </div>

          <div className="px-5 sm:px-6 pb-5">
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
              Popular statuses
            </p>
            <div className="flex flex-wrap gap-2">
              {popularStatuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleChipClick(s)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] hover:bg-[var(--uscis-blue)]/10 hover:text-[var(--text-primary)] border border-[var(--border-color)] hover:border-[var(--uscis-blue)]/40 transition-all duration-200 truncate max-w-[200px]"
                >
                  {s.length > 35 ? s.slice(0, 32) + "…" : s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {(searched || result) && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-md overflow-hidden mb-6">
            <div className="p-5 sm:p-6">
              {result ? (
                <div className="space-y-5">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircleIcon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h2 className="text-lg font-semibold text-[var(--text-primary)]">What this means</h2>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-1">
                    <div className="rounded-xl bg-[var(--bg-surface-alt)]/60 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                        Summary
                      </p>
                      <p className="text-[var(--text-primary)] font-medium">{result.summary}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--bg-surface-alt)]/60 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                        In plain language
                      </p>
                      <p className="text-[var(--text-primary)]">{result.whatItMeans}</p>
                    </div>
                    <div className="rounded-xl bg-[var(--uscis-blue)]/5 border border-[var(--uscis-blue)]/20 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-primary)] mb-1">
                        Typical next step
                      </p>
                      <p className="text-[var(--text-primary)]">{result.typicalNext}</p>
                    </div>
                    {result.tip && (
                      <div className="flex gap-3 rounded-xl bg-orange-50/80 dark:bg-orange-900/10 border border-orange-200/50 dark:border-orange-800/30 p-4">
                        <LightBulbIcon className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold text-orange-700 dark:text-orange-400 mb-0.5">Tip</p>
                          <p className="text-sm text-[var(--text-secondary)]">{result.tip}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--uscis-blue)]/10 flex items-center justify-center mb-4">
                    <QuestionMarkCircleIcon className="w-7 h-7 text-[var(--text-primary)]" />
                  </div>
                  <p className="text-sm font-medium text-[var(--text-primary)] mb-1">
                    We couldn&apos;t match that status
                  </p>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Try pasting the exact wording from your case status page, or click a popular status above.
                  </p>
                  <a
                    href="https://egov.uscis.gov/casestatus/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--uscis-blue)] text-white text-sm font-medium hover:bg-[var(--uscis-blue-dark)] transition-colors"
                  >
                    Check official case status
                    <ArrowRightIcon className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-6">
          <USCISDisclaimer variant="compact" />
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            ← All Resources
          </Link>
          <Link href="/processing-times" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Processing Times
          </Link>
          <Link href="/fees" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Fee Calculator
          </Link>
          <Link href="/official-links" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Official Links
          </Link>
        </div>
      </main>
    </div>
  );
}
