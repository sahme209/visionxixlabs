"use client";

import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import {
  MapPinIcon,
  GlobeAltIcon,
  PhoneIcon,
  DocumentTextIcon,
  ArrowTopRightOnSquareIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/outline";

const embassyResources = [
  {
    title: "Find U.S. Embassies & Consulates",
    description: "Search by country—addresses, phone numbers, and services",
    href: "https://www.usembassy.gov/",
    icon: MapPinIcon,
  },
  {
    title: "Embassy & Consulate Finder",
    description: "Official locator from the Department of State",
    href: "https://travel.state.gov/content/travel/en/consular.html",
    icon: GlobeAltIcon,
  },
  {
    title: "Visa Wait Times by Embassy",
    description: "Estimated interview wait times for each post",
    href: "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/waittimes.html",
    icon: DocumentTextIcon,
  },
  {
    title: "U.S. Citizens Abroad—Emergency",
    description: "1-888-407-4747 (U.S./Canada) or +1-202-501-4444 (overseas)",
    href: "https://travel.state.gov/content/travel/en/international-travel/emergencies.html",
    icon: PhoneIcon,
  },
];

export default function EmbassyPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.embassy}
            alt=""
            fill
            className="object-cover object-center opacity-20 w-full"
            sizes="100vw"
            priority
          />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
          <div className="absolute inset-0 opacity-15" style={{ backgroundImage: "radial-gradient(circle at 50% 50%, rgba(0, 113, 227, 0.2) 0%, transparent 50%)" }} />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur border border-white/25 flex items-center justify-center shadow-lg">
              <MapPinIcon className="w-6 h-6 text-white" />
            </div>
            <div className="hero-text-white" style={{ color: "#ffffff" }}>
              <h1 className="text-xl sm:text-2xl font-bold !text-white" style={{ color: "#ffffff" }}>
                Embassy Finder
              </h1>
              <p className="text-sm !text-white mt-0.5" style={{ color: "#ffffff" }}>
                Locate embassies and consulates for visa interviews. Quick access—no hunting on government sites.
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 sm:py-8 w-full min-w-0">
        {/* Travel.State.Gov style: U.S. Citizens emergency */}
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/10 p-4 mb-6">
          <div className="flex items-start gap-3">
            <ExclamationCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">U.S. citizens abroad—emergency</p>
              <p className="text-sm text-[var(--text-secondary)]">
                Contact the nearest U.S. Embassy or call{" "}
                <a href="tel:+18884074747" className="text-[var(--text-primary)] hover:underline font-medium">1-888-407-4747</a> (U.S./Canada) or{" "}
                <a href="tel:+12025014444" className="text-[var(--text-primary)] hover:underline font-medium">+1-202-501-4444</a> (overseas).
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm p-5 sm:p-6 mb-6">
          <h2 className="text-base font-semibold text-[var(--text-primary)] mb-2">
            Where is your visa interview?
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Consular processing cases are interviewed at the U.S. embassy or consulate in the beneficiary&apos;s country. Use the links below to find locations, contact info, and visa wait times.
          </p>
          <a
            href="https://www.usembassy.gov/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--uscis-blue)] text-white font-medium hover:bg-[var(--uscis-blue-dark)] hover:shadow-lg hover:shadow-[var(--uscis-blue)]/25 transition-all duration-200"
          >
            Open embassy finder
            <ArrowTopRightOnSquareIcon className="w-4 h-4" />
          </a>
        </div>

        <div className="space-y-3">
          {embassyResources.map((r, idx) => {
            const Icon = r.icon;
            return (
              <a
                key={idx}
                href={r.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start gap-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 hover:border-[var(--uscis-blue)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-[var(--text-primary)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-[var(--text-primary)] group-hover:text-[var(--text-primary)]">
                    {r.title}
                  </h3>
                  <p className="text-sm text-[var(--text-secondary)] mt-0.5">
                    {r.description}
                  </p>
                </div>
                <ArrowTopRightOnSquareIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0" />
              </a>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/official-links" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            All official links
          </Link>
          <Link href="/travel-advisories" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Travel Advisories
          </Link>
          <Link href="/processing-times" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Processing Times
          </Link>
          <Link href="/resources" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
            Resources
          </Link>
        </div>
      </main>
    </div>
  );
}
