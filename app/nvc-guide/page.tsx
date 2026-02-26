"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";

const NVC_STEPS = [
  { step: 1, title: "Petition approved", desc: "USCIS approves your I-130 or I-129F. Case transfers to NVC." },
  { step: 2, title: "Receive welcome letter", desc: "NVC sends a welcome letter with your case and invoice ID." },
  { step: 3, title: "Pay fees", desc: "Pay immigrant visa fee and affidavit of support fee online (CEAC)." },
  { step: 4, title: "Submit DS-260", desc: "Complete the online immigrant visa application." },
  { step: 5, title: "Submit civil documents", desc: "Birth certificate, marriage cert, police cert, passport copy, etc." },
  { step: 6, title: "Affidavit of support", desc: "I-864 from petitioner. Financial evidence." },
  { step: 7, title: "Documentarily qualified", desc: "NVC reviews. When complete, case goes to embassy for interview." },
  { step: 8, title: "Interview letter", desc: "Embassy schedules interview. Attend with originals and medical." },
];

export default function NVCGuidePage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="relative overflow-hidden bg-[var(--header-dark)]">
        <div className="absolute inset-0 opacity-[0.06]">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 flex-shrink-0 flex items-center justify-center bg-white/5">
              <BuildingOffice2Icon className="w-7 h-7 text-white/90" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">Consular Processing</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">NVC Process Guide</h1>
              <p className="text-sm text-white/75 mt-1 max-w-xl">
                After USCIS approves your petition, the National Visa Center handles your case. Step by step.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">What is the NVC?</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            The National Visa Center (NVC) is part of the U.S. Department of State. When your family-based petition (I-130 or I-129F) is approved by USCIS, the case is sent to NVC. NVC collects fees, forms, and documents before sending your case to the U.S. embassy or consulate for the visa interview.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">The process</h2>
          <div className="space-y-3">
            {NVC_STEPS.map((s) => (
              <div key={s.step} className="flex gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4">
                <span className="w-8 h-8 rounded-full bg-[var(--uscis-blue)]/10 flex items-center justify-center text-sm font-bold text-[var(--text-primary)] flex-shrink-0">{s.step}</span>
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{s.title}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Key links</h2>
          <div className="space-y-3">
            <a href="https://ceac.state.gov/CEACStatTracker/Status.aspx" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--uscis-blue)]/40 transition-colors">
              <div className="flex items-center gap-3">
                <DocumentTextIcon className="w-5 h-5 text-[var(--text-primary)]" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">CEAC Case Status</p>
                  <p className="text-xs text-[var(--text-secondary)]">Check your NVC/visa case status</p>
                </div>
              </div>
              <ArrowRightIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
            </a>
            <a href="https://travel.state.gov/content/travel/en/us-visas/immigrate/national-visa-center.html" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--uscis-blue)]/40 transition-colors">
              <div className="flex items-center gap-3">
                <CheckCircleIcon className="w-5 h-5 text-[var(--uscis-green)]" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">NVC Overview</p>
                  <p className="text-xs text-[var(--text-secondary)]">Official NVC information</p>
                </div>
              </div>
              <ArrowRightIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
            </a>
          </div>
        </section>

        <div className="flex flex-wrap gap-4">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">← Resources</Link>
          <Link href="/guides" className="text-sm font-medium text-[var(--text-primary)] hover:underline">Form Guides</Link>
          <Link href="/tools/document-pack" className="text-sm font-medium text-[var(--text-primary)] hover:underline">Document Pack</Link>
        </div>
      </main>
    </div>
  );
}
