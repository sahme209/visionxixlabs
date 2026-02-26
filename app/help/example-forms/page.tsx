"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import {
  DocumentTextIcon,
  ExclamationTriangleIcon,
  ArrowTopRightOnSquareIcon,
  DocumentArrowDownIcon,
} from "@heroicons/react/24/outline";
import { BookOpenIcon } from "@heroicons/react/24/solid";
import { HERO_IMAGES } from "@/lib/images";

interface FormExample {
  name: string;
  description?: string;
  link: string;
  format: "PDF" | "DOC" | "Online";
  revision?: string;
  notes?: string;
  guideId?: string;
}

interface FormCategory {
  title: string;
  description: string;
  forms: FormExample[];
}

const formCategories: FormCategory[] = [
  {
    title: "K-1 Fiancé Visa Forms",
    description: "Forms for K-1 Fiancé(e) visa petitions",
    forms: [
      {
        name: "USCIS Form I-129F",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-129f.pdf",
        format: "PDF",
        revision: "Rev. 04/10/17",
        notes: "Petition for Alien Fiancé(e)",
        guideId: "i129f",
      },
      {
        name: "USCIS Form I-134",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-134.pdf",
        format: "PDF",
        revision: "Rev. 11/30/16",
        notes: "Affidavit of Support",
      },
    ],
  },
  {
    title: "I-130 Spousal Visa Forms",
    description: "Forms for IR-1/CR-1 and K-3 spousal visa petitions",
    forms: [
      {
        name: "USCIS Form I-130",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-130.pdf",
        format: "PDF",
        revision: "Rev. 02/27/17",
        notes: "Petition for Alien Relative",
        guideId: "i130",
      },
      {
        name: "USCIS Form I-130A",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-130a.pdf",
        format: "PDF",
        revision: "Rev. 02/27/17",
        notes: "Supplemental Information for Spouse Beneficiary",
      },
    ],
  },
  {
    title: "Adjustment of Status Forms",
    description: "Forms for Green Card applications (I-485)",
    forms: [
      {
        name: "USCIS Form I-485",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-485.pdf",
        format: "PDF",
        revision: "Rev. 10/15/19",
        notes: "Application to Register Permanent Residence or Adjust Status",
        guideId: "i485",
      },
      {
        name: "USCIS Form I-765",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-765.pdf",
        format: "PDF",
        revision: "Rev. 12/26/19",
        notes: "Application for Employment Authorization",
        guideId: "i765",
      },
      {
        name: "USCIS Form I-131",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-131.pdf",
        format: "PDF",
        revision: "Rev. 04/24/19",
        notes: "Application for Travel Document (Advance Parole)",
        guideId: "i131",
      },
      {
        name: "USCIS Form I-864",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-864.pdf",
        format: "PDF",
        revision: "Rev. 03/22/13",
        notes: "Affidavit of Support Under Section 213A of the INA",
      },
      {
        name: "USCIS Form I-944",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-944.pdf",
        format: "PDF",
        revision: "Rev. 10/15/19",
        notes: "Declaration of Self-Sufficiency (Public Charge)",
      },
    ],
  },
  {
    title: "Removing Conditions (I-751)",
    description: "Forms for removing conditions on residence",
    forms: [
      {
        name: "USCIS Form I-751",
        link: "https://www.uscis.gov/sites/default/files/document/forms/i-751.pdf",
        format: "PDF",
        revision: "Rev. 11/23/16",
        notes: "Petition to Remove Conditions on Residence",
        guideId: "i751",
      },
    ],
  },
  {
    title: "Naturalization (N-400)",
    description: "Forms for U.S. citizenship applications",
    forms: [
      {
        name: "USCIS Form N-400",
        link: "https://www.uscis.gov/sites/default/files/document/forms/n-400.pdf",
        format: "PDF",
        revision: "Rev. 12/23/16",
        notes: "Application for Naturalization",
        guideId: "n400",
      },
    ],
  },
];

function getFormatBadgeColor(format: string): string {
  switch (format) {
    case "PDF":
      return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300";
    case "DOC":
      return "bg-blue-100 dark:bg-blue-900/30 text-gray-800 dark:text-gray-200";
    case "Online":
      return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300";
    default:
      return "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300";
  }
}

