"use client";

import React, { useState } from "react";
import type { DocketEntry, RelatedCase, LegalArgument, Exhibit } from "@/lib/data/clinicVRubioCase";

interface DocketSectionProps {
  docketNumber?: string;
  judge?: string;
  docketEntries: DocketEntry[];
  relatedCases: RelatedCase[];
  legalArguments: LegalArgument[];
  affectedCountries: string[];
  caseStatus: string;
  exhibits: Exhibit[];
  nextHearing?: {
    date: string;
    type: string;
    description: string;
  };
}

export default function DocketSection({
  docketNumber,
  judge,
  docketEntries,
  relatedCases,
  legalArguments,
  affectedCountries,
  caseStatus,
  exhibits,
  nextHearing,
}: DocketSectionProps) {
  const [activeTab, setActiveTab] = useState<"docket" | "legal" | "related" | "countries" | "exhibits">("docket");
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  return (
    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="surface-dark relative px-4 sm:px-6 md:px-8 py-4 sm:py-6 bg-gradient-to-br from-[var(--hero-dark)] to-[var(--hero-dark-soft)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 opacity-[0.04] bg-[url('data:image/svg+xml,%3Csvg width=%2760%27 height=%2760%27 viewBox=%270 0 60 60%27 xmlns=%27http://www.w3.org/2000/svg%27%3E%3Cg fill=%27none%27 fill-rule=%27evenodd%27%3E%3Cg fill=%27%23ffffff%27 fill-opacity=%271%27%3E%3Cpath d=%27M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z%27/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')]" />
        <div className="relative">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex-shrink-0">
              <svg className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--icon)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-xl font-bold flex flex-wrap items-center gap-2 mb-2 text-fg">
                <span className="break-words">Case Docket & Legal Details</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/20 border border-white/30 text-xs font-semibold flex-shrink-0 text-fg">
                  {caseStatus}
                </span>
              </h3>
              {docketNumber && (
                <p className="text-xs font-mono mb-1 text-muted">Docket: {docketNumber}</p>
              )}
              {judge && (
                <p className="text-xs mb-2 text-muted">Judge: {judge}</p>
              )}
              {nextHearing && (
                <div className="mt-3 p-3 rounded-lg bg-white/10 border border-white/20">
                  <p className="text-xs font-semibold mb-1 text-fg">Next Hearing</p>
                  <p className="text-sm font-semibold text-fg">{nextHearing.date}</p>
                  <p className="text-xs mt-0.5 text-muted">{nextHearing.type} • {nextHearing.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs - mobile: horizontal scroll with proper spacing, desktop: full row */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]">
        <div
          className="flex flex-nowrap gap-1 sm:gap-0 overflow-x-auto overscroll-x-contain scroll-smooth -webkit-overflow-scrolling-touch px-3 sm:px-0"
          style={{ scrollbarWidth: "thin" }}
        >
          {(["docket", "legal", "related", "countries", "exhibits"] as const).map((tab) => {
            const labels: Record<typeof tab, string> = {
              docket: "Docket",
              legal: "Legal",
              related: "Related",
              countries: `Countries (${affectedCountries.length})`,
              exhibits: `Exhibits (${exhibits.length})`,
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-3 sm:px-5 py-3.5 text-xs sm:text-sm font-semibold border-b-2 transition-colors whitespace-nowrap touch-manipulation min-h-[44px] ${
                  isActive
                    ? "border-[var(--uscis-blue)] text-[var(--text-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
          {/* Spacer for mobile scroll - ensures last tab isn't flush against edge */}
          <div className="flex-shrink-0 w-4 sm:w-0" aria-hidden />
        </div>
      </div>

      {/* Content */}
      <div className="px-5 sm:px-6 md:px-8 py-5 sm:py-6">
        {/* Docket Entries Tab */}
        {activeTab === "docket" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">Court Filings & Documents</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Key documents filed in this case. Click any entry to view details.
              </p>
            </div>
            {docketEntries.length > 0 ? (
              <div className="space-y-3">
                {docketEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] overflow-hidden cursor-pointer hover:border-[var(--uscis-blue)] transition-colors"
                    onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[var(--uscis-blue)]/10 text-xs font-semibold text-[var(--text-primary)] border border-[var(--uscis-blue)]/20">
                              {entry.documentType}
                            </span>
                            <span className="text-xs text-[var(--text-tertiary)] font-mono">{entry.date}</span>
                          </div>
                          <h5 className="text-sm font-bold text-[var(--text-primary)] mb-1">{entry.title}</h5>
                          {expandedEntry === entry.id ? (
                            <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">{entry.description}</p>
                          ) : (
                            <p className="text-xs text-[var(--text-secondary)] line-clamp-2">{entry.description}</p>
                          )}
                          <p className="text-xs text-[var(--text-tertiary)] mt-2">Filed by: {entry.filedBy}</p>
                          {entry.url && (
                            <a
                              href={entry.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--text-primary)] hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              View document
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                        <button className="flex-shrink-0 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
                          <svg
                            className={`w-5 h-5 transition-transform ${expandedEntry === entry.id ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
                No docket entries available yet.
              </div>
            )}
          </div>
        )}

        {/* Legal Arguments Tab */}
        {activeTab === "legal" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">Legal Arguments & Claims</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Key legal theories and arguments presented by plaintiffs challenging the visa freeze policy.
              </p>
            </div>
            {legalArguments.length > 0 ? (
              <div className="space-y-4">
                {legalArguments.map((arg) => (
                  <div
                    key={arg.id}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4"
                  >
                    <h5 className="text-sm font-bold text-[var(--text-primary)] mb-2">{arg.title}</h5>
                    <p className="text-xs text-[var(--text-secondary)] mb-3 leading-relaxed">{arg.description}</p>
                    <div className="rounded-md bg-[var(--bg-surface)] border border-[var(--border-color)] p-3">
                      <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-1">
                        Legal Basis
                      </p>
                      <p className="text-xs text-[var(--text-primary)] font-mono">{arg.legalBasis}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
                No legal arguments available.
              </div>
            )}
          </div>
        )}

        {/* Related Cases Tab */}
        {activeTab === "related" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">Related Litigation</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Other cases challenging similar visa processing policies or involving Secretary Rubio and immigration agencies.
              </p>
            </div>
            {relatedCases.length > 0 ? (
              <div className="space-y-3">
                {relatedCases.map((case_, index) => (
                  <div
                    key={index}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-bold text-[var(--text-primary)] mb-1">{case_.caseName}</h5>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className="text-xs font-mono text-[var(--text-tertiary)]">{case_.docketNumber}</span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-500/10 text-xs font-semibold text-green-700 dark:text-green-400 border border-green-500/20">
                            {case_.status}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-secondary)] mb-2">{case_.court}</p>
                        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{case_.description}</p>
                        <p className="text-xs text-[var(--text-tertiary)] mt-2">Filed: {case_.filedDate}</p>
                      </div>
                    </div>
                    {case_.url && (
                      <a
                        href={case_.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-[var(--text-primary)] hover:underline"
                      >
                        View case details
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
                No related cases found.
              </div>
            )}
          </div>
        )}

        {/* Affected Countries Tab */}
        {activeTab === "countries" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">Affected Countries</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                {affectedCountries.length} countries whose nationals are affected by the visa freeze policy.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {affectedCountries.map((country, index) => (
                <div
                  key={index}
                  className="rounded-md border border-[var(--border-color)] bg-[var(--bg-surface-alt)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] text-center"
                >
                  {country}
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800">
              <p className="text-xs text-indigo-900 dark:text-indigo-200">
                <strong>Note:</strong> This list represents countries affected by the visa freeze policy. The policy applies to immigrant visa applications from nationals of these countries, regardless of where they currently reside.
              </p>
            </div>
          </div>
        )}

        {/* Exhibits Tab */}
        {activeTab === "exhibits" && (
          <div className="space-y-4">
            <div className="mb-4">
              <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">Case Exhibits</h4>
              <p className="text-xs text-[var(--text-secondary)]">
                Documents, declarations, and evidence filed as exhibits in support of the complaint. For official court records, refer to PACER.
              </p>
            </div>
            {exhibits.length > 0 ? (
              <div className="space-y-3">
                {exhibits.map((exhibit) => (
                  <div
                    key={exhibit.id}
                    className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] overflow-hidden hover:border-[var(--uscis-blue)] transition-colors"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-[var(--uscis-blue)]/10 text-xs font-bold text-[var(--text-primary)] border border-[var(--uscis-blue)]/20 font-mono">
                              {exhibit.exhibitNumber}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-purple-500/10 text-xs font-semibold text-purple-700 dark:text-purple-400 border border-purple-500/20">
                              {exhibit.documentType}
                            </span>
                            {exhibit.pages && (
                              <span className="text-xs text-[var(--text-tertiary)]">
                                {exhibit.pages} {exhibit.pages === 1 ? "page" : "pages"}
                              </span>
                            )}
                          </div>
                          <h5 className="text-sm font-bold text-[var(--text-primary)] mb-1">{exhibit.title}</h5>
                          <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">{exhibit.description}</p>
                          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)]">
                            {exhibit.date && <span>Date: {exhibit.date}</span>}
                            <span>Filed by: {exhibit.filedBy}</span>
                          </div>
                          {exhibit.url && (
                            <a
                              href={exhibit.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-[var(--text-primary)] hover:underline"
                            >
                              View exhibit
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-[var(--text-secondary)]">
                No exhibits available yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
