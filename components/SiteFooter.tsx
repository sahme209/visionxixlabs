"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import { COMPANY_NAME, URLS, MAILTO_SUPPORT, PARENT_WEBSITE } from "@/lib/constants/company";
import { HERO_IMAGES } from "@/lib/images";
import { TAGLINE, DISCLAIMER_USCIS_SHORT } from "@/lib/constants/copy";

const socialLinks = [
  { href: URLS.facebook, label: "Facebook Page", icon: "/facebook.svg" },
  { href: URLS.facebookGroup, label: "Facebook Community / Group", icon: "/facebook-group.svg" },
  { href: URLS.discord, label: "Discord", icon: "/discord.svg" },
  { href: URLS.appStore, label: "App Store", icon: "/appstore.svg" },
] as const;

const sectionHeadingClassDesktop = "text-[11px] font-semibold uppercase tracking-wider mb-2.5 text-white";

/**
 * Site footer — professional, clean, balanced. Matches nav gradient and grid.
 * Mobile: Compact accordion design. Desktop: Full grid layout.
 * Single link config drives both; company/URLs from constants.
 */
export default function SiteFooter() {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>(null);

  const linkClass =
    "text-sm text-white/90 hover:text-white transition-colors duration-200";

  const resourcesCol1 = [
    { href: "/resources", label: "Resources Hub" },
    { href: "/passports", label: "Passport Hub" },
    { href: "/visa-types", label: "Visa Types" },
    { href: "/step", label: "STEP Hub" },
    { href: "/nvc-guide", label: "NVC Guide" },
    { href: "/records", label: "Records & Documents" },
    { href: "/guides", label: "Form Guides" },
    { href: "/embassy", label: "Embassy Finder" },
    { href: "/processing-times", label: "Processing Times" },
  ];
  const resourcesCol2 = [
    { href: "/official-links", label: "Official Links" },
    { href: "/fees", label: "Fee Calculator" },
    { href: "/status-decoder", label: "Status Decoder" },
    { href: "/travel-advisories", label: "Travel Advisories" },
    { href: "/stats", label: "Processing Statistics" },
    { href: "/news", label: "Immigration News" },
  ];
  const allResources = [...resourcesCol1, ...resourcesCol2];

  const footerSections = [
    {
      id: "support",
      title: "Support",
      desktopTitle: "Support",
      links: [
        { href: "/help", label: "Help Center" },
        { href: "/about", label: "About Us" },
        { href: MAILTO_SUPPORT, label: "Contact Us", external: true },
        { href: URLS.uscisContact, label: "USCIS: 1-800-375-5283", external: true },
        { href: "tel:+18884074747", label: "U.S. Citizens Abroad: 1-888-407-4747", external: true },
        { href: URLS.facebookGroup, label: "Community", external: true },
      ],
    },
    {
      id: "account",
      title: "Account",
      desktopTitle: "Account",
      links: user
        ? [
            { href: "/settings", label: "Settings" },
            { href: "/profile-setup", label: "Profile Setup" },
          ]
        : [{ href: "/login", label: "Sign In" }],
    },
    {
      id: "legal",
      title: "Legal",
      desktopTitle: "Legal",
      links: [
        { href: "/privacy", label: "Privacy Policy" },
        { href: "/terms", label: "Terms of Service" },
        { href: "/subscribe", label: "Subscribe" },
      ],
    },
    {
      id: "official",
      title: "Official",
      desktopTitle: "Official Links",
      links: [
        { href: URLS.uscis, label: "USCIS.gov", external: true },
        { href: URLS.travelStateGov, label: "Travel.State.Gov", external: true },
        { href: URLS.stepEnrollment, label: "STEP (enroll)", external: true },
        { href: URLS.usEmbassy, label: "Find U.S. Embassies", external: true },
        { href: URLS.visaBulletin, label: "Visa Bulletin", external: true },
      ],
    },
  ];

  const toggleSection = (section: string) => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <footer
      className="relative mt-auto border-t-2 border-[var(--uscis-blue)]"
      role="contentinfo"
    >
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)]">
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.documents}
            alt=""
            fill
            className="object-cover object-center opacity-20 w-full"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/90" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* Mobile Footer - Compact Accordion */}
          <div className="lg:hidden space-y-1">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                  <img src="/logo.svg" alt="" className="w-3.5 h-3.5 object-contain" />
                </div>
                <span className="text-xs font-semibold text-white">VisaNova</span>
              </div>
              <div className="flex items-center gap-1">
                {socialLinks.map(({ href, label, icon }) => (
                  <a
                    key={href}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/15 flex items-center justify-center transition-colors border border-white/15 overflow-hidden"
                    aria-label={label}
                  >
                    <img src={icon} alt="" className="w-4 h-4 object-contain" aria-hidden />
                  </a>
                ))}
              </div>
            </div>

            {/* Accordion Sections */}
            <div className="space-y-1">
              {/* Resources accordion (combined links) */}
              <div className="border-b border-white/10">
                <button
                  onClick={() => toggleSection("resources")}
                  className="w-full flex items-center justify-between py-2.5 min-h-[40px] text-left touch-manipulation active:bg-white/5"
                >
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">
                    Resources
                  </span>
                  <ChevronDownIcon
                    className={`w-4 h-4 text-white/70 transition-transform ${
                      openSection === "resources" ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openSection === "resources" && (
                  <div className="pb-2 grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {allResources.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block text-xs text-white hover:opacity-100 transition-colors opacity-90"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              {footerSections.map((section) => (
                <div key={section.id} className="border-b border-white/10">
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="w-full flex items-center justify-between py-2.5 min-h-[40px] text-left touch-manipulation active:bg-white/5"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">
                      {section.title}
                    </span>
                    <ChevronDownIcon
                      className={`w-4 h-4 text-white/70 transition-transform ${
                        openSection === section.id ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {openSection === section.id && (
                    <div className="pb-2 space-y-1.5">
                      {section.links.map((link) =>
                        link.external ? (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-xs text-white hover:opacity-100 transition-colors opacity-90"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            key={link.href}
                            href={link.href}
                            className="block text-xs text-white hover:opacity-100 transition-colors opacity-90"
                          >
                            {link.label}
                          </Link>
                        )
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-1 border-t border-white/10">
              <p className="text-[9px] text-white/70 leading-relaxed">
                © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
                {" · "}
                <a href={PARENT_WEBSITE} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors">
                  visionxixlabs.com
                </a>
              </p>
              <p className="text-[9px] text-white/70 leading-relaxed">
                {DISCLAIMER_USCIS_SHORT}
              </p>
              <div className="flex items-center gap-2 pt-0.5">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-medium text-white/80">
                  <svg className="w-2.5 h-2.5 text-emerald-400/90" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Secure
                </span>
                <span className="text-[9px] text-white/70">
                  Independent service provider
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Footer - 5-row clean layout */}
          <div className="hidden lg:block">
            {/* Row 1: Brand + tagline + social */}
            <div className="flex items-center justify-between pb-6 border-b border-white/15">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0">
                  <img src="/logo.svg" alt="" className="w-6 h-6 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{TAGLINE}</p>
                  <p className="text-xs text-white/70 mt-0.5">Your immigration hub—clearer, faster, all in one place</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {socialLinks.map(({ href, label, icon }) => (
                  <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center border border-white/15 transition-colors" aria-label={label}>
                    <img src={icon} alt="" className="w-4 h-4 object-contain" aria-hidden />
                  </a>
                ))}
              </div>
            </div>

            {/* Row 2: Resources */}
            <div className="py-5 border-b border-white/15">
              <h3 className={sectionHeadingClassDesktop}>Resources</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-2">
                {allResources.map((link) => (
                  <Link key={link.href} href={link.href} className={linkClass}>{link.label}</Link>
                ))}
              </div>
            </div>

            {/* Rows 3–6: Support, Account, Legal, Official - 4-column layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 py-5 border-b border-white/15">
              {footerSections.map((section) => (
                <div key={section.id}>
                  <h3 className={sectionHeadingClassDesktop}>{section.desktopTitle}</h3>
                  <ul className="space-y-2">
                    {section.links.map((link) => {
                      if (link.external) {
                        return (
                          <li key={link.href}>
                            <a href={link.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
                              {link.label}
                            </a>
                          </li>
                        );
                      }
                      return (
                        <li key={link.href}>
                          <Link href={link.href} className={linkClass}>{link.label}</Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Row 6: Copyright bar */}
            <div className="flex mt-6 pt-5 border-t border-white/15 flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6 flex-wrap">
                <p className="text-xs text-white/90">
                  © {new Date().getFullYear()} {COMPANY_NAME}
                  {" · "}
                  <a href={PARENT_WEBSITE} target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white transition-colors">
                    visionxixlabs.com
                  </a>
                </p>
                <p className="text-xs text-white/70 max-w-lg">
                  {DISCLAIMER_USCIS_SHORT}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-medium text-white/90">
                <svg className="w-3 h-3 text-emerald-400/90" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                </svg>
                Secure
              </span>
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-xs font-medium text-white/90">
                <svg className="w-3 h-3 text-emerald-400/90" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Private
              </span>
              <span className="text-xs text-white/70 border-l border-white/20 pl-4">
                Independent provider
              </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
