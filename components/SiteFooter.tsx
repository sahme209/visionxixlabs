"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "@heroicons/react/24/outline";
import { COMPANY_NAME, URLS, PARENT_WEBSITE } from "@/lib/constants/company";

const socialLinks = [
  { href: URLS.facebook, label: "Facebook", icon: "/facebook.svg" },
  { href: URLS.facebookGroup, label: "Facebook Group", icon: "/facebook-group.svg" },
  { href: URLS.discord, label: "Discord", icon: "/discord.svg" },
  { href: URLS.appStore, label: "App Store", icon: "/appstore.svg" },
] as const;

export default function SiteFooter() {
  const { user } = useAuth();
  const [openSection, setOpenSection] = useState<string | null>(null);

  const accountLinks = user
    ? [
        { href: "/settings", label: "Settings" },
        { href: "/profile-setup", label: "Profile" },
        { href: "/subscribe", label: "Subscribe" },
      ]
    : [
        { href: "/login", label: "Sign In" },
        { href: "/subscribe", label: "Subscribe" },
      ];

  const columns = [
    {
      heading: "Resources",
      links: [
        { href: "/resources", label: "Resources Hub" },
        { href: "/guides", label: "Form Guides" },
        { href: "/processing-times", label: "Processing Times" },
        { href: "/fees", label: "Fee Calculator" },
        { href: "/status-decoder", label: "Status Decoder" },
        { href: "/official-links", label: "Official Links" },
        { href: "/embassy", label: "Embassy Finder" },
        { href: "/news", label: "Immigration News" },
      ],
    },
    {
      heading: "Tools",
      links: [
        { href: "/tools/case-tools", label: "Case Tools" },
        { href: "/passports", label: "Passport Hub" },
        { href: "/visa-types", label: "Visa Types" },
        { href: "/nvc-guide", label: "NVC Guide" },
        { href: "/travel-safety", label: "Travel Safety" },
        { href: "/travel-advisories", label: "Travel Advisories" },
        { href: "/records", label: "Records & Documents" },
        { href: "/stats", label: "Processing Statistics" },
      ],
    },
    {
      heading: "Support",
      links: [
        { href: "/help", label: "Help Center" },
        { href: "/about", label: "About VisaNova" },
        { href: "mailto:support@visionxixlabs.com", label: "Contact Us", external: true },
        { href: URLS.uscisContact, label: "USCIS Contact", external: true },
        { href: URLS.facebookGroup, label: "Community", external: true },
      ],
    },
    {
      heading: "Account",
      links: accountLinks,
    },
    {
      heading: "Legal",
      links: [
        { href: "/privacy", label: "Privacy" },
        { href: "/terms", label: "Terms of use" },
        { href: "/subscribe", label: "Subscribe" },
      ],
    },
    {
      heading: "Company",
      links: [
        { href: "/about", label: "About VisaNova" },
        { href: PARENT_WEBSITE, label: "visionxixlabs.com", external: true },
        { href: URLS.uscis, label: "USCIS.gov", external: true },
        { href: URLS.travelStateGov, label: "Travel.State.Gov", external: true },
      ],
    },
  ];

  const toggleSection = (id: string) => {
    setOpenSection((s) => (s === id ? null : id));
  };

  return (
    <footer className="relative mt-auto bg-[#f3f3f3]" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
        {/* Follow VisaNova - centered, social icons with white circles + shadow */}
        <div className="text-center pb-8 border-b border-[#d2d2d2]">
          <h3 className="text-[13px] font-semibold text-[#1b1b1b] mb-4">Follow VisaNova</h3>
          <div className="flex items-center justify-center gap-3">
            {socialLinks.map(({ href, label, icon }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center border border-[#d2d2d2] shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                aria-label={label}
              >
                <img src={icon} alt="" className="w-5 h-5 object-contain" aria-hidden />
              </a>
            ))}
          </div>
        </div>

        {/* Mobile: Accordion */}
        <div className="lg:hidden space-y-0 pt-6">
          {columns.map((col) => (
            <div key={col.heading} className="border-b border-[#d2d2d2]">
              <button
                onClick={() => toggleSection(col.heading)}
                className="w-full flex items-center justify-between py-3 text-left"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#1b1b1b]">
                  {col.heading}
                </span>
                <ChevronDownIcon
                  className={`w-4 h-4 text-[#5e5e5e] transition-transform ${openSection === col.heading ? "rotate-180" : ""}`}
                />
              </button>
              {openSection === col.heading && (
                <div className="pb-3 space-y-2">
                  {col.links.map((link) =>
                    link.external ? (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="block text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline"
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

        {/* Desktop: 6 columns */}
        <div className="hidden lg:grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 pt-8">
          {columns.map((col) => (
            <div key={col.heading}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3 text-[#1b1b1b]">
                {col.heading}
              </h3>
              <ul className="space-y-2.5">
                {col.links.map((link) =>
                  link.external ? (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline hover:no-underline"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline hover:no-underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 mt-8 border-t border-[#d2d2d2]">
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-start">
            <Link href="/" className="text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline">
              Sitemap
            </Link>
            <a
              href="mailto:support@visionxixlabs.com"
              className="text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline"
            >
              Contact VisaNova
            </a>
            <Link href="/privacy" className="text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline">
              Privacy
            </Link>
            <Link href="/terms" className="text-[11px] text-[#5e5e5e] hover:text-[#1b1b1b] no-underline">
              Terms of use
            </Link>
          </div>
          <p className="text-[11px] text-[#5e5e5e]">
            © {new Date().getFullYear()} {COMPANY_NAME}
          </p>
        </div>
      </div>
    </footer>
  );
}
