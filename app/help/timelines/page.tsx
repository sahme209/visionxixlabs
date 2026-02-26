"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import {
  processTimelineCategories,
  getCategoryTimeline,
  getCategoryProcessSteps,
  getCategoryImportantNotes,
} from "@/lib/data/process-timeline-data";
import { ProcessTimelineCategory, TimelinePhase } from "@/lib/types/help-center";
import { MagnifyingGlassIcon, ClockIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { HERO_IMAGES, EMPTY_STATE_IMAGES } from "@/lib/images";

export default function ProcessTimelinesPage() {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ProcessTimelineCategory | null>(null);

  const filteredCategories = searchText
    ? processTimelineCategories.filter(
        (category) =>
          category.title.toLowerCase().includes(searchText.toLowerCase()) ||
          category.description.toLowerCase().includes(searchText.toLowerCase())
      )
    : processTimelineCategories;

  if (selectedCategory) {
    return (
      <CategoryTimelineDetailView
        category={selectedCategory}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.calendar} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white mb-2">Process Timelines</h1>
          <p className="text-sm text-white/90">Comprehensive timelines and step-by-step processes for each visa type</p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search timelines..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-[var(--bg-surface)] border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] text-[var(--text-primary)]"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categories Grid */}
        {filteredCategories.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden relative">
            <div className="absolute inset-0 opacity-[0.06]">
              <Image src={EMPTY_STATE_IMAGES.search} alt="" fill className="object-cover" sizes="800px" />
            </div>
            <div className="relative py-12 text-center">
              <MagnifyingGlassIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
              <p className="text-sm font-semibold text-[var(--text-secondary)]">No timelines found</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCategories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category)}
                className="uscis-card p-5 text-left hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                      {category.title}
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)] mb-3">
                      {category.description}
                    </p>
                  </div>
                  <ChevronRightIcon className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
                </div>
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                  <span className="text-xs font-medium text-[var(--text-secondary)]">
                    {category.estimatedTime}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8">
          <BackToHelpCenterLink className="text-sm font-semibold text-[var(--text-primary)] hover:underline" />
        </div>
      </div>
    </div>
  );
}

function CategoryTimelineDetailView({
  category,
  onBack,
}: {
  category: ProcessTimelineCategory;
  onBack: () => void;
}) {
  const timeline = getCategoryTimeline(category.id);
  const processSteps = getCategoryProcessSteps(category.id);
  const importantNotes = getCategoryImportantNotes(category.id);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:underline"
        >
          ← Back to Timelines
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {category.title}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {category.description}
          </p>
          <div className="flex items-center gap-2">
            <ClockIcon className="w-4 h-4 text-[var(--text-secondary)]" />
            <span className="text-sm font-medium text-[var(--text-secondary)]">
              Estimated Time: {category.estimatedTime}
            </span>
          </div>
        </div>

        {/* Timeline Phases */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
            Timeline Phases
          </h2>
          <div className="space-y-4">
            {timeline.map((phase, index) => (
              <TimelinePhaseCard key={index} phase={phase} index={index} total={timeline.length} />
            ))}
          </div>
        </div>

        {/* Process Steps */}
        {processSteps.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Step-by-Step Process
            </h2>
            <div className="uscis-card p-5">
              <ol className="space-y-3">
                {processSteps.map((step, index) => (
                  <li key={index} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[var(--uscis-blue)] text-white flex items-center justify-center text-sm font-semibold">
                      {index + 1}
                    </div>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed pt-1">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}

        {/* Important Notes */}
        {importantNotes.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
              Important Notes
            </h2>
            <div className="uscis-card p-5 bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
              <ul className="space-y-2">
                {importantNotes.map((note, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <span className="text-[var(--text-primary)] mt-1">•</span>
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed">{note}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Back Link */}
        <div>
          <BackToHelpCenterLink className="text-sm font-semibold text-[var(--text-primary)] hover:underline" />
        </div>
      </div>
    </div>
  );
}

function TimelinePhaseCard({
  phase,
  index,
  total,
}: {
  phase: TimelinePhase;
  index: number;
  total: number;
}) {
  return (
    <div className="flex gap-4">
      {/* Timeline Line */}
      <div className="flex flex-col items-center">
        <div className="w-4 h-4 rounded-full bg-[var(--uscis-blue)] border-2 border-[var(--bg-surface)] shadow-lg" />
        {index < total - 1 && (
          <div className="w-0.5 h-full bg-[var(--border-color)] mt-2" style={{ minHeight: "60px" }} />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 pb-6">
        <div className="uscis-card p-4">
          <div className="flex items-start justify-between mb-2">
            <h3 className="text-base font-semibold text-[var(--text-primary)]">
              {phase.title}
            </h3>
            <span className="px-3 py-1 bg-[var(--bg-surface-alt)] text-[var(--text-primary)] rounded-lg text-xs font-medium">
              {phase.duration}
            </span>
          </div>
          {phase.description && (
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              {phase.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
