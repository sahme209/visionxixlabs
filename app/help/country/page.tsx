"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import { countryGuidanceLibrary, getCountryFlag } from "@/lib/data/country-guidance-data";
import { CountryPack, GuidanceSection, GuidanceItem } from "@/lib/types/help-center";
import { MagnifyingGlassIcon, ChevronRightIcon, ChevronDownIcon, ChevronUpIcon, ExclamationTriangleIcon, LinkIcon } from "@heroicons/react/24/outline";
import { CheckCircleIcon } from "@heroicons/react/24/solid";
import { HERO_IMAGES, EMPTY_STATE_IMAGES } from "@/lib/images";

export default function CountryGuidancePage() {
  const [searchText, setSearchText] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryPack | null>(null);

  const filteredCountries = searchText
    ? countryGuidanceLibrary.filter((country) =>
        country.countryName.toLowerCase().includes(searchText.toLowerCase())
      )
    : countryGuidanceLibrary;

  if (selectedCountry) {
    return (
      <CountryDetailView
        country={selectedCountry}
        onBack={() => setSelectedCountry(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.embassy} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-xl font-semibold text-white mb-2">Country Guidance</h1>
          <p className="text-sm text-white/90">IR1/CR1 consular processing requirements by country</p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search countries..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--text-primary)]"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Country List */}
        {filteredCountries.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden relative">
            <div className="absolute inset-0 opacity-[0.06]">
              <Image src={EMPTY_STATE_IMAGES.search} alt="" fill className="object-cover" sizes="800px" />
            </div>
            <div className="relative py-12 text-center">
              <span className="text-4xl mb-4 block">🌍</span>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">No countries found</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCountries.map((country) => (
              <button
                key={country.id}
                onClick={() => setSelectedCountry(country)}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.98))",
                  borderColor: "rgba(148, 163, 184, 0.4)",
                  boxShadow: "0 10px 25px rgba(15,23,42,0.45)",
                }}
              >
                <div className="text-3xl flex-shrink-0">
                  {getCountryFlag(country.countryName)}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white !text-white mb-1">
                    {country.countryName}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-white/80">
                      {country.visaType}
                    </span>
                    {country.warnings && country.warnings.length > 0 && (
                    <ExclamationTriangleIcon className="w-3 h-3 text-red-500" />
                    )}
                  </div>
                </div>
                <ChevronRightIcon className="w-5 h-5 text-white/70 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Back Link */}
        <div className="mt-8">
          <BackToHelpCenterLink className="text-sm font-semibold text-gray-800 dark:text-gray-200 hover:underline" />
        </div>
      </div>
    </div>
  );
}

function CountryDetailView({
  country,
  onBack,
}: {
  country: CountryPack;
  onBack: () => void;
}) {
  const [searchText, setSearchText] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Expand first section by default
  useState(() => {
    if (country.sections.length > 0) {
      setExpandedSections(new Set([country.sections[0].id]));
    }
  });

  const filteredSections = country.sections
    .map((section) => {
      if (searchText) {
        const filteredItems = section.items.filter(
          (item) =>
            item.text.toLowerCase().includes(searchText.toLowerCase()) ||
            section.title.toLowerCase().includes(searchText.toLowerCase())
        );
        if (filteredItems.length === 0 && !section.title.toLowerCase().includes(searchText.toLowerCase())) {
          return null;
        }
        return { ...section, items: filteredItems };
      }
      return section;
    })
    .filter((s): s is GuidanceSection => s !== null);

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        {/* Back Button */}
        <button
          onClick={onBack}
          className="mb-6 flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200 hover:underline"
        >
          ← Back to Countries
        </button>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            {country.countryName}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            {country.visaType}
          </p>
          {country.warnings && country.warnings.length > 0 && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 mb-4">
              <div className="flex items-start gap-2 mb-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Important</h3>
              </div>
              <ul className="space-y-1 ml-7">
                {country.warnings.map((warning, idx) => (
                  <li key={idx} className="text-sm text-[var(--text-secondary)]">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {country.officialSources.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">
                Official Sources
              </p>
              <div className="flex flex-wrap gap-2">
                {country.officialSources.map((source) => (
                  <a
                    key={source.id}
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-[var(--text-primary)] dark:text-blue-300 rounded-lg text-xs font-medium hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <LinkIcon className="w-3 h-3" />
                    {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search requirements..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-[var(--text-primary)]"
            />
            {searchText && (
              <button
                onClick={() => setSearchText("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-4">
          {filteredSections.map((section) => (
            <CollapsibleSectionCard
              key={section.id}
              section={section}
              isExpanded={expandedSections.has(section.id)}
              onToggle={() => toggleSection(section.id)}
            />
          ))}
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <BackToHelpCenterLink className="text-sm font-semibold text-gray-800 dark:text-gray-200 hover:underline" />
        </div>
      </div>
    </div>
  );
}

function CollapsibleSectionCard({
  section,
  isExpanded,
  onToggle,
}: {
  section: GuidanceSection;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="uscis-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
            {section.title}
          </h3>
          {section.subtitle && (
            <p className="text-xs text-[var(--text-secondary)]">{section.subtitle}</p>
          )}
        </div>
        {isExpanded ? (
          <ChevronUpIcon className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDownIcon className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          {section.items.map((item) => (
            <ChecklistRow key={item.id} item={item} />
          ))}
          {section.notes && section.notes.length > 0 && (
            <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Notes</p>
              <ul className="space-y-1">
                {section.notes.map((note, idx) => (
                  <li key={idx} className="text-xs text-[var(--text-secondary)]">
                    • {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {section.warnings && section.warnings.length > 0 && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <ul className="space-y-1">
                {section.warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs text-[var(--text-secondary)]">
                    • {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChecklistRow({ item }: { item: GuidanceItem }) {
  const getTagColor = (tag: string) => {
    switch (tag) {
      case "required":
      case "official":
        return "bg-blue-100 dark:bg-blue-900/30 text-gray-800 dark:text-gray-200";
      case "optional":
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
      case "community":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300";
      case "needsVerification":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
    }
  };

  const getIcon = (tag: string) => {
    switch (tag) {
      case "required":
      case "official":
        return <CheckCircleIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />;
      case "optional":
        return (
          <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
          </svg>
        );
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
      <div className="mt-0.5">{getIcon(item.tag)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[var(--text-primary)] leading-relaxed">{item.text}</p>
        {item.sourceURL && (
          <a
            href={item.sourceURL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-gray-800 dark:text-gray-200 hover:underline"
          >
            <LinkIcon className="w-3 h-3" />
            Source
          </a>
        )}
      </div>
      <span className={`px-2 py-1 rounded text-xs font-medium ${getTagColor(item.tag)}`}>
        {item.tag.charAt(0).toUpperCase() + item.tag.slice(1).replace(/([A-Z])/g, " $1")}
      </span>
    </div>
  );
}
