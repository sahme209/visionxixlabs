"use client";

import React from "react";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import Image from "next/image";
import ToolUsageChart from "@/components/charts/ToolUsageChart";
import { HERO_IMAGES, TOOL_CARD_IMAGES } from "@/lib/images";
import GradientIconBadge from "@/components/GradientIconBadge";
import { BriefcaseIcon, DocumentTextIcon, FolderIcon, BellIcon, ClipboardDocumentListIcon, LockClosedIcon } from "@heroicons/react/24/solid";

export default function CaseToolsPage() {
  const { isSubscribed, hasUsedTrial } = useSubscription();
  
  const tools = [
    { title: "RFE/NOID Response", description: "Draft response + exhibit list + cover letter", icon: DocumentTextIcon, badgeColor: "orange" as const, href: "/tools/rfe-response", color: "orange" },
    { title: "Document Pack Organizer", description: "Scan, label, merge + table of contents", icon: FolderIcon, badgeColor: "teal" as const, href: "/tools/document-pack", color: "blue" },
    { title: "Timeline Alerts & Reminders", description: "Smart notifications + calendar sync", icon: BellIcon, badgeColor: "sky" as const, href: "/tools/timeline-alerts", color: "blue" },
    { title: "Evidence Checklist Builder", description: "By form type + progress tracker", icon: ClipboardDocumentListIcon, badgeColor: "violet" as const, href: "/tools/evidence-checklist", color: "indigo" },
  ];

  if (!isSubscribed) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
          <div className="absolute inset-0 w-full">
            <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
            <div className="absolute inset-0 bg-[var(--hero-dark)]/80" />
          </div>
          <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
          <div className="relative max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0">
            <div className="flex items-center gap-3">
              <GradientIconBadge icon={BriefcaseIcon} color="blue" size="xs" />
              <div>
                <h1 className="text-lg sm:text-xl font-semibold text-white">Case Tools</h1>
                <p className="text-sm text-white/90 mt-0.5">RFE responses, document packs, alerts, and checklists</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
            <div className="p-8 sm:p-10 text-center">
              <div className="mx-auto mb-4">
                <GradientIconBadge icon={LockClosedIcon} color="indigo" size="lg" />
              </div>
              <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-[var(--text-primary)] bg-[var(--uscis-blue)]/10 px-2.5 py-1 rounded-md mb-4">Premium</span>
              <div className="flex flex-col items-center gap-2 mb-2">
                <h2 className="text-lg font-bold text-[var(--text-primary)]">Unlock Professional Case Tools</h2>
                {!hasUsedTrial && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold text-[var(--text-primary)] bg-[var(--uscis-blue)]/10">
                    3-Day Free Trial
                  </span>
                )}
              </div>
              <p className="text-sm text-[var(--text-secondary)] mb-6 max-w-sm mx-auto leading-relaxed">
                Subscribe to unlock RFE/NOID Response, Document Pack, Timeline Alerts, and Evidence Checklist.
              </p>
              <Link
                href="/subscribe"
                className="inline-flex flex-col items-center gap-1.5 px-5 py-2.5 bg-[var(--uscis-blue)] text-white text-sm font-semibold rounded-lg hover:bg-[var(--uscis-blue-dark)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span>Subscribe to Unlock</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
                {!hasUsedTrial && (
                  <span className="text-[10px] font-semibold text-white/90 bg-white/25 px-2 py-0.5 rounded">
                    3-Day Free Trial
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const toolColors: Record<string, { bg: string; border: string }> = {
    orange: { bg: "bg-indigo-500/10", border: "#6366F1" },
    blue: { bg: "bg-[var(--uscis-blue)]/10", border: "var(--uscis-blue)" },
    indigo: { bg: "bg-indigo-500/10", border: "#6366F1" },
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/80" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0">
          <div className="flex items-center gap-3">
            <GradientIconBadge icon={BriefcaseIcon} color="blue" size="xs" />
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-white">Case Tools</h1>
              <p className="text-sm text-white/90 mt-0.5">RFE responses, document packs, alerts, and checklists—so you stay on track</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.04]">
            <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="800px" />
          </div>
          <div className="relative px-5 sm:px-6 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50">
            <h2 className="text-base font-semibold text-[var(--text-primary)]">Your tools</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">Pick a tool to get started</p>
          </div>
          <div className="relative p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tools.map((tool, index) => {
                const colors = toolColors[tool.color] || toolColors.blue;
                const cardImage = TOOL_CARD_IMAGES[tool.title];
                return (
                  <Link
                    key={index}
                    href={tool.href}
                    className="group relative flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 hover:border-[var(--uscis-blue)]/30 hover:shadow-md transition-all duration-200 overflow-hidden"
                    style={{ borderLeftWidth: "3px", borderLeftColor: colors.border }}
                  >
                    {cardImage && (
                      <div className="absolute inset-0 opacity-[0.05]">
                        <Image src={cardImage} alt="" fill className="object-cover" sizes="400px" />
                      </div>
                    )}
                    <GradientIconBadge icon={tool.icon} color={tool.badgeColor} size="xs" />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-[var(--text-primary)] mb-1 text-base group-hover:text-[var(--text-primary)] transition-colors">
                        {tool.title}
                      </h3>
                      <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                        {tool.description}
                      </p>
                    </div>
                    <svg className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                );
              })}
            </div>
            <div className="mt-8 pt-6 border-t border-[var(--border-color)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Tool usage</h2>
              <p className="text-xs text-[var(--text-secondary)] mb-4">Track your usage across case tools</p>
              <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-4 sm:p-5">
                <ToolUsageChart />
              </div>
            </div>

            <div className="mt-6">
              <Link href="/" className="text-sm font-medium text-[var(--text-primary)] hover:underline inline-flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