export default function ExampleFormsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative z-10 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30">
              <DocumentTextIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1
                className="text-2xl font-bold mb-1 text-white !text-white"
                style={{ color: "white" }}
              >
                Example Immigration Forms
              </h1>
              <p className="text-gray-100 text-sm">
                Completed example forms for reference (DO NOT submit these examples)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Important Disclaimer */}
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-6 h-6 text-[var(--text-primary)] dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Important Disclaimer</h3>
              <ul className="space-y-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                <li>
                  <strong className="text-[var(--text-primary)]">DO NOT edit and submit these example forms to USCIS.</strong> These are reference examples only.
                </li>
                <li>
                  <strong className="text-[var(--text-primary)]">Always check for the latest form version</strong> before submitting. Latest blank forms can be found at{" "}
                  <a
                    href="https://www.uscis.gov/forms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    USCIS.gov/forms
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  These examples are based on personal experiences and are not legal advice. Consult an immigration attorney for legal guidance.
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Official Forms Link */}
        <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center gap-3">
            <DocumentArrowDownIcon className="w-5 h-5 text-[var(--text-primary)]" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Get Official Blank Forms
              </p>
              <p className="text-xs text-[var(--text-secondary)]">
                Download the latest official blank forms from{" "}
                <a
                  href="https://www.uscis.gov/forms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--text-primary)] hover:underline font-semibold"
                >
                  USCIS.gov/forms
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Form Categories */}
        <div className="space-y-8">
          {formCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="uscis-card p-6">
              <div className="mb-6">
                <h2 className="text-base sm:text-lg font-semibold text-[var(--text-primary)] mb-2">
                  {category.title}
                </h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  {category.description}
                </p>
              </div>

              <div className="space-y-3">
                {category.forms.map((form, formIndex) => (
                  <div
                    key={formIndex}
                    className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)] hover:border-[var(--uscis-blue)]/50 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-[var(--text-primary)]">
                          {form.name}
                        </h3>
                        {form.revision && (
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {form.revision}
                          </span>
                        )}
                      </div>
                      {form.notes && (
                        <p className="text-sm text-[var(--text-secondary)]">
                          {form.notes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-shrink-0">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1 rounded-md text-xs font-semibold ${getFormatBadgeColor(
                            form.format
                          )}`}
                        >
                          {form.format}
                        </span>
                        <a
                          href={form.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors shadow-sm hover:shadow-md !text-white hover:!text-white [&_svg]:!text-white"
                          style={{ backgroundColor: "#0071e3", color: "#fff" }}
                          onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#0066cc"; e.currentTarget.style.color = "#fff"; }}
                          onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#0071e3"; e.currentTarget.style.color = "#fff"; }}
                        >
                          <DocumentArrowDownIcon className="w-4 h-4 !text-white" style={{ color: "#fff" }} />
                          <span style={{ color: "#fff" }}>Download</span>
                          <ArrowTopRightOnSquareIcon className="w-3 h-3 !text-white" style={{ color: "#fff" }} />
                        </a>
                      </div>
                      {form.guideId && (
                        <Link
                          href={`/guides/${form.guideId}`}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-alt)] text-[var(--text-primary)] text-xs sm:text-sm font-semibold rounded-lg border border-[var(--border-color)] transition-colors"
                        >
                          <BookOpenIcon className="w-4 h-4" />
                          Open step-by-step guide
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Resources */}
        <div className="mt-8 p-6 bg-[var(--bg-surface)] rounded-xl border border-[var(--border-color)]">
          <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">
            Additional Resources
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[var(--bg-surface-alt)] rounded-lg">
              <h4 className="font-semibold text-[var(--text-primary)] mb-2 text-sm">
                Official USCIS Resources
              </h4>
              <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                <li>
                  <a
                    href="https://www.uscis.gov/forms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    USCIS Forms
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.uscis.gov/forms/filing-fees"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    Filing Fees
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.uscis.gov/forms/forms-information"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--text-primary)] hover:underline inline-flex items-center gap-1"
                  >
                    Form Instructions
                    <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                  </a>
                </li>
              </ul>
            </div>
            <div className="p-4 bg-[var(--bg-surface-alt)] rounded-lg">
              <h4 className="font-semibold text-[var(--text-primary)] mb-2 text-sm">
                Community Resources
              </h4>
              <ul className="space-y-1 text-sm text-[var(--text-secondary)]">
                <li>
                  <Link href="/guides" className="text-[var(--text-primary)] hover:underline">
                    VisaNova Form Guides
                  </Link>
                </li>
                <li>
                  <Link href="/help/documents" className="text-[var(--text-primary)] hover:underline">
                    Documents & Sponsors Guide
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-8">
          <BackToHelpCenterLink className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:underline" />
        </div>
      </main>
    </div>
  );
}
