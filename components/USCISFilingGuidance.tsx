"use client";

import Link from "next/link";
import { DocumentTextIcon, CheckCircleIcon, InformationCircleIcon, ExclamationTriangleIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

interface FilingAddress {
  form: string;
  url: string;
  description?: string;
}

interface FilingTip {
  title: string;
  description: string;
  url?: string;
}

const beforeYouFile = [
  { title: "Filing Fees", description: "Current USCIS filing fees for all forms", href: "/fees", internal: true },
  { title: "Expedite Criteria", description: "Learn about expedite request criteria", href: "/tools/expedite", internal: true },
  { title: "Filing Guidance", description: "Where to file, instructions, and checklists", href: "#where-to-file", internal: true },
];

const afterYouFile = [
  { title: "Change Your Address", description: "Update your address online", url: "https://www.uscis.gov/addresschange" },
  { title: "Check Processing Times", description: "Current processing times by form type", url: "https://egov.uscis.gov/processing-times" },
  { title: "Check Your Case Status", description: "Track your case online", url: "https://egov.uscis.gov/" },
  { title: "Typographic Error", description: "Request correction of typographic errors", url: "https://egov.uscis.gov/e-request/typo" },
  { title: "Non-Delivery of Document", description: "Report non-delivery of documents", url: "https://egov.uscis.gov/e-request/ndd" },
  { title: "Case Taking Longer Than Expected", description: "Submit inquiry if case is delayed", url: "https://egov.uscis.gov/e-request/ccpt" },
];

/**
 * USCIS-style Filing Guidance component
 * Matches official USCIS.gov filing guidance structure
 */
export default function USCISFilingGuidance() {
  const [beforeOpen, setBeforeOpen] = useState(true);
  const [afterOpen, setAfterOpen] = useState(true);

  const directFilingAddresses: FilingAddress[] = [
    { form: "I-130", url: "https://www.uscis.gov/i-130-addresses", description: "Petition for Alien Relative" },
    { form: "I-129F", url: "https://www.uscis.gov/i-129f", description: "Petition for Alien Fiancé(e)" },
    { form: "I-485", url: "https://www.uscis.gov/forms/all-forms/direct-filing-addresses-for-form-i-485-application-to-register-permanent-residence-or-adjust-status", description: "Application to Register Permanent Residence or Adjust Status" },
    { form: "I-765", url: "https://www.uscis.gov/i-765-addresses", description: "Application for Employment Authorization" },
    { form: "I-131", url: "https://www.uscis.gov/i-131", description: "Application for Travel Documents" },
    { form: "I-751", url: "https://www.uscis.gov/i-751-direct-filing-addresses", description: "Petition to Remove Conditions on Residence" },
    { form: "I-140", url: "https://www.uscis.gov/forms/all-forms/direct-filing-addresses-for-form-i-140-immigrant-petition-for-alien-worker", description: "Immigrant Petition for Alien Worker" },
    { form: "I-601", url: "https://www.uscis.gov/i-601-addresses", description: "Application for Waiver of Grounds of Inadmissibility" },
  ];

  const filingTips: FilingTip[] = [
    {
      title: "Read Form Instructions",
      description: "We strongly encourage you to read the instructions for the form you are submitting before you complete and submit the form.",
    },
    {
      title: "Check Form Edition Date",
      description: "Make sure you are using the latest version of the form. Outdated forms may cause delays or rejection.",
    },
    {
      title: "Submit Required Documentation",
      description: "Review the checklist for your form to ensure you submit all required documentation.",
    },
    {
      title: "Photographic Requirements",
      description: "If your form requires photographs, ensure they meet USCIS specifications outlined in the form instructions.",
    },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Consolidated Before / After You File - Mobile-optimized */}
      <section className="uscis-card p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-3 sm:mb-4">Quick Links</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Before You File */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setBeforeOpen(!beforeOpen)}
              className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-[var(--bg-surface-alt)]/50 transition-colors md:cursor-default"
            >
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">Before You File</h3>
              <ChevronDownIcon className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform md:hidden ${beforeOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`${beforeOpen ? "block" : "hidden md:block"} px-3 pb-3 sm:px-4 sm:pb-4`}>
              <div className="space-y-2">
                {beforeYouFile.map((item) =>
                  item.internal ? (
                    <Link
                      key={item.title}
                      href={item.href}
                      className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-lg border border-[var(--border-color)]/60 hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--bg-surface)] transition-all group"
                    >
                      <svg className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">{item.title}</p>
                        <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5">{item.description}</p>
                      </div>
                    </Link>
                  ) : null
                )}
              </div>
            </div>
          </div>

          {/* After You File */}
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setAfterOpen(!afterOpen)}
              className="w-full flex items-center justify-between p-3 sm:p-4 text-left hover:bg-[var(--bg-surface-alt)]/50 transition-colors md:cursor-default"
            >
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)]">After You File</h3>
              <ChevronDownIcon className={`w-5 h-5 text-[var(--text-tertiary)] transition-transform md:hidden ${afterOpen ? "rotate-180" : ""}`} />
            </button>
            <div className={`${afterOpen ? "block" : "hidden md:block"} px-3 pb-3 sm:px-4 sm:pb-4`}>
              <div className="space-y-2">
                {afterYouFile.map((item) => (
                  <a
                    key={item.title}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2.5 p-2.5 sm:p-3 rounded-lg border border-[var(--border-color)]/60 hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--bg-surface)] transition-all group"
                  >
                    <svg className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">{item.title}</p>
                      <p className="text-[11px] sm:text-xs text-[var(--text-secondary)] mt-0.5">{item.description}</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Where to File Section */}
      <section id="where-to-file" className="uscis-card p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <DocumentTextIcon className="w-6 h-6 text-[var(--text-primary)] flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Where to File
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Each form has a webpage with important information about how to complete the form and where to file it. If you do not file your form with the correct office or with the correct fee, you will experience processing delays.
            </p>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-600 p-4 rounded-r mb-4">
              <div className="flex items-start gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-yellow-900 dark:text-yellow-100">
                  <strong>Important:</strong> Please do NOT mail your application or petition to the "HQPDI" address on any form—that address is for submitting comments on the form itself.
                </p>
              </div>
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-3">
              Direct Filing Addresses by Form Type
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {directFilingAddresses.map((item) => (
                <Link
                  key={item.form}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-color)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--bg-surface-alt)] transition-all group"
                >
                  <div className="w-8 h-8 rounded bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--uscis-blue)]/20 transition-colors">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{item.form}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)] transition-colors">
                      Form {item.form}
                    </p>
                    {item.description && (
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {item.description}
                      </p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Instructions and Checklists */}
      <section className="uscis-card p-4 sm:p-6">
        <div className="flex items-start gap-3 mb-4">
          <CheckCircleIcon className="w-6 h-6 text-[var(--text-primary)] flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
              Instructions and Checklists
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              We strongly encourage you to read the instructions for the form you are submitting before you complete and submit the form.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-600 p-4 rounded-r mb-4">
              <div className="flex items-start gap-2">
                <InformationCircleIcon className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-gray-900 dark:text-gray-100">
                  <strong>Note:</strong> In some circumstances, the form webpage will say that requirements for that form have changed, but the form's instructions have not yet been revised. This warning will be shown in the Special Instructions section of the form landing page. Please make sure you follow those special instructions.
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              Many of our form pages have a checklist that will help ensure you submit all of the required documentation with your form. However, these checklists do not replace the official form instructions.
            </p>
          </div>
        </div>
      </section>

      {/* Filing Tips */}
      <section className="uscis-card p-4 sm:p-6">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">
          Filing Tips and Requirements
        </h2>
        <div className="space-y-4">
          {filingTips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
              <div className="w-6 h-6 rounded-full bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-[var(--text-primary)]">{index + 1}</span>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                  {tip.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)]">
                  {tip.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
