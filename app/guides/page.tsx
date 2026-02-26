"use client";

import React from "react";
import { useState, useEffect } from "react";
import { guides } from "@/lib/guides-data";
import { FormGuide } from "@/lib/types";
import Link from "next/link";
import Image from "next/image";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { analytics } from "@/lib/analytics";
import { HERO_IMAGES, SECTION_IMAGES, EMPTY_STATE_IMAGES, ICON_IMAGES } from "@/lib/images";
import USCISFormCategoryBadge, { getFormCategory, FormCategory } from "@/components/USCISFormCategoryBadge";
import FormIcon from "@/components/FormIcon";
import USCISAlertBanner from "@/components/USCISAlertBanner";
import USCISFeedbackWidget from "@/components/USCISFeedbackWidget";
import USCISOfficialNotice from "@/components/USCISOfficialNotice";

function cleanTitle(title: string): string {
  return title
    .replace(/📝\s*|💍\s*|🟢\s*|💑\s*|💼\s*|✈️\s*|🏢\s*|💚\s*|🆔\s*|🇺🇸\s*|📋\s*|🛡️\s*|🔐\s*|🎓\s*/g, "")
    .trim();
}

/** Extract official form number (e.g. I-130, I-485) for badge display */
function formNumber(guide: FormGuide): string {
  const m = guide.title.match(/\b(I|N|K)[-\s]?\d+[A-Za-z]?\b/);
  return m ? m[0].replace(/\s/g, "-") : guide.id.toUpperCase();
}

// Removed unused function

