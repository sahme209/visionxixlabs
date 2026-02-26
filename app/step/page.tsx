"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import {
  ShieldCheckIcon,
  BellAlertIcon,
  MapPinIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  PhoneIcon,
} from "@heroicons/react/24/outline";
import TravelStateEmergencyBanner from "@/components/TravelStateEmergencyBanner";

const BENEFITS = [
  "Receive travel alerts for your destination",
  "Help the U.S. locate you in an emergency abroad",
  "Family can reach you through the State Department",
  "Free service for U.S. citizens",
  "Enroll once per trip or for all future travel",
];

const STEPS = [
  { step: 1, title: "Go to step.state.gov", desc: "Official U.S. Department of State site." },
  { step: 2, title: "Create an account", desc: "Or sign in with existing Login.gov or email." },
  { step: 3, title: "Add your trip", desc: "Destination, dates, and contact info." },
  { step: 4, title: "Receive alerts", desc: "Get emails/SMS if conditions change." },
];

export default function STEPPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <header className="relative overflow-hidden bg-[var(--header-dark)]">
        <div className="absolute inset-0 opacity-[0.06]">
          <Image src={HERO_IMAGES.airplane ?? HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 flex-shrink-0 flex items-center justify-center bg-orange-500/20">
              <ShieldCheckIcon className="w-7 h-7 text-orange-400" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/60 mb-1">Smart Traveler Enrollment</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">STEP Hub</h1>
              <p className="text-sm text-white/75 mt-1 max-w-xl">
                Enroll so the U.S. can reach you abroad. Free for U.S. citizens and nationals.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <TravelStateEmergencyBanner />

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">What is STEP?</h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">
            STEP (Smart Traveler Enrollment Program) is a free service from the U.S. Department of State. When you enroll, you receive travel alerts and advisories for your destination. In an emergency—natural disaster, civil unrest, or personal crisis—the State Department can contact you and help your family reach you.
          </p>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-[var(--uscis-green)]" />
            Benefits
          </h2>
          <ul className="space-y-3">
            {BENEFITS.map((b, i) => (
              <li key={i} className="flex items-start gap-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4">
                <CheckCircleIcon className="w-5 h-5 text-[var(--uscis-green)] flex-shrink-0 mt-0.5" />
                <span className="text-sm text-[var(--text-primary)]">{b}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-12">
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-4">How to enroll</h2>
          <div className="space-y-4">
            {STEPS.map((s) => (
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

        <div className="rounded-xl bg-orange-500/10 border border-orange-500/30 p-6">
          <p className="font-semibold text-[var(--text-primary)] mb-2">Enroll now</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">STEP is free. You must enroll at the official site.</p>
          <a
            href="https://step.state.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
          >
            Go to step.state.gov <ArrowRightIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="mt-8">
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">← Back to Resources</Link>
        </div>
      </main>
    </div>
  );
}
