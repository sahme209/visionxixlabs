"use client";

import React, { useState } from "react";
import { XMarkIcon, DocumentTextIcon, InformationCircleIcon, ArrowPathIcon } from "@heroicons/react/24/outline";
import { ProcessingTimeEntry, parseProcessingTimes } from "./CurrentProcessingTimesCard";

interface CurrentProcessingTimesDetailViewProps {
  bodyText: string;
  updatedAt: Date | null;
  onClose: () => void;
}

// Form descriptions - explains what each form means
const formDescriptions: Record<string, string> = {
  "I-129F": "Petition for Alien Fiancé(e) - Used to bring a foreign fiancé(e) to the U.S. for marriage",
  "I-130": "Petition for Alien Relative - Family-based immigration petition for spouses, children, parents, or siblings",
  "I-485": "Application to Register Permanent Residence or Adjust Status - Green card application for those already in the U.S.",
  "I-765": "Application for Employment Authorization - Work permit that allows eligible immigrants to work legally in the U.S.",
  "I-131": "Application for Travel Document - Advance Parole document that allows certain immigrants to travel outside the U.S. and return",
  "I-751": "Petition to Remove Conditions on Residence - Required for conditional permanent residents to remove the 2-year condition",
  "N-400": "Application for Naturalization - U.S. citizenship application for eligible permanent residents",
  "K-1": "Fiancé(e) Visa - Non-immigrant visa for foreign fiancé(e) of a U.S. citizen",
  "K-3": "Spouse Visa - Non-immigrant visa for foreign spouse of a U.S. citizen",
};

// Service center descriptions
const serviceCenterDescriptions: Record<string, string> = {
  "California": "California Service Center (CSC) - Processes family-based petitions and other applications from the Western U.S.",
  "Texas": "Texas Service Center (TSC) - Handles a variety of immigration forms from the Southern U.S. region",
  "National Benefits": "National Benefits Center (NBC) - Centralized processing facility handling multiple form types",
  "Vermont": "Vermont Service Center (VSC) - Processes employment-based petitions and other specialized cases",
  "Nebraska": "Nebraska Service Center (NSC) - Handles various immigration petitions and applications",
  "Missouri": "Missouri Service Center - Also known as the National Benefits Center, handles multiple form types",
  "Potomac": "Potomac Service Center (YSC) - Processes employment authorization and travel document applications",
  "Electronic": "Electronic Processing (IOE) - Online-filed applications processed through USCIS electronic systems",
};

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    return "Just now";
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
  }
}

// Using parseProcessingTimes from CurrentProcessingTimesCard

export default function CurrentProcessingTimesDetailView({
  bodyText,
  updatedAt,
  onClose,
}: CurrentProcessingTimesDetailViewProps) {
  const parsedEntries = parseProcessingTimes(bodyText);
  const [expandedForm, setExpandedForm] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="relative w-full max-w-4xl bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-color)] max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)] flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)] flex items-center justify-center">
                <DocumentTextIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Current Processing Times</h2>
                <p className="text-sm text-[var(--text-secondary)]">Real-time processing dates from service centers</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Updated Time Badge */}
            {updatedAt && (
              <div className="mb-6 inline-flex items-center gap-2 rounded-lg bg-blue-500/10 px-3 py-2 border border-blue-500/20">
                <ArrowPathIcon className="w-4 h-4 text-[var(--text-primary)]" />
                <span className="text-xs font-medium text-[var(--text-secondary)]">Last updated</span>
                <span className="text-xs font-semibold text-[var(--text-primary)]">
                  {formatRelativeDate(updatedAt)}
                </span>
              </div>
            )}

            {/* All Entries */}
            <div className="space-y-4">
              {parsedEntries.map((entry, index) => {
                const isExpanded = expandedForm === entry.formName;
                // Extract form code for description lookup
                const formMatch = entry.formName.match(/\(([^)]+)\)/);
                const formCode = formMatch ? formMatch[1] : entry.formName.split(" ")[0];
                const formDescription = formDescriptions[formCode] || "";

                return (
                  <div
                    key={index}
                    className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] overflow-hidden"
                  >
                    {/* Form Header - Clickable */}
                    <button
                      onClick={() => setExpandedForm(isExpanded ? null : entry.formName)}
                      className="w-full p-4 text-left hover:bg-[var(--bg-surface)] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <DocumentTextIcon className="w-5 h-5 text-[var(--text-primary)] flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-[var(--text-primary)] mb-1">{entry.formName}</h3>
                            {formDescription && (
                              <p className="text-xs text-[var(--text-secondary)] line-clamp-2">
                                {formDescription}
                              </p>
                            )}
                          </div>
                        </div>
                        {entry.serviceCenters.length > 0 && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] px-2 py-1 rounded">
                              {entry.serviceCenters.length} center{entry.serviceCenters.length > 1 ? "s" : ""}
                            </span>
                            <svg
                              className={`w-5 h-5 text-[var(--text-secondary)] transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>

                    {/* Service Centers - Expandable */}
                    {isExpanded && entry.serviceCenters.length > 0 && (
                      <div className="border-t border-[var(--border-color)] p-4 space-y-3 bg-[var(--bg-surface)]">
                        {entry.serviceCenters.map((sc, scIndex) => {
                          const scDescription = serviceCenterDescriptions[sc.center] || "";

                          return (
                            <div key={scIndex} className="rounded-lg border border-[var(--border-color)] p-3">
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-semibold text-sm text-[var(--text-primary)]">
                                      {sc.center}
                                    </span>
                                    {scDescription && (
                                      <button
                                        className="group relative"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Toggle info tooltip or show explanation
                                          const tooltip = e.currentTarget.querySelector(".tooltip");
                                          if (tooltip) {
                                            tooltip.classList.toggle("hidden");
                                          }
                                        }}
                                      >
                                        <InformationCircleIcon className="w-4 h-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors" />
                                        <div className="tooltip hidden absolute left-0 top-6 z-10 w-64 p-2 text-xs text-[var(--text-primary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-lg shadow-lg">
                                          {scDescription}
                                        </div>
                                      </button>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-[var(--text-primary)]">{sc.date}</p>
                                </div>
                              </div>
                              {scDescription && (
                                <p className="text-xs text-[var(--text-secondary)] mt-2">{scDescription}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-color)] flex-shrink-0 bg-[var(--bg-surface-alt)]">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Processing times are estimates and may vary based on individual case circumstances.
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-[var(--uscis-blue)] text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
