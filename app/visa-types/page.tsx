"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import {
  AcademicCapIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  HeartIcon,
  GlobeAltIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

const VISA_CATEGORIES = [
  { id: "immigrant", title: "Immigrant visas", desc: "Permanent residency (green card)", icon: HeartIcon, color: "emerald" },
  { id: "family", title: "Family-based", desc: "Spouse, parent, child, sibling", icon: HeartIcon, color: "rose" },
  { id: "employment", title: "Employment-based", desc: "H-1B, L-1, EB-1/2/3", icon: BriefcaseIcon, color: "blue" },
  { id: "student", title: "Student (F-1, M-1)", desc: "Study at U.S. schools", icon: AcademicCapIcon, color: "violet" },
  { id: "business", title: "Business & investment", desc: "B-1, E-2, L-1", icon: BuildingOffice2Icon, color: "orange" },
  { id: "visitor", title: "Visitor (B-1/B-2)", desc: "Tourism, business visits", icon: GlobeAltIcon, color: "sky" },
];

const VISA_DETAILS: Record<string, { title: string; types: string[]; notes: string }[]> = {
  family: [
    { title: "Immediate relative", types: ["IR-1/CR-1 Spouse", "IR-2/CR-2 Child", "IR-5 Parent"], notes: "No annual cap." },
    { title: "Family preference", types: ["F1 Unmarried adult child", "F2A/B Spouse/child", "F3 Married child", "F4 Sibling"], notes: "Subject to visa bulletin." },
  ],
  employment: [
    { title: "Temporary work", types: ["H-1B Specialty occupation", "L-1 Intracompany transfer", "O-1 Extraordinary ability"], notes: "Employer-sponsored." },
    { title: "Permanent (EB)", types: ["EB-1 Priority workers", "EB-2 Advanced degree", "EB-3 Skilled workers"], notes: "Check Visa Bulletin." },
  ],
  student: [
    { title: "Academic", types: ["F-1"], notes: "OPT, STEM extension available." },
    { title: "Vocational", types: ["M-1"], notes: "Trade/non-academic programs." },
  ],
  business: [
    { title: "Visitor", types: ["B-1 Business visitor"], notes: "Meetings, conferences." },
    { title: "Investment", types: ["E-2 Treaty investor"], notes: "Run U.S. business." },
    { title: "Transfer", types: ["L-1"], notes: "Manager/specialist." },
  ],
};

export default function VisaTypesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="relative overflow-hidden bg-[var(--header-dark)]">
        <div className="absolute inset-0 opacity-[0.06]">
          <Image src={HERO_IMAGES.passport ?? HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 flex-shrink-0 flex items-center justify-center bg-white/5">
              <GlobeAltIcon className="w-7 h-7 text-white/90" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">U.S. Visas</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Visa Types Explorer</h1>
              <p className="text-sm text-white/75 mt-1 max-w-xl">
                Immigrant and nonimmigrant visa categories. Find the path that fits you.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {VISA_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.id}
                className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 hover:border-[var(--border-color-hover)] hover:shadow-[var(--shadow-sm)] transition-all"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                  cat.color === "emerald" ? "bg-emerald-500/10" : cat.color === "rose" ? "bg-rose-500/10" : cat.color === "blue" ? "bg-[var(--uscis-blue)]/10" : cat.color === "violet" ? "bg-violet-500/10" : cat.color === "orange" ? "bg-orange-500/10" : "bg-sky-500/10"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    cat.color === "emerald" ? "text-emerald-600" : cat.color === "rose" ? "text-rose-600" : cat.color === "blue" ? "text-[var(--text-primary)]" : cat.color === "violet" ? "text-violet-600" : cat.color === "orange" ? "text-orange-600" : "text-sky-600"
                  }`} />
                </div>
                <h2 className="font-semibold text-[var(--text-primary)]">{cat.title}</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-0.5">{cat.desc}</p>
              </div>
            );
          })}
        </div>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Category details</h2>
          <div className="space-y-6">
            {Object.entries(VISA_DETAILS).map(([key, items]) => (
              <div key={key} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5">
                <h3 className="font-semibold text-[var(--text-primary)] capitalize mb-3">{key}</h3>
                {items.map((item, i) => (
                  <div key={i} className="mb-4 last:mb-0">
                    <p className="text-sm font-medium text-[var(--text-primary)]">{item.title}</p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">{item.types.join(" · ")}</p>
                    {item.notes && <p className="text-xs text-[var(--text-tertiary)] mt-1">{item.notes}</p>}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-xl bg-[var(--uscis-blue)]/5 border border-[var(--uscis-blue)]/20 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="font-semibold text-[var(--text-primary)]">Need the official list?</p>
            <p className="text-sm text-[var(--text-secondary)]">All visa categories with full requirements.</p>
          </div>
          <a
            href="https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/all-visa-categories.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--uscis-blue)] text-white font-medium hover:bg-[var(--uscis-blue-dark)] transition-colors shrink-0"
          >
            Travel.State.Gov visa categories <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">← Resources</Link>
          <Link href="/guides" className="text-sm font-medium text-[var(--text-primary)] hover:underline">Form Guides</Link>
          <Link href="/embassy" className="text-sm font-medium text-[var(--text-primary)] hover:underline">Embassy Finder</Link>
        </div>
      </main>
    </div>
  );
}
