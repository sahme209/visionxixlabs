"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES, SECTION_IMAGES, EMPTY_STATE_IMAGES, ICON_IMAGES } from "@/lib/images";
import { analytics } from "@/lib/analytics";
import { MagnifyingGlassIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

interface HelpSection {
  title: string;
  items: HelpItem[];
}

interface HelpItem {
  title: string;
  description: string;
  iconImage: keyof typeof ICON_IMAGES;
  path?: string;
  color: string;
}

const helpSections: HelpSection[] = [
  {
    title: "Interview Preparation",
    items: [
      {
        title: "Interview Prep Pack",
        description: "Prepare for immigration interviews with practice questions",
        iconImage: "family",
        path: "/help/interview-prep",
        color: "purple",
      },
      {
        title: "Question Review",
        description: "Study common immigration interview questions and approved responses",
        iconImage: "documents",
        path: "/help/question-review",
        color: "indigo",
      },
      {
        title: "Mock Interview",
        description: "Practice interview session simulation",
        iconImage: "family",
        path: "/help/mock-interview",
        color: "blue",
      },
    ],
  },
  {
    title: "Resources",
    items: [
      {
        title: "Vision XIX Labs AI",
        description: "Ask our AI assistant about cases, timelines, expedite options, and more",
        iconImage: "tools",
        path: "/help/ai-assistant",
        color: "blue",
      },
      {
        title: "Documents & Sponsors",
        description: "Learn about required documents and sponsor requirements",
        iconImage: "documents",
        path: "/help/documents",
        color: "green",
      },
      {
        title: "Country Guidance",
        description: "Find guidance specific to your country",
        iconImage: "globe",
        path: "/help/country",
        color: "blue",
      },
      {
        title: "FAQs",
        description: "Browse common questions and community scenarios",
        iconImage: "checklist",
        path: "/help/faq",
        color: "purple",
      },
      {
        title: "Process Timelines & Scenarios",
        description: "Timelines, step-by-step processes, and how processing speed affects your approval date",
        iconImage: "calendar",
        path: "/help/timelines",
        color: "blue",
      },
      {
        title: "Example Forms",
        description: "Reference examples of completed immigration forms (for educational purposes only)",
        iconImage: "forms",
        path: "/help/example-forms",
        color: "orange",
      },
      {
        title: "Tools & Resources Hub",
        description: "Processing times, fees, status decoder, guides, official links—all in one place",
        iconImage: "tools",
        path: "/resources",
        color: "pink",
      },
    ],
  },
];

export default function HelpPage() {
  const [searchText, setSearchText] = useState("");
  const [suggestedAction, setSuggestedAction] = useState<string | null>(null);
  
  useEffect(() => {
    analytics.helpCenterViewed();
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchText(text);
    const lowercased = text.toLowerCase();

    // iOS keyword matching logic - exact match
    // Documents & Sponsors keywords
    if (
      lowercased.includes("i864") ||
      lowercased.includes("i-864") ||
      lowercased.includes("joint sponsor") ||
      lowercased.includes("affidavit") ||
      lowercased.includes("sponsor") ||
      lowercased.includes("documents")
    ) {
      setSuggestedAction("Documents & Sponsors");
    }
    // FAQs keywords (track/stuck/status/refused/ap/passport/221g/delay/mandamus/expedite/vpn/network)
    else if (
      lowercased.includes("track") ||
      lowercased.includes("status") ||
      lowercased.includes("refused") ||
      lowercased.includes("ap") ||
      lowercased.includes("administrative processing") ||
      lowercased.includes("passport") ||
      lowercased.includes("221g") ||
      lowercased.includes("stuck") ||
      lowercased.includes("delay") ||
      lowercased.includes("mandamus") ||
      lowercased.includes("expedite") ||
      lowercased.includes("too long") ||
      lowercased.includes("waiting") ||
      lowercased.includes("vpn") ||
      lowercased.includes("network") ||
      lowercased.includes("can't open") ||
      lowercased.includes("won't load")
    ) {
      setSuggestedAction("FAQs");
    } else {
      setSuggestedAction(null);
    }
  };

  const filteredSections = helpSections.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !searchText ||
        item.title.toLowerCase().includes(searchText.toLowerCase()) ||
        item.description.toLowerCase().includes(searchText.toLowerCase())
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Enhanced Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.documents}
            alt=""
            fill
            className="object-cover object-center opacity-20 w-full"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0, 113, 227, 0.2) 0%, transparent 50%)" }} />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden="true" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/30 flex-shrink-0 ring-2 ring-white/20">
              <Image src={ICON_IMAGES.checklist} alt="" width={40} height={40} className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className="text-base sm:text-lg font-semibold mb-0.5 text-white !text-white"
                style={{ color: "white" }}
              >
                Help Center
              </h1>
              <p className="text-gray-100 text-xs line-clamp-2">
                Find answers without digging through multiple sites—FAQs, documents, timelines, interview prep
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/70" />
            <input
              type="text"
              placeholder="Search help topics..."
              value={searchText}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-white/40"
            />
            {searchText && (
              <button
                onClick={() => {
                  setSearchText("");
                  setSuggestedAction(null);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
          
          {/* Suggested Action */}
          {suggestedAction && (
            <div className="mt-3">
              <Link
                href={suggestedAction === "FAQs" ? "/help/faq" : "/help/documents"}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg hover:bg-white/30 transition-colors text-sm font-medium"
              >
                {suggestedAction === "FAQs" ? "Open FAQs →" : "Open Documents & Sponsors →"}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 space-y-8 w-full min-w-0">
        {filteredSections.length === 0 ? (
          <div className="text-center py-12 relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
            <div className="absolute inset-0 opacity-[0.05]">
              <Image src={EMPTY_STATE_IMAGES.search} alt="" fill className="object-cover" sizes="600px" />
            </div>
            <div className="relative">
            <MagnifyingGlassIcon className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">No resources found</p>
            <p className="text-sm text-[var(--text-secondary)] mt-2">
              Try a different search term
            </p>
            </div>
          </div>
        ) : (
          filteredSections.map((section) => (
            <div key={section.title}>
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">
                {section.title}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.items.map((item) => {
                  const content = (
                    <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-6 hover:shadow-[var(--shadow-md)] hover:border-[var(--uscis-blue)]/30 transition-all duration-200 relative overflow-hidden">
                      <div className="absolute inset-0 opacity-[0.04]">
                        <Image src={SECTION_IMAGES.documents} alt="" fill className="object-cover" sizes="400px" />
                      </div>
                      <div className="relative flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-[var(--border-color)] bg-[var(--bg-surface-alt)]">
                          <Image src={ICON_IMAGES[item.iconImage]} alt="" width={48} height={48} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-1">
                            {item.title}
                          </h3>
                          <p className="text-sm text-[var(--text-secondary)]">
                            {item.description}
                          </p>
                        </div>
                        <div className="text-[var(--text-secondary)]">›</div>
                      </div>
                    </div>
                  );

                  return item.path ? (
                    <Link key={item.title} href={item.path}>
                      {content}
                    </Link>
                  ) : (
                    <div key={item.title}>{content}</div>
                  );
                })}
              </div>
            </div>
          ))
        )}

        {/* Quick links to key tools */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 shadow-[var(--shadow-sm)] relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]">
            <Image src={SECTION_IMAGES.office} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="relative">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Quick links</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/processing-times" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all">
              Processing Times
            </Link>
            <Link href="/status-decoder" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all">
              Status Decoder
            </Link>
            <Link href="/fees" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all">
              Fee Calculator
            </Link>
            <Link href="/official-links" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all">
              Official Links
            </Link>
          </div>
          </div>
        </div>

        {/* Technical Tip */}
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-sm)] p-4 sm:p-5 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]">
            <Image src={SECTION_IMAGES.embassy} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="relative flex items-start gap-3">
            <ExclamationCircleIcon className="w-5 h-5 text-[var(--text-secondary)] mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                Can’t load the official government sites?
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Try a different network or turn off VPN—official sites sometimes block certain connections.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
