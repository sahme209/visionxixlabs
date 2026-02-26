"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  GlobeAltIcon,
  MapPinIcon,
  DocumentTextIcon,
  AcademicCapIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import { travelStateResources } from "@/lib/data/travelStateLinks";
import TravelStateEmergencyBanner from "@/components/TravelStateEmergencyBanner";
import { HERO_IMAGES, SECTION_IMAGES, EMPTY_STATE_IMAGES, ICON_IMAGES } from "@/lib/images";

const CATEGORIES = [
  { id: "all", label: "All", icon: GlobeAltIcon },
  { id: "visa", label: "Visa & NVC", icon: AcademicCapIcon },
  { id: "uscis", label: "USCIS", icon: BuildingOffice2Icon },
  { id: "embassy", label: "Embassies", icon: MapPinIcon },
  { id: "forms", label: "Forms & Documents", icon: DocumentTextIcon },
  { id: "travel", label: "Travel & Safety", icon: ExclamationTriangleIcon },
  { id: "bulletin", label: "Visa Bulletin", icon: DocumentTextIcon },
] as const;

export default function OfficialLinksPage() {
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = travelStateResources;
    if (category !== "all") {
      list = list.filter((r) => r.category === category);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q)
      );
    }
    return list;
  }, [category, search]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 60%, rgba(34, 197, 94, 0.3) 0%, transparent 40%)",
          }}
        />
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.passport}
            alt=""
            fill
            className="object-cover object-center opacity-20 w-full"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/25 shadow-lg flex-shrink-0 ring-2 ring-white/20">
              <Image src={ICON_IMAGES.globe} alt="" width={48} height={48} className="w-full h-full object-cover" />
            </div>
            <div className="hero-text-white" style={{ color: "#ffffff" }}>
              <h1 className="text-xl sm:text-2xl font-bold !text-white" style={{ color: "#ffffff" }}>
                All Official Links—In One Place
              </h1>
              <p className="text-sm !text-white mt-0.5" style={{ color: "#ffffff" }}>
                USCIS, Travel.State.Gov, CEAC, visa bulletin, embassies, NVC—searchable and organized. No more hunting through government menus.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0">
        <div className="mb-6">
          <TravelStateEmergencyBanner />
        </div>

        {/* Travel.State.Gov style: Popular Links */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Popular Links</p>
          <div className="flex flex-wrap gap-2">
            <a href="https://travel.state.gov/content/travel.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all duration-200">
              <GlobeAltIcon className="w-4 h-4" /> Travel.State.Gov
            </a>
            <a href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all duration-200">
              <ExclamationTriangleIcon className="w-4 h-4" /> Travel Advisories
            </a>
            <a href="https://travel.state.gov/content/travel/en/newsroom.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all duration-200">
              Newsroom
            </a>
            <a href="https://travel.state.gov/content/travel/en/about-us/mytravelgov.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all duration-200">
              MyTravelGov
            </a>
            <a href="https://www.usembassy.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--uscis-blue)]/5 transition-all duration-200">
              <MapPinIcon className="w-4 h-4" /> Find U.S. Embassies
            </a>
          </div>
        </div>

        <div className="mb-6 space-y-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
            <input
              type="search"
              aria-label="Search official links"
              placeholder="Search 30+ official links…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    category === c.id
                      ? "bg-[var(--uscis-blue)] text-white"
                      : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/40"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          {filtered.map((r, idx) => (
            <a
              key={idx}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
            >
              <div className="absolute inset-0 opacity-[0.04]">
                <Image src={SECTION_IMAGES.embassy} alt="" fill className="object-cover" sizes="400px" />
              </div>
              <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 border border-[var(--border-color)]/50">
                <Image src={ICON_IMAGES.embassy} alt="" width={40} height={40} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-secondary)]">
                  {r.title}
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                  {r.description}
                </p>
              </div>
              <ChevronDownIcon className="w-5 h-5 text-[var(--text-tertiary)] rotate-[-90deg] flex-shrink-0" />
            </a>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 relative overflow-hidden rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
            <div className="absolute inset-0 opacity-[0.05]">
              <Image src={EMPTY_STATE_IMAGES.search} alt="" fill className="object-cover" sizes="600px" />
            </div>
            <p className="relative text-[var(--text-secondary)]">No links match your search.</p>
          </div>
        )}

        <div className="mt-8 rounded-xl border border-[var(--uscis-blue)]/20 bg-[var(--uscis-blue)]/5 p-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06]">
            <Image src={SECTION_IMAGES.embassy} alt="" fill className="object-cover rounded-xl" sizes="600px" />
          </div>
          <p className="relative text-sm text-[var(--text-primary)]">
            <strong>Use VisaNova to find it—</strong> search once, get the right link. When you need to file or check officially, we send you straight to USCIS or Travel.State.Gov.
          </p>
        </div>

        <div className="mt-8 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/30 p-4 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.04]">
            <Image src={SECTION_IMAGES.office} alt="" fill className="object-cover rounded-xl" sizes="600px" />
          </div>
          <div className="relative">
          <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">Related tools</p>
          <div className="flex flex-wrap gap-2">
            <Link href="/resources" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/10 transition-colors">
              All Resources
            </Link>
            <Link href="/guides" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/10 transition-colors">
              Form Guides
            </Link>
            <Link href="/processing-times" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/10 transition-colors">
              Processing Times
            </Link>
            <Link href="/embassy" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/10 transition-colors">
              Embassy Finder
            </Link>
            <Link href="/travel-advisories" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--uscis-blue)]/10 transition-colors">
              Travel Advisories
            </Link>
          </div>
          </div>
        </div>
      </main>
    </div>
  );
}
