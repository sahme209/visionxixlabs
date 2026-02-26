"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import { documentTopics, documentTopicData, getTopicIcon } from "@/lib/data/documents-sponsors-data";
import { DocumentTopic } from "@/lib/types/help-center";
import { ChevronLeftIcon, DocumentTextIcon, UserGroupIcon, MagnifyingGlassIcon, ArrowUpCircleIcon } from "@heroicons/react/24/outline";
import { HERO_IMAGES, SECTION_IMAGES } from "@/lib/images";

export default function DocumentsSponsorsPage() {
  const [selectedTopic, setSelectedTopic] = useState<DocumentTopic | null>(null);

  if (selectedTopic) {
    const data = documentTopicData[selectedTopic];
    const IconComponent = getIconComponent(selectedTopic);

    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        {/* Hero for topic detail */}
        <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
          <div className="absolute inset-0 w-full">
            <Image src={HERO_IMAGES.handsDocuments} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
            <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
          </div>
          <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
          <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
            <h1 className="text-xl font-bold text-white">{data.definitionTitle}</h1>
            <p className="text-sm text-white/90 mt-1">Required documents and where to submit</p>
          </div>
        </div>
        <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
          {/* Back Button */}
          <button
            onClick={() => setSelectedTopic(null)}
            className="mb-6 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:underline"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Back to Topics
          </button>

          {/* Definition Card */}
          <div className="uscis-card p-5 mb-6 relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05]">
              <Image src={SECTION_IMAGES.documents} alt="" fill className="object-cover" sizes="600px" />
            </div>
            <div className="relative flex items-start gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center flex-shrink-0">
                <IconComponent className="w-6 h-6 text-[var(--text-primary)]" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">
                  {data.definitionTitle}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {data.definitionMessage}
                </p>
              </div>
            </div>
          </div>

          {/* Checklist Card */}
          <div className="uscis-card p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[var(--text-primary)] text-sm">✓</span>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">
                Required Documents:
              </h3>
            </div>
            <ul className="space-y-3">
              {data.checklistItems.map((item, index) => (
                <li key={index} className="flex items-start gap-3">
                  <CheckCircleIcon className="w-5 h-5 text-[var(--text-primary)] mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Upload Hint */}
          <div className="uscis-card p-4">
            <div className="flex items-start gap-2 mb-2">
              <ArrowUpCircleIcon className="w-5 h-5 text-[var(--text-primary)] mt-0.5 flex-shrink-0" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                Where to submit:
              </h4>
            </div>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed ml-7">
              {data.uploadHint}
            </p>
          </div>

          {/* Back Link */}
          <div className="mt-8">
            <BackToHelpCenterLink className="text-sm font-semibold text-[var(--text-primary)] hover:underline" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.handsDocuments} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white mb-2">Documents & Sponsors</h1>
          <p className="text-sm text-white/90">Select a topic for detailed guidance</p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">

        {/* Topic List */}
        <div className="space-y-4">
          {documentTopics.map((topic) => {
            const IconComponent = getIconComponent(topic);
            return (
              <button
                key={topic}
                onClick={() => setSelectedTopic(topic)}
                className="w-full flex items-center gap-4 p-4 bg-[var(--bg-surface)] rounded-2xl border-[var(--border-color)] hover:shadow-lg transition-all text-left"
              >
                <div className="w-11 h-11 rounded-xl bg-[var(--bg-surface-alt)] flex items-center justify-center flex-shrink-0">
                  <IconComponent className="w-6 h-6 text-[var(--text-primary)]" />
                </div>
                <span className="flex-1 text-base font-medium text-[var(--text-primary)]">
                  {topic}
                </span>
                <ChevronRightIcon className="w-5 h-5 text-[var(--text-tertiary)]" />
              </button>
            );
          })}
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <BackToHelpCenterLink className="text-sm font-semibold text-[var(--text-primary)] hover:underline" />
        </div>
      </div>
    </div>
  );
}

function getIconComponent(topic: DocumentTopic) {
  switch (topic) {
    case "221(g) / Missing docs":
      return MagnifyingGlassIcon;
    case "I-864 Affidavit of Support":
      return DocumentTextIcon;
    case "Joint Sponsor":
      return UserGroupIcon;
    default:
      return DocumentTextIcon;
  }
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 20 20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
