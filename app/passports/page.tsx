"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES, ICON_IMAGES } from "@/lib/images";
import {
  DocumentDuplicateIcon,
  BanknotesIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import TravelStateEmergencyBanner from "@/components/TravelStateEmergencyBanner";

const PASSPORT_TYPES = [
  { title: "First-time passport", desc: "Never had a U.S. passport. Apply in person.", form: "DS-11" },
  { title: "Renew by mail", desc: "Had a passport in the last 15 years and it was issued when you were 16+.", form: "DS-82" },
  { title: "Replace lost/stolen", desc: "Report and replace. Visit acceptance facility or agency.", form: "DS-11" },
  { title: "Child under 16", desc: "Both parents typically must appear. Apply in person.", form: "DS-11" },
  { title: "Passport card", desc: "Land/sea travel to Canada, Mexico, Caribbean.", form: "DS-11 or DS-82" },
];

const FEES_2024 = [
  { item: "Adult passport book (first-time)", fee: "$130" },
  { item: "Adult passport renewal (by mail)", fee: "$130" },
  { item: "Child passport (under 16)", fee: "$100" },
  { item: "Passport card (adult)", fee: "$30" },
  { item: "Expedited (add to base fee)", fee: "$60" },
  { item: "1–2 day delivery", fee: "$19.53" },
];

const PROCESSING = [
  { type: "Routine", time: "6–9 weeks" },
  { type: "Expedited", time: "2–3 weeks" },
  { type: "Urgent (agency)", time: "8 business days" },
];

export default function PassportsPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="relative overflow-hidden bg-[var(--header-dark)]">
        <div className="absolute inset-0 opacity-[0.06]">
          <Image src={HERO_IMAGES.passport ?? HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 flex-shrink-0 flex items-center justify-center bg-white/5">
              <DocumentDuplicateIcon className="w-7 h-7 text-white/90" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">U.S. Passports</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">Passport Hub</h1>
              <p className="text-sm text-white/75 mt-1 max-w-xl">
                Get or renew a U.S. passport. Forms, fees, processing times—all in one place.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <TravelStateEmergencyBanner />

        {/* Passport types */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">What type of passport?</h2>
          <div className="space-y-3">
            {PASSPORT_TYPES.map((p) => (
              <div
                key={p.title}
                className="flex items-start gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--border-color-hover)] transition-colors"
              >
                <CheckCircleIcon className="w-5 h-5 text-[var(--uscis-green)] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-[var(--text-primary)]">{p.title}</p>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">{p.desc}</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-2">Form: {p.form}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Fees */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <BanknotesIcon className="w-5 h-5 text-[var(--text-primary)]" />
            Fees (approximate)
          </h2>
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] overflow-hidden">
            <div className="divide-y divide-[var(--border-color)]">
              {FEES_2024.map((row) => (
                <div key={row.item} className="flex justify-between items-center px-4 py-3">
                  <span className="text-sm text-[var(--text-primary)]">{row.item}</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{row.fee}</span>
                </div>
              ))}
            </div>
            <p className="px-4 py-3 text-xs text-[var(--text-tertiary)] border-t border-[var(--border-color)]">
              Fees change. Confirm at travel.state.gov before paying.
            </p>
          </div>
        </section>

        {/* Processing times */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-[var(--text-primary)]" />
            Processing times
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {PROCESSING.map((p) => (
              <div key={p.type} className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{p.type}</p>
                <p className="text-lg font-bold text-[var(--text-primary)] mt-1">{p.time}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How to apply</h2>
          <div className="space-y-4">
            {[
              { step: 1, title: "Fill out the form", desc: "DS-11 (in person) or DS-82 (renew by mail). Download from travel.state.gov." },
              { step: 2, title: "Get your photo", desc: "Passport photo requirements: 2x2 inches, plain white/off-white background." },
              { step: 3, title: "Gather documents", desc: "Proof of citizenship (birth cert, naturalization cert), ID, and fee payment." },
              { step: 4, title: "Submit", desc: "In person at acceptance facility or passport agency. Or mail for renewals." },
            ].map((s) => (
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

        {/* File at official site */}
        <div className="rounded-xl bg-[var(--uscis-blue)]/5 border border-[var(--uscis-blue)]/20 p-6">
          <p className="font-semibold text-[var(--text-primary)] mb-2">Ready to apply?</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">You must file at the official U.S. Department of State site.</p>
          <a
            href="https://travel.state.gov/content/travel/en/passports.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--uscis-blue)] text-white font-medium hover:bg-[var(--uscis-blue-dark)] transition-colors"
          >
            Go to travel.state.gov/passports <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-8">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">← Back to Resources</Link>
        </div>
      </main>
    </div>
  );
}