export default function GuidesPage() {
  const [searchText, setSearchText] = useState("");
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<FormCategory | "All">("All");

  useEffect(() => {
    analytics.guidesPageViewed();
    
    // Load completed steps from localStorage
    const stored = localStorage.getItem("completedSteps");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCompletedSteps(new Set(parsed));
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const categories: FormCategory[] = [
    "Family-Based",
    "Employment-Based",
    "Citizenship and Naturalization",
    "Green Card-Based",
    "Humanitarian Benefits",
    "Adoptions",
  ];

  const filteredGuides = guides.filter((guide) => {
    const query = searchText.toLowerCase().trim();
    const category = getFormCategory(guide.id);
    
    // Category filter
    if (selectedCategory !== "All" && category !== selectedCategory) {
      return false;
    }
    
    // Search filter
    if (query) {
      return (
        cleanTitle(guide.title).toLowerCase().includes(query) ||
        guide.overview?.toLowerCase().includes(query) ||
        guide.steps.some(
          (step) =>
            step.title.toLowerCase().includes(query) ||
            step.description.toLowerCase().includes(query)
        )
      );
    }
    
    return true;
  });

  const completedCount = (guide: FormGuide) => {
    return guide.steps.filter((step) => completedSteps.has(step.id)).length;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] gov-page-bg">
      {/* Government-style Page Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)] shadow-md">
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
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden="true" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/25 flex-shrink-0 ring-2 ring-white/30">
              <Image src={ICON_IMAGES.documents} alt="" width={36} height={36} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1 antialiased">
              <h1 className="text-base sm:text-lg font-semibold" style={{ color: "#ffffff" }}>Form Guides</h1>
              <p className="text-xs leading-snug" style={{ color: "#ffffff" }}>
                Step-by-step form guides. Pick one, check off as you go.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/20 border border-white/25 text-xs font-medium antialiased" style={{ color: "#ffffff" }}>
              Based on official government forms
            </span>
          </div>

          {/* Search - Compact */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white" />
            <input
              type="text"
              placeholder="Search forms..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-9 pr-9 py-3 min-h-[44px] rounded-lg bg-white/15 border border-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 text-sm sm:text-xs touch-manipulation text-white placeholder:text-white antialiased"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 -mr-2 flex items-center justify-center text-white hover:text-white/90 transition-colors touch-manipulation"
                aria-label="Clear search"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Guides List */}
      <main className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full min-w-0">
        {/* USCIS Alert Banner */}
        <USCISAlertBanner
          type="info"
          title="Official Forms"
          message="These guides are based on official government form instructions. Always verify the latest requirements on the official forms site before filing."
          linkText="View all forms"
          linkHref="https://www.uscis.gov/forms/all-forms"
        />

        {/* Category Filter - compact */}
        <div className="mb-4">
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider mb-2">Filter by category</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCategory("All")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                selectedCategory === "All"
                  ? "bg-[var(--uscis-blue)] text-white"
                  : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/40"
              }`}
            >
              All Forms
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                  selectedCategory === cat
                    ? "bg-[var(--uscis-blue)] text-white"
                    : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/40"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {filteredGuides.length === 0 ? (
          <div className="text-center py-10 relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
            <div className="absolute inset-0 opacity-[0.05]">
              <Image src={EMPTY_STATE_IMAGES.guides} alt="" fill className="object-cover" sizes="600px" />
            </div>
            <div className="relative">
            <MagnifyingGlassIcon className="w-10 h-10 text-gray-400 dark:text-[var(--text-tertiary)] mx-auto mb-3" />
            <p className="text-sm text-gray-700 dark:text-[var(--text-secondary)]">No guides found</p>
            <p className="text-xs text-gray-600 dark:text-[var(--text-secondary)] mt-1">Try a different search term</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 py-2 px-3 rounded-lg bg-[var(--bg-surface-alt)]/60 border border-[var(--border-color)]">
              <span className="text-[var(--text-primary)] text-xs font-semibold shrink-0">Quick tip</span>
              <span className="text-[11px] text-[var(--text-secondary)]">Pick the form that matches your situation (e.g. I-130 for spouse, I-129F for fiancé). Open it and follow steps 1, 2, 3… in order.</span>
            </div>
            <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Form guides</p>
            {filteredGuides.map((guide) => {
              const completed = completedCount(guide);
              const total = guide.steps.length;
              const progress = total > 0 ? (completed / total) * 100 : 0;
              const formNum = formNumber(guide);

              return (
                <Link
                  key={guide.id}
                  href={`/guides/${guide.id}`}
                  className="block bg-[var(--bg-surface)] rounded-xl p-4 sm:p-4 border border-[var(--border-color)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group relative overflow-hidden"
                >
                  <div className="absolute inset-0 opacity-[0.03]">
                    <Image src={SECTION_IMAGES.documents} alt="" fill className="object-cover" sizes="400px" />
                  </div>
                  <div className="relative flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/25 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform text-[var(--text-primary)]">
                      <FormIcon formId={guide.id} size={28} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--uscis-blue)]/15 text-[var(--text-primary)] border border-[var(--uscis-blue)]/25">
                              {formNum}
                            </span>
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors leading-tight">
                              {cleanTitle(guide.title)}
                            </h3>
                          </div>
                          {guide.overview && (
                            <p className="text-xs text-gray-700 dark:text-[var(--text-secondary)] leading-snug mb-2 line-clamp-2">
                              {guide.overview}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mb-2">
                            {guide.estimatedTime && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/20 text-[var(--text-primary)]">
                                {guide.estimatedTime}
                              </span>
                            )}
                            {guide.difficulty && (
                              <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                                {guide.difficulty}
                              </span>
                            )}
                            <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-surface-alt)] border border-[var(--border-color)] text-[var(--text-secondary)]">
                              {total} step{total === 1 ? "" : "s"}
                            </span>
                            <USCISFormCategoryBadge category={getFormCategory(guide.id)} />
                          </div>
                        </div>
                        {completed === total && total > 0 && (
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center border-2 border-green-500 dark:border-green-400">
                            <span className="text-sm text-green-600 dark:text-green-400 font-bold">✓</span>
                          </div>
                        )}
                        <ChevronRightIcon className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] shrink-0 mt-0.5" />
                      </div>
                      <div className="space-y-1.5 mt-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600 dark:text-[var(--text-secondary)] font-medium">
                            {completed > 0 ? (
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                {completed}/{total} done
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Ready • Click to start
                              </span>
                            )}
                          </span>
                          {progress > 0 && (
                            <span className="font-semibold text-gray-800 dark:text-gray-200 text-[11px]">
                              {Math.round(progress)}%
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-[var(--bg-surface-alt)] rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] h-2 rounded-full transition-all duration-500"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* What Are Guides + Tools — moved below guides for faster access to forms */}
        <div className="mt-8 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden relative">
          <details className="group">
            <summary className="list-none cursor-pointer p-4 sm:p-5 border-b border-[var(--border-color)] hover:bg-[var(--bg-surface-alt)]/30 transition-colors" style={{ borderLeft: "4px solid var(--uscis-blue)" }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                  <Image src={ICON_IMAGES.documents} alt="" width={36} height={36} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">What are these guides? + Tools</h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Step-by-step form guides. Check off steps, tips, official links—plus tools like Filing Guidance, Fee Calculator.</p>
                </div>
                <ChevronRightIcon className="w-4 h-4 text-[var(--text-tertiary)] shrink-0 ml-auto group-open:rotate-90 transition-transform" />
              </div>
            </summary>
            <div className="p-4 sm:p-5 bg-[var(--bg-surface-alt)]/30">
              <p className="text-xs text-[var(--text-secondary)] mb-4">Pick a form above, follow steps in order, check them off. Use search or Ctrl+F to find a form quickly.</p>
              <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Tools that go with these guides</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Link href="/filing-guidance" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.documents} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Filing Guidance</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Where to file, checklists, tips</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/help/example-forms" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.forms} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Example Forms</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Reference examples (educational)</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/tools/case-tools" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.tools} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Case Tools</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">RFE, document pack, checklist</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/tools/expedite" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.hands} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Expedite Request</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Faster processing + reps</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/tools/action-plan" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.checklist} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Action Plan</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">NVC, DQ, interview by country</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/processing-times" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.calendar} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Processing Times</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Dates by form and center</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/fees" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.documents} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Fee Calculator</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Estimate filing fees</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/status-decoder" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.chart} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">Status Decoder</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Understand case status</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
                <Link href="/resources" className="flex items-center gap-2.5 p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-[var(--uscis-blue)]/40 hover:shadow-md transition-all duration-200 group">
                  <div className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-[var(--border-color)]/50">
                    <Image src={ICON_IMAGES.tools} alt="" width={36} height={36} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">All Resources</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Browse all tools</p>
                  </div>
                  <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)] shrink-0" />
                </Link>
              </div>
            </div>
          </details>
        </div>

        {/* FBI Privacy Notice */}
        <div className="mt-8">
          <USCISOfficialNotice type="fbi-privacy" />
        </div>

        {/* Form Warning */}
        <div className="mt-6">
          <USCISOfficialNotice type="form-warning" />
        </div>

        {/* Feedback Widget */}
        <div className="mt-8">
          <USCISFeedbackWidget />
        </div>
      </main>
    </div>
  );
}
