"use client";

import React from "react";
import Image from "next/image";
import {
  COUNTRY_DIAGRAM_IMAGES,
  DEFAULT_DIAGRAM_IMAGE,
} from "@/lib/images";

type Section = "nvc" | "dq" | "interview";

interface ProcessFlowDiagramProps {
  selectedCountry: string;
  selectedSection: Section;
  onSectionSelect: (section: Section) => void;
}

type Role = "petitioner" | "applicant" | "both";

// Exact 12-step structure from Travel.State.Gov (affidavit-of-support.html)
const STEPS: { num: number; label: string; role: Role; section?: Section }[] = [
  { num: 1, label: "Submit a Petition", role: "petitioner" },
  { num: 2, label: "NVC Processing", role: "both", section: "nvc" },
  { num: 3, label: "Pay Fees", role: "both", section: "nvc" },
  { num: 4, label: "Affidavit of Support", role: "petitioner", section: "nvc" },
  { num: 5, label: "Financial Documents", role: "petitioner", section: "nvc" },
  { num: 6, label: "Online Application", role: "applicant", section: "nvc" },
  { num: 7, label: "Civil Documents", role: "applicant", section: "dq" },
  { num: 8, label: "Scan Documents", role: "both", section: "dq" },
  { num: 9, label: "Submit Documents", role: "both", section: "dq" },
  { num: 10, label: "Interview Preparation", role: "applicant", section: "interview" },
  { num: 11, label: "Applicant Interview", role: "applicant", section: "interview" },
  { num: 12, label: "After the Interview", role: "applicant", section: "interview" },
];

const ROLE_COLORS: Record<Role, string> = {
  petitioner: "bg-[#1e3a5f] text-white",
  applicant: "bg-[#5b9bd5] text-white",
  both: "bg-[#ffc000] text-gray-900",
};

export default function ProcessFlowDiagram({
  selectedCountry,
  selectedSection,
  onSectionSelect,
}: ProcessFlowDiagramProps) {
  const diagramImage =
    (selectedCountry && COUNTRY_DIAGRAM_IMAGES[selectedCountry]) ||
    DEFAULT_DIAGRAM_IMAGE;

  const topRow = STEPS.slice(0, 6);
  const bottomRow = STEPS.slice(6, 12);

  const isStepInSelectedSection = (step: (typeof STEPS)[0]) =>
    step.section === selectedSection;

  const StepBlock = ({
    step,
    isSelected,
    onClick,
  }: {
    step: (typeof STEPS)[0];
    isSelected: boolean;
    onClick?: () => void;
  }) => {
    const roleColor = ROLE_COLORS[step.role];
    const content = (
      <div
        className={`
          flex items-center gap-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded text-xs sm:text-sm font-semibold
          border-2 transition-all min-w-0 whitespace-nowrap
          ${roleColor}
          ${isSelected ? "ring-2 ring-red-500 ring-offset-2 shadow-lg" : ""}
          ${onClick ? "cursor-pointer hover:opacity-90" : ""}
        `}
      >
        <span className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center text-[10px] bg-white/20 font-bold">
          {step.num}
        </span>
        <span className="truncate">{step.label}</span>
      </div>
    );

    const wrapperClass = "flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded";
    if (onClick) {
      return (
        <button type="button" onClick={onClick} className={wrapperClass}>
          {content}
        </button>
      );
    }
    return <div className={wrapperClass}>{content}</div>;
  };

  const Row = ({ steps }: { steps: (typeof STEPS)[0][] }) => (
    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1">
      {steps.map((step, idx) => (
        <React.Fragment key={step.num}>
          <StepBlock
            step={step}
            isSelected={isStepInSelectedSection(step)}
            onClick={step.section ? () => onSectionSelect(step.section!) : undefined}
          />
          {idx < steps.length - 1 && (
            <span className="flex-shrink-0 text-gray-500 text-sm" aria-hidden>→</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden shadow-sm bg-[var(--bg-surface)]">
      {/* Header — matches Travel.State.Gov gradient style */}
      <div className="relative h-24 sm:h-28 overflow-hidden">
        <Image
          src={diagramImage}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, 800px"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-gray-800/90 via-gray-700/60 to-gray-100 dark:to-gray-800" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
          <h2 className="text-sm sm:text-base font-bold text-white uppercase tracking-wider">
            Immigrant Visa Process
          </h2>
          <p className="text-xs sm:text-sm font-medium text-white/95 mt-1">
            {selectedCountry || "General"} — Your step-by-step path
          </p>
        </div>
      </div>

      {/* 12-step diagram — exact layout from Travel.State.Gov */}
      <div className="px-4 sm:px-6 py-4 border-t border-[var(--border-color)]">
        <p className="text-[10px] font-bold text-[var(--text-tertiary)] uppercase tracking-widest mb-3">
          Select a stage
        </p>

        {/* Top row: Steps 1–6 */}
        <div className="mb-3">
          <Row steps={topRow} />
        </div>

        {/* Bottom row: Steps 7–12 */}
        <div className="mb-4">
          <Row steps={bottomRow} />
        </div>

        {/* Legend — Petitioner, Applicant, Both Petitioner and Applicant */}
        <div className="flex flex-wrap gap-4 sm:gap-6 pt-3 border-t border-[var(--border-color)]/60">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#1e3a5f]" aria-hidden />
            <span className="text-xs text-[var(--text-secondary)]">Petitioner</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#5b9bd5]" aria-hidden />
            <span className="text-xs text-[var(--text-secondary)]">Applicant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ffc000]" aria-hidden />
            <span className="text-xs text-[var(--text-secondary)]">Both Petitioner and Applicant</span>
          </div>
        </div>
      </div>
    </div>
  );
}
