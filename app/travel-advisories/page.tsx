"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import {
  ExclamationTriangleIcon,
  GlobeAltIcon,
  ShieldCheckIcon,
  ArrowTopRightOnSquareIcon,
  DocumentDuplicateIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/outline";
import TravelStateEmergencyBanner from "@/components/TravelStateEmergencyBanner";

export default function TravelAdvisoriesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div
          className="absolute inset-0 opacity-15"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, rgba(245, 158, 11, 0.3) 0%, transparent 40%)",
          }}
        />
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.airplane}
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
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shadow-lg">
              <ExclamationTriangleIcon className="w-6 h-6 text-white" />
            </div>
            <div className="hero-text-white" style={{ color: "#ffffff" }}>
              <h1 className="text-xl sm:text-2xl font-bold !text-white" style={{ color: "#ffffff" }}>
                Travel Advisories
              </h1>
              <p className="text-sm !text-white mt-0.5" style={{ color: "#ffffff" }}>
                Country safety before your visa trip. Fast links to official advisories—check before you travel.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0">
        <div className="mb-6">
          <TravelStateEmergencyBanner />
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm p-5 sm:p-6 mb-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">Advisory levels explained</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            The U.S. Department of State assigns each country a level (1–4). Know what they mean before your visa trip.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {[
              { level: 1, label: "Exercise Normal Precautions", color: "emerald" },
              { level: 2, label: "Exercise Increased Caution", color: "orange" },
              { level: 3, label: "Reconsider Travel", color: "orange" },
              { level: 4, label: "Do Not Travel", color: "red" },
            ].map((a) => (
              <div key={a.level} className={`rounded-xl border p-4 ${
                a.color === "emerald" ? "border-emerald-500/30 bg-emerald-500/5" :
                a.color === "orange" ? "border-orange-500/30 bg-orange-500/5" :
                a.color === "orange" ? "border-orange-500/30 bg-orange-500/5" :
                "border-red-500/30 bg-red-500/5"
              }`}>
                <p className="text-lg font-bold text-[var(--text-primary)]">Level {a.level}</p>
                <p className="text-xs text-[var(--text-secondary)] mt-1">{a.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm p-5 sm:p-6 mb-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">Why check travel advisories?</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            If you&apos;re traveling for a visa interview or to join family, check the advisory for your destination. It covers safety, entry requirements, and health info.
          </p>
          <a
            href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--uscis-blue)] text-white font-medium hover:bg-[var(--uscis-blue-dark)] hover:shadow-lg hover:shadow-[var(--uscis-blue)]/25 transition-all duration-200"
          >
            View travel advisories
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="space-y-3">
          <Link
            href="/travel-safety"
            className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <ShieldCheckIcon className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-500 p-2" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)]">Travel Safety Checker (VisaNova)</h3>
              <p className="text-sm text-[var(--text-secondary)]">Personalized safety score based on your visa status, destination, and airports</p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)] rotate-[-90deg]" />
          </Link>
          <a
            href="https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories.html"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <ExclamationTriangleIcon className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-orange-500 p-2" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)]">Travel Advisories by Country</h3>
              <p className="text-sm text-[var(--text-secondary)]">Safety levels, alerts, and entry requirements</p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
          </a>
          <a
            href="https://travel.state.gov/content/travel/en/international-travel.html"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <GlobeAltIcon className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 text-[var(--text-primary)] p-2" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)]">International Travel</h3>
              <p className="text-sm text-[var(--text-secondary)]">Passports, vaccinations, country info</p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
          </a>
          <a
            href="https://step.state.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <ShieldCheckIcon className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-500 p-2" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)]">STEP Enrollment</h3>
              <p className="text-sm text-[var(--text-secondary)]">Smart Traveler Enrollment—alerts and emergency contact</p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
          </a>
          <a
            href="https://travel.state.gov/content/travel/en/records-and-authentications.html"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <DocumentDuplicateIcon className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 text-[var(--text-primary)] p-2" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)]">Replace or Certify Documents</h3>
              <p className="text-sm text-[var(--text-secondary)]">Birth certificates, marriage records, apostille for use overseas</p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
          </a>
          <a
            href="https://travel.state.gov/content/travel/en/about-us/congressional-liaison.html"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <BuildingOffice2Icon className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 text-[var(--text-primary)] p-2" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)]">Congressional Liaison</h3>
              <p className="text-sm text-[var(--text-secondary)]">Congressional inquiries for constituent visa and passport cases</p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
          </a>
          <a
            href="https://travel.state.gov/content/travel/en/International-Parental-Child-Abduction.html"
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
          >
            <ExclamationTriangleIcon className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0 text-orange-500 p-2" />
            <div className="flex-1">
              <h3 className="font-semibold text-[var(--text-primary)]">International Parental Child Abduction</h3>
              <p className="text-sm text-[var(--text-secondary)]">Resources if your child was abducted to or from the U.S.</p>
            </div>
            <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)]" />
          </a>
        </div>

        <p className="mt-8 text-xs text-[var(--text-secondary)]">
          All links go to official U.S. government sites.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/official-links" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            All official links
          </Link>
          <Link href="/embassy" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Embassy Finder
          </Link>
          <Link href="/news" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Immigration News
          </Link>
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Resources
          </Link>
        </div>
      </main>
    </div>
  );
}
