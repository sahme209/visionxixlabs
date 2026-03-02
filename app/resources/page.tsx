"use client";

import Link from "next/link";
import Image from "next/image";
import { RESOURCE_IMAGES } from "@/lib/images";
import {
  ArrowRightIcon,
  GlobeAltIcon,
  DocumentDuplicateIcon,
  MapPinIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  AcademicCapIcon,
  BriefcaseIcon,
  BuildingOffice2Icon,
  EnvelopeIcon,
  DocumentTextIcon,
  UserGroupIcon,
  HomeIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline";
import TravelStateEmergencyBanner from "@/components/TravelStateEmergencyBanner";

/** On VisaNova — content shown in our UI, not just links out */
const VNOVA_HUBS = [
  { title: "Passport Hub", href: "/passports", icon: DocumentDuplicateIcon, desc: "Forms, fees, processing—all here" },
  { title: "Visa Types Explorer", href: "/visa-types", icon: GlobeAltIcon, desc: "Immigrant & nonimmigrant categories" },
  { title: "STEP Hub", href: "/step", icon: ShieldCheckIcon, desc: "Enroll for alerts & emergency contact" },
  { title: "NVC Process Guide", href: "/nvc-guide", icon: DocumentTextIcon, desc: "Step-by-step after petition approval" },
  { title: "Records & Documents", href: "/records", icon: DocumentDuplicateIcon, desc: "Replace or certify documents" },
  { title: "Travel Safety Checker", href: "/travel-safety", icon: ExclamationTriangleIcon, desc: "Safe to travel? Score by visa status, country, airports" },
  { title: "Travel Advisories", href: "/travel-advisories", icon: ExclamationTriangleIcon, desc: "Country safety before your trip" },
  { title: "Embassy Finder", href: "/embassy", icon: MapPinIcon, desc: "Find U.S. embassies & consulates" },
];

/** Travel.State.Gov — official links for filing or deep detail */
const TRAVEL_STATE_LINKS = [
  { title: "International Travel", href: "https://travel.state.gov/content/travel/en/international-travel.html", icon: GlobeAltIcon, desc: "Passports, vaccinations, country info" },
  { title: "Congressional Liaison", href: "https://travel.state.gov/content/travel/en/about-us/congressional-liaison.html", icon: UserGroupIcon, desc: "Congressional inquiries for constituent cases" },
  { title: "Special Issuance Agency", href: "https://travel.state.gov/content/travel/en/passports/passport-help/special-issuance-agency.html", icon: ShieldCheckIcon, desc: "Urgent passport, lost/stolen" },
  { title: "Intercountry Adoption", href: "https://travel.state.gov/content/travel/en/Intercountry-Adoption.html", icon: UserGroupIcon, desc: "Adopting to/from the U.S." },
  { title: "Parental Child Abduction", href: "https://travel.state.gov/content/travel/en/International-Parental-Child-Abduction.html", icon: ExclamationTriangleIcon, desc: "Resources for affected families" },
  { title: "MyTravelGov", href: "https://travel.state.gov/content/travel/en/about-us/mytravelgov.html", icon: DocumentTextIcon, desc: "Manage travel documents online" },
];

/** Popular — mix of our pages and official */
const POPULAR_LINKS = [
  { label: "Passports", href: "/passports", internal: true },
  { label: "Visa Types", href: "/visa-types", internal: true },
  { label: "STEP", href: "/step", internal: true },
  { label: "NVC Guide", href: "/nvc-guide", internal: true },
  { label: "Travel Safety", href: "/travel-safety", internal: true },
  { label: "Travel Advisories", href: "/travel-advisories", internal: true },
  { label: "Embassy Finder", href: "/embassy", internal: true },
  { label: "Visa Bulletin", href: "https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html", internal: false },
  { label: "CEAC Status", href: "https://ceac.state.gov/CEACStatTracker/Status.aspx", internal: false },
];

/** Tools ordered by typical journey: check status → understand timeline → file/guides → interview & travel */
const tools = [
  { title: "USCIS Case Status", description: "Check case status with receipt number.", href: "/", count: "Official" },
  { title: "Processing Times", description: "Live USCIS data by form and service center.", href: "/processing-times", count: "Live" },
  { title: "Status Decoder", description: "Plain-language status explanations.", href: "/status-decoder", count: "20+ statuses" },
  { title: "Form Guides", description: "Step-by-step I-130, I-485, N-400.", href: "/guides", count: "14 guides" },
  { title: "NVC Process Guide", description: "Step-by-step after petition approval.", href: "/nvc-guide", count: "Guide" },
  { title: "Fee Calculator", description: "Estimate fees for 15+ forms.", href: "/fees", count: "15+ forms" },
  { title: "Help Center", description: "FAQs, documents, timelines, interview prep.", href: "/help", count: "10+ topics" },
  { title: "Processing Statistics", description: "Approval trends and live stats.", href: "/stats", count: "Pro" },
  { title: "Embassy Finder", description: "Locate embassies for visa interviews.", href: "/embassy", count: "Official" },
  { title: "Travel Safety Checker", description: "Safety score by visa status, country, and airports.", href: "/travel-safety", count: "Score" },
  { title: "Travel Advisories", description: "Country safety before your visa trip.", href: "/travel-advisories", count: "Official" },
  { title: "Official Links", description: "30+ USCIS and Travel.State.Gov links.", href: "/official-links", count: "30+ links" },
];

export default function ResourcesPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 w-full min-w-0">
        {/* U.S. Citizen Emergency — Travel.State.Gov prominent callout, Apple-style */}
        <section className="mb-10">
          <TravelStateEmergencyBanner />
        </section>

        {/* Subscribe CTA — moved up for visibility */}
        <section className="mb-10 rounded-xl bg-[var(--uscis-blue)]/5 border border-[var(--uscis-blue)]/20 p-5">
          <p className="font-semibold text-[var(--text-primary)] text-sm mb-1">Need personalized case tracking?</p>
          <p className="text-xs text-[var(--text-secondary)] mb-3">Sign in for estimates, queue position, and live updates.</p>
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:underline">
            Go to Home <ArrowRightIcon className="w-4 h-4" />
          </Link>
        </section>

        {/* VisaNova Tools — first, ordered by journey */}
        <section className="mb-10">
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">VisaNova tools</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {tools.map((tool) => {
              const imageSrc = RESOURCE_IMAGES[tool.title];
              return (
                <Link
                  key={tool.title}
                  href={tool.href}
                  className="group flex items-center gap-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--border-color-hover)] hover:shadow-[var(--shadow-sm)] transition-all duration-200"
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-[var(--bg-surface-alt)] flex-shrink-0">
                    {imageSrc ? (
                      <Image src={imageSrc} alt="" width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-[var(--uscis-blue)]/20 to-[var(--uscis-blue)]/5 flex items-center justify-center">
                        <SparklesIcon className="w-6 h-6 text-[var(--text-primary)]" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-[var(--text-primary)]">{tool.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{tool.description}</p>
                  </div>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--bg-surface-alt)] text-[var(--text-tertiary)] flex-shrink-0">
                    {tool.count}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Explore on VisaNova — content in our UI, Apple-style */}
        <section className="mb-10">
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Explore on VisaNova</p>
          <p className="text-sm text-[var(--text-secondary)] mb-4">We surface official info in our UI. No hunting—read here, then file at the official site when ready.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {VNOVA_HUBS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--uscis-blue)]/50 hover:shadow-[var(--shadow-sm)] transition-all duration-200"
                >
                  <div className="w-9 h-9 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--uscis-blue)]/15 transition-colors">
                    <Icon className="w-4.5 h-4.5 text-[var(--text-primary)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[var(--text-primary)] text-sm group-hover:text-[var(--text-primary)]">{item.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</p>
                  </div>
                  <ArrowRightIcon className="w-4 h-4 text-[var(--text-tertiary)] flex-shrink-0 opacity-0 group-hover:opacity-100 translate-x-0 group-hover:translate-x-0.5 transition-all" />
                </Link>
              );
            })}
          </div>
        </section>

        {/* Popular — mix internal + official */}
        <section className="mb-10">
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Popular</p>
          <div className="flex flex-wrap gap-2">
            {POPULAR_LINKS.map((item) =>
              item.internal ? (
                <Link key={item.label} href={item.href} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/50 hover:bg-[var(--uscis-blue)]/5 transition-all">
                  {item.label} <ArrowRightIcon className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-sm font-medium text-[var(--text-primary)] hover:border-[var(--uscis-blue)]/50 hover:bg-[var(--uscis-blue)]/5 transition-all">
                  {item.label} <ArrowRightIcon className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                </a>
              )
            )}
          </div>
        </section>

        {/* More from Travel.State.Gov — official links */}
        <section className="mb-12">
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">More from Travel.State.Gov</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TRAVEL_STATE_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--border-color-hover)] transition-all">
                  <div className="w-9 h-9 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-4.5 h-4.5 text-[var(--text-primary)]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text-primary)] text-sm">{item.title}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        {/* Student, Work & Business — our Visa Types page first */}
        <section className="mb-12">
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Student, work & business visas</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: "Student (F-1, M-1)", desc: "Study in the U.S. OPT, STEM extension.", href: "/visa-types", color: "emerald", internal: true },
              { title: "Employment (H-1B, EB)", desc: "Work visas and employment green cards.", href: "/visa-types", color: "blue", internal: true },
              { title: "Business (B-1, E-2, L-1)", desc: "Business visits, investment, transfers.", href: "/visa-types", color: "orange", internal: true },
            ].map((item) => (
              item.internal ? (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--border-color-hover)] transition-all"
                >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  item.color === "emerald" ? "bg-emerald-500/10" : item.color === "orange" ? "bg-orange-500/10" : "bg-[var(--uscis-blue)]/10"
                }`}>
                  {item.color === "emerald" ? <AcademicCapIcon className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" /> : item.color === "orange" ? <BuildingOffice2Icon className="w-4.5 h-4.5 text-orange-600 dark:text-orange-400" /> : <BriefcaseIcon className="w-4.5 h-4.5 text-[var(--text-primary)]" />}
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)] text-sm">{item.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</p>
                </div>
              </Link>
              ) : (
              <a key={item.title} href={item.href} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-4 hover:border-[var(--border-color-hover)] transition-all">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  item.color === "emerald" ? "bg-emerald-500/10" : item.color === "orange" ? "bg-orange-500/10" : "bg-[var(--uscis-blue)]/10"
                }`}>
                  {item.color === "emerald" ? <AcademicCapIcon className="w-4.5 h-4.5 text-emerald-600" /> : item.color === "orange" ? <BuildingOffice2Icon className="w-4.5 h-4.5 text-orange-600" /> : <BriefcaseIcon className="w-4.5 h-4.5 text-[var(--text-primary)]" />}
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-primary)] text-sm">{item.title}</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{item.desc}</p>
                </div>
              </a>
              )
            ))}
          </div>
        </section>

        {/* Stay connected / Legal — Travel.State.Gov footer style */}
        <section className="mb-12 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] p-6 sm:p-8">
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-4">Stay connected</p>
          <div className="flex flex-wrap gap-3">
            <a href="https://travel.state.gov/content/travel.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:underline">
              <HomeIcon className="w-4 h-4" /> Travel.State.Gov
            </a>
            <a href="https://travel.state.gov/content/travel/en/about-us/contact-us.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:underline">
              <EnvelopeIcon className="w-4 h-4" /> Contact Bureau of Consular Affairs
            </a>
            <a href="https://travel.state.gov/content/travel/en/about-us/legal-information.html" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--text-primary)] hover:underline">
              <DocumentTextIcon className="w-4 h-4" /> Legal information
            </a>
          </div>
        </section>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/" className="font-medium text-[var(--text-primary)] hover:underline">Home</Link>
          <Link href="/guides" className="font-medium text-[var(--text-primary)] hover:underline">Form Guides</Link>
          <Link href="/official-links" className="font-medium text-[var(--text-primary)] hover:underline">Official Links</Link>
          <Link href="/news" className="font-medium text-[var(--text-primary)] hover:underline">News</Link>
        </div>
      </main>
    </div>
  );
}
