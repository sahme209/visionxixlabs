"use client";

import Link from "next/link";
import Image from "next/image";
import { ClockIcon, DocumentTextIcon, ExclamationTriangleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { SECTION_IMAGES } from "@/lib/images";

/**
 * USCIS-style Related Resources component
 * Matches official USCIS.gov "Before You File" and "After You File" sections
 */
export default function USCISRelatedResources() {
  const beforeYouFile = [
    {
      title: "Filing Fees",
      description: "Current USCIS filing fees for all forms",
      url: "https://www.uscis.gov/forms/filing-fees",
      icon: DocumentTextIcon,
    },
    {
      title: "Expedite Criteria",
      description: "Learn about expedite request criteria",
      url: "https://www.uscis.gov/forms/filing-guidance/expedite-requests",
      icon: ClockIcon,
    },
    {
      title: "Filing Guidance",
      description: "Where to file, instructions, and checklists",
      url: "/filing-guidance",
      icon: DocumentTextIcon,
    },
  ];

  const afterYouFile = [
    {
      title: "Change Your Address",
      description: "Update your address online",
      url: "https://www.uscis.gov/addresschange",
      icon: CheckCircleIcon,
    },
    {
      title: "Check Processing Times",
      description: "Current processing times by form type",
      url: "https://egov.uscis.gov/processing-times",
      icon: ClockIcon,
    },
    {
      title: "Check Your Case Status",
      description: "Track your case online",
      url: "https://egov.uscis.gov/",
      icon: CheckCircleIcon,
    },
    {
      title: "Typographic Error",
      description: "Request correction of typographic errors",
      url: "https://egov.uscis.gov/e-request/typo",
      icon: ExclamationTriangleIcon,
    },
    {
      title: "Non-Delivery of Document",
      description: "Report non-delivery of documents",
      url: "https://egov.uscis.gov/e-request/ndd",
      icon: ExclamationTriangleIcon,
    },
    {
      title: "Case Taking Longer Than Expected",
      description: "Submit inquiry if case is delayed",
      url: "https://egov.uscis.gov/e-request/ccpt",
      icon: ClockIcon,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Before You File */}
      <section className="relative overflow-hidden rounded-xl border border-[var(--border-color)]/60 p-6 bg-[var(--bg-surface)] shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute inset-0 opacity-[0.04]">
          <Image src={SECTION_IMAGES.documents} alt="" fill className="object-cover" sizes="800px" />
        </div>
        <div className="relative">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <DocumentTextIcon className="w-6 h-6 text-[var(--text-primary)]" />
          Before You File
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {beforeYouFile.map((resource) => {
            const Icon = resource.icon;
            return (
              <Link
                key={resource.title}
                href={resource.url}
                target={resource.url.startsWith("http") ? "_blank" : undefined}
                rel={resource.url.startsWith("http") ? "noopener noreferrer" : undefined}
                className="uscis-card p-4 hover:border-[var(--uscis-blue)]/40 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--uscis-blue)]/20 transition-colors">
                    <Icon className="w-5 h-5 text-[var(--text-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 group-hover:text-[var(--text-primary)] transition-colors">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {resource.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        </div>
      </section>

      {/* After You File */}
      <section className="relative overflow-hidden rounded-xl border border-[var(--border-color)]/60 p-6 bg-[var(--bg-surface)] shadow-sm hover:shadow-md transition-shadow">
        <div className="absolute inset-0 opacity-[0.04]">
          <Image src={SECTION_IMAGES.office} alt="" fill className="object-cover" sizes="800px" />
        </div>
        <div className="relative">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <CheckCircleIcon className="w-6 h-6 text-[var(--text-primary)]" />
          After You File
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {afterYouFile.map((resource) => {
            const Icon = resource.icon;
            return (
              <Link
                key={resource.title}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="uscis-card p-4 hover:border-[var(--uscis-blue)]/40 transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--uscis-blue)]/20 transition-colors">
                    <Icon className="w-5 h-5 text-[var(--text-primary)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1 group-hover:text-[var(--text-primary)] transition-colors">
                      {resource.title}
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {resource.description}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        </div>
      </section>
    </div>
  );
}
