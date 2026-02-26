"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import { faqLibrary } from "@/lib/data/faq-data";
import { CommunityFAQCategory } from "@/lib/types/help-center";
import { MagnifyingGlassIcon, ChevronRightIcon, CheckBadgeIcon, ExclamationCircleIcon, InformationCircleIcon } from "@heroicons/react/24/outline";
import { CheckBadgeIcon as CheckBadgeIconSolid } from "@heroicons/react/24/solid";
import { HERO_IMAGES, EMPTY_STATE_IMAGES } from "@/lib/images";

export default function FAQPage() {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<CommunityFAQCategory | null>(null);

  const filteredCategories = faqLibrary.categories
    .map((category) => {
      if (searchText) {
        const filteredItems = category.items.filter(
          (item) =>
            item.question.toLowerCase().includes(searchText.toLowerCase()) ||
            item.context?.toLowerCase().includes(searchText.toLowerCase()) ||
            item.tags.join(" ").toLowerCase().includes(searchText.toLowerCase())
        );
        return { ...category, items: filteredItems };
      }
      return category;
    })
    .filter((category) => category.items.length > 0);

  if (selectedCategory) {
    return (
      <CategoryDetailView
        category={selectedCategory}
        library={faqLibrary}
        onBack={() => setSelectedCategory(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white mb-2">Community Scenarios & FAQs</h1>
          <p className="text-sm text-white/90">Real questions with verified answers from USCIS and Department of State</p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search FAQs…"
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
            <div className="relative p-12 text-center">
              <p className="text-sm font-semibold text-[var(--text-secondary)]">No FAQs match your search</p>
              <p className="text-xs text-[var(--text-tertiary)] mt-2">Try a different search term</p>
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
                <h3 className="text-lg font-semibold text-[var(--text-primary)]">
                  {category.title}
                </h3>
                <ChevronRightIcon className="w-5 h-5 text-[var(--text-tertiary)] flex-shrink-0" />
              </div>
              {category.subtitle && (
                <p className="text-sm text-[var(--text-secondary)] mb-3">
                  {category.subtitle}
                </p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--text-primary)]">
                  {category.items.length} questions
                </span>
                {category.items.filter((item) => item.isVerified).length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-[var(--text-primary)]">
                    <CheckBadgeIconSolid className="w-3 h-3" />
                    <span>{category.items.filter((item) => item.isVerified).length} verified</span>
                  </div>
                )}
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

function CategoryDetailView({
  category,
  library,
  onBack,
}: {
  category: CommunityFAQCategory;
  library: typeof faqLibrary;
  onBack: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [selectedForm, setSelectedForm] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [selectedItem, setSelectedItem] = useState<typeof category.items[0] | null>(null);

  const availableForms = Array.from(new Set(category.items.flatMap((item) => item.forms))).sort();
  const availableStages = Array.from(new Set(category.items.map((item) => item.stage))).sort();
  const availableLocations = Array.from(
    new Set(category.items.map((item) => item.locationHint).filter((h): h is string => !!h))
  ).sort();

  let filteredItems = category.items;

  if (searchText) {
    filteredItems = filteredItems.filter(
      (item) =>
        item.question.toLowerCase().includes(searchText.toLowerCase()) ||
        item.context?.toLowerCase().includes(searchText.toLowerCase()) ||
        item.tags.join(" ").toLowerCase().includes(searchText.toLowerCase())
    );
  }

  if (selectedForm) {
    filteredItems = filteredItems.filter((item) => item.forms.includes(selectedForm));
  }

  if (selectedStage) {
    filteredItems = filteredItems.filter((item) => item.stage === selectedStage);
  }

  if (selectedLocation) {
    filteredItems = filteredItems.filter(
      (item) => item.locationHint?.toLowerCase().includes(selectedLocation.toLowerCase())
    );
  }

  if (verifiedOnly) {
    filteredItems = filteredItems.filter((item) => item.isVerified);
  }

  if (selectedItem) {
    return (
      <FAQDetailView item={selectedItem} onBack={() => setSelectedItem(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:underline"
        >
          ← Back to Categories
        </button>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-tertiary)]" />
            <input
              type="text"
              placeholder="Search FAQs…"
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

        {/* Filter Chips */}
        {(availableForms.length > 0 || availableStages.length > 0 || availableLocations.length > 0) && (
          <div className="mb-6 overflow-x-auto">
            <div className="flex gap-3 pb-2">
              <button
                onClick={() => {
                  setSelectedForm(null);
                  setSelectedStage(null);
                  setSelectedLocation(null);
                  setVerifiedOnly(false);
                }}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                  !selectedForm && !selectedStage && !selectedLocation && !verifiedOnly
                    ? "bg-[var(--uscis-blue)] text-white"
                    : "bg-[var(--bg-surface-alt)] text-[var(--text-primary)]"
                }`}
              >
                All
              </button>
              {availableForms.map((form) => (
                <button
                  key={form}
                  onClick={() => setSelectedForm(selectedForm === form ? null : form)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                    selectedForm === form
                      ? "bg-[var(--uscis-blue)] text-white"
                      : "bg-[var(--bg-surface-alt)] text-[var(--text-primary)]"
                  }`}
                >
                  {form}
                </button>
              ))}
              {availableStages.map((stage) => (
                <button
                  key={stage}
                  onClick={() => setSelectedStage(selectedStage === stage ? null : stage)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                    selectedStage === stage
                      ? "bg-[var(--uscis-blue)] text-white"
                      : "bg-[var(--bg-surface-alt)] text-[var(--text-primary)]"
                  }`}
                >
                  {stage}
                </button>
              ))}
              {availableLocations.map((location) => (
                <button
                  key={location}
                  onClick={() => setSelectedLocation(selectedLocation === location ? null : location)}
                  className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                    selectedLocation === location
                      ? "bg-[var(--uscis-blue)] text-white"
                      : "bg-[var(--bg-surface-alt)] text-[var(--text-primary)]"
                  }`}
                >
                  {location}
                </button>
              ))}
              <button
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap ${
                  verifiedOnly
                    ? "bg-[var(--uscis-blue)] text-white"
                    : "bg-[var(--bg-surface-alt)] text-[var(--text-primary)]"
                }`}
              >
                Verified Only
              </button>
            </div>
          </div>
        )}

        {/* FAQ Items List */}
        {filteredItems.length === 0 ? (
          <div className="text-center py-12">
            <MagnifyingGlassIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              No FAQs match your filters
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full uscis-card p-5 text-left hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-2 line-clamp-3">
                      {item.question}
                    </p>
                    {item.context && (
                      <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                        {item.context}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    {item.isVerified ? (
                      <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-surface-alt)] text-[var(--uscis-green)] rounded text-xs font-semibold">
                        <CheckBadgeIconSolid className="w-3 h-3" />
                        Verified
                      </div>
                    ) : (
                      <ExclamationCircleIcon className="w-4 h-4 text-[var(--text-secondary)]" />
                    )}
                    <ChevronRightIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
                  </div>
                </div>
                {item.forms.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {item.forms.slice(0, 3).map((form) => (
                      <span
                        key={form}
                        className="px-2 py-1 bg-[var(--bg-surface-alt)] text-[var(--text-primary)] rounded text-xs font-medium"
                      >
                        {form}
                      </span>
                    ))}
                    {item.forms.length > 3 && (
                      <span className="text-xs text-[var(--text-secondary)]">
                        +{item.forms.length - 3}
                      </span>
                    )}
                  </div>
                )}
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

function FAQDetailView({
  item,
  onBack,
}: {
  item: typeof faqLibrary.categories[0]["items"][0];
  onBack: () => void;
}) {
  const [showCommunityNotes, setShowCommunityNotes] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:underline"
        >
          ← Back to FAQs
        </button>

        {/* Question Title */}
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-6">
          {item.question}
        </h1>

        {/* Context Card */}
        {item.context && (
          <div className="uscis-card p-4 mb-6">
            <div className="flex items-start gap-3">
              <InformationCircleIcon className="w-5 h-5 text-[var(--text-primary)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {item.context}
              </p>
            </div>
          </div>
        )}

        {/* Tags Row */}
        {item.tags.length > 0 && (
          <div className="mb-6 overflow-x-auto">
            <div className="flex gap-2">
              {item.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1.5 bg-[var(--bg-surface-alt)] text-[var(--text-secondary)] rounded-lg text-xs font-medium whitespace-nowrap"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Official Answer Section */}
        {item.officialAnswer && item.isVerified ? (
          <div className="uscis-card p-5 mb-6 border-2 border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-4">
              <CheckBadgeIconSolid className="w-5 h-5 text-green-600 dark:text-green-400" />
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Verified Answer
              </h2>
            </div>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed mb-4">
              {item.officialAnswer}
            </p>
            {item.officialSources.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">Sources:</p>
                <div className="space-y-2">
                  {item.officialSources.map((source) => (
                    <a
                      key={source.id}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-3 bg-[var(--bg-surface-alt)] rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors"
                    >
                      <span className="text-xs">🔗</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)]">
                          {source.title}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">{source.publisher}</p>
                      </div>
                      <span className="text-xs text-[var(--text-tertiary)]">↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="uscis-card p-5 mb-6 border-2 border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <ExclamationCircleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
                  Needs Verification
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  Verification from USCIS/DOS/CBP sources pending.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Community Notes Section */}
        {item.communityNotes.length > 0 && (
          <div className="uscis-card p-5 mb-6">
            <button
              onClick={() => setShowCommunityNotes(!showCommunityNotes)}
              className="w-full flex items-center justify-between"
            >
              <h3 className="text-base font-bold text-[var(--text-primary)]">Community Notes</h3>
              <span className="text-sm text-[var(--text-tertiary)]">{showCommunityNotes ? "−" : "+"}</span>
            </button>
            {showCommunityNotes && (
              <ul className="mt-4 space-y-2">
                {item.communityNotes.map((note, idx) => (
                  <li key={idx} className="text-sm text-[var(--text-secondary)]">
                    • {note}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Disclaimer Footer */}
        <div className="uscis-card p-3 mb-6">
          <div className="flex items-start gap-2">
            <InformationCircleIcon className="w-4 h-4 text-[var(--text-secondary)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Disclaimer</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                Information is general and not legal advice. USCIS/DOS rules change. For complex cases consult an immigration attorney.
              </p>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div>
          <BackToHelpCenterLink className="text-sm font-semibold text-[var(--text-primary)] hover:underline" />
        </div>
      </div>
    </div>
  );
}
