"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import {
  DocumentTextIcon,
  DocumentDuplicateIcon,
  CheckCircleIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";

const SERVICES = [
  { title: "Replace a U.S. passport", desc: "Lost, stolen, or damaged passport. Apply for a new one.", form: "DS-11 or DS-82" },
  { title: "Replace birth certificate", desc: "Born abroad to U.S. parents. CRBA or Consular Report.", form: "DS-2029" },
  { title: "Replace marriage certificate", desc: "Married abroad. Certified copy from State Dept.", form: "Request via travel.state.gov" },
  { title: "Apostille / authentication", desc: "Certify U.S. documents for use overseas.", form: "Depends on state" },
];

const DOC_TYPES = [
  "Birth certificate",
  "Marriage certificate",
  "Death certificate",
  "Divorce decree",
  "Passport",
];

export default function RecordsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="relative overflow-hidden bg-[var(--header-dark)]">
        <div className="absolute inset-0 opacity-[0.06]">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 flex-shrink-0 flex items-center justify-center bg-white/5">
              <DocumentDuplicateIcon className="w-7 h-7 text-white/90" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">Records & Authentications</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Replace or Certify Documents</h1>
              <p className="text-sm text-white/75 mt-1 max-w-xl">
                Replace life-event documents issued by the U.S. Department of State. Authenticate for use overseas.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">What you can do</h2>
          <div className="space-y-3">
            {SERVICES.map((s) => (
              <div key={s.title} className="flex items-start gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4">
                <CheckCircleIcon className="w-5 h-5 text-[var(--uscis-green)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{s.title}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">{s.desc}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">Form: {s.form}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Common document types</h2>
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.map((d) => (
              <span key={d} className="px-4 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm font-medium text-[var(--text-primary)]">
                {d}
              </span>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-3">Apostille vs authentication</h2>
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-5 space-y-4">
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-sm">Apostille</p>
              <p className="text-sm text-[var(--text-secondary)]">For countries in the Hague Convention. One-step certification.</p>
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)] text-sm">Authentication</p>
              <p className="text-sm text-[var(--text-secondary)]">For non-Hague countries. May need Secretary of State + embassy certification.</p>
            </div>
          </div>
        </section>

        <div className="rounded-xl bg-[var(--uscis-blue)]/5 border border-[var(--uscis-blue)]/20 p-6">
          <p className="font-semibold text-[var(--text-primary)] mb-2">Request or certify documents</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">You must go through the official U.S. Department of State process.</p>
          <a
            href="https://travel.state.gov/content/travel/en/records-and-authentications.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--uscis-blue)] text-white font-medium hover:bg-[var(--uscis-blue-dark)] transition-colors"
          >
            Travel.State.Gov records <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-8">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">← Back to Resources</Link>
        </div>
      </main>
    </div>
  );
}
