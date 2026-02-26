"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, Bars3Icon, XMarkIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

const cloudLinks = [
  { href: "/cloud-solutions", label: "Cloud Solutions" },
  { href: "/cloud-solutions/aws", label: "AWS" },
  { href: "/cloud-solutions/azure", label: "Azure" },
  { href: "/cloud-solutions/gcp", label: "GCP" },
];

const solutionsLinks = [
  { href: "/cloud-operator", label: "AI Cloud Operator" },
  { href: "/request", label: "Website Request / Get a Quote" },
  { href: "/visionxix-ai", label: "Vision XIX AI" },
  { href: "/visionxix-ai/pricing", label: "Vision XIX AI — Pricing" },
  { href: "/visionxix-ai/features", label: "Vision XIX AI — Features" },
  { href: "/ai-solutions", label: "AI Solutions" },
  { href: "/ai-engineering", label: "AI Engineering & LLM Systems" },
  { href: "/markets", label: "Where Companies Need AI" },
  { href: "/enterprise-readiness", label: "Enterprise Readiness" },
  { href: "/solutions-for-growing-teams", label: "Growing Teams" },
  { href: "/cloud-security", label: "Cloud Security" },
  { href: "/free-review", label: "Free Cloud & AI Review" },
  { href: "/cloud-review", label: "Cloud Review Session" },
  { href: "/case-studies", label: "Case Studies" },
];

const productLinks = [
  { href: "/cloud-operator", label: "Axiom — Autonomous Infrastructure Intelligence", highlight: true },
  { href: "/request", label: "AI Website Builder", highlight: false },
  { href: "/visionxix-ai", label: "Vision XIX AI", highlight: false },
  { href: "/dashboard", label: "Bots & Assistants", highlight: false },
];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setCloudOpen(false);
        setSolutionsOpen(false);
        setProductsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <Image
              src="/vision-xix-logo.png"
              alt="Vision XIX Labs"
              width={42}
              height={42}
              className="rounded-xl shadow-lg group-hover:shadow-xl transition-shadow"
              priority
            />
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Vision XIX Labs
            </span>
          </Link>
          <div ref={navRef} className="hidden md:flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setCloudOpen(!cloudOpen); setSolutionsOpen(false); }}
                className="inline-flex items-center px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
              >
                Cloud
                <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform ${cloudOpen ? "rotate-180" : ""}`} />
              </button>
              {cloudOpen && (
                <div className="absolute left-0 top-full mt-1 w-44 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
                  {cloudLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setCloudOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setSolutionsOpen(!solutionsOpen); setCloudOpen(false); setProductsOpen(false); }}
                className="inline-flex items-center px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
              >
                Solutions
                <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform ${solutionsOpen ? "rotate-180" : ""}`} />
              </button>
              {solutionsOpen && (
                <div className="absolute left-0 top-full mt-1 w-48 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
                  {solutionsLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSolutionsOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => { setProductsOpen(!productsOpen); setCloudOpen(false); setSolutionsOpen(false); }}
                className="inline-flex items-center px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
              >
                Products
                <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform ${productsOpen ? "rotate-180" : ""}`} />
              </button>
              {productsOpen && (
                <div className="absolute left-0 top-full mt-1 w-64 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg">
                  {productLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setProductsOpen(false)}
                      className={`block px-4 py-2 text-sm ${
                        item.highlight
                          ? "font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      } hover:text-indigo-600 dark:hover:text-indigo-400`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/insights"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Insights
            </Link>
            <Link
              href="/#about"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              About
            </Link>
            <Link
              href="/press"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Press
            </Link>
            <Link
              href="/request"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Get a Quote
            </Link>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Dashboard
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Contact
              <ArrowRightIcon className="ml-1.5 h-4 w-4" />
            </Link>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 dark:border-slate-800 mt-2">
            <div className="flex flex-col space-y-2">
              <p className="px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Cloud</p>
              <Link href="/cloud-solutions" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Cloud Solutions</Link>
              <Link href="/cloud-solutions/aws" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg text-sm font-medium">AWS</Link>
              <Link href="/cloud-solutions/azure" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium">Azure</Link>
              <Link href="/cloud-solutions/gcp" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium">GCP</Link>
              <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Solutions</p>
              <Link href="/cloud-operator" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">AI Cloud Operator</Link>
              <Link href="/request" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Website Request / Get a Quote</Link>
              <Link href="/visionxix-ai" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Vision XIX AI</Link>
              <Link href="/visionxix-ai/pricing" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium pl-6">Vision XIX AI — Pricing</Link>
              <Link href="/visionxix-ai/features" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium pl-6">Vision XIX AI — Features</Link>
              <Link href="/ai-solutions" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">AI Solutions</Link>
              <Link href="/ai-engineering" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">AI Engineering & LLM Systems</Link>
              <Link href="/markets" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Where Companies Need AI</Link>
              <Link href="/enterprise-readiness" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Enterprise Readiness</Link>
              <Link href="/solutions-for-growing-teams" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Growing Teams</Link>
              <Link href="/cloud-security" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Cloud Security</Link>
              <Link href="/free-review" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Free Cloud & AI Review</Link>
              <Link href="/cloud-review" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Cloud Review Session</Link>
              <Link href="/insights" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Insights</Link>
              <Link href="/case-studies" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Case Studies</Link>
              <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Products</p>
              <Link href="/cloud-operator" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-900 dark:text-slate-100 bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 rounded-lg text-sm font-semibold">
                Axiom — Autonomous Infrastructure Intelligence
              </Link>
              <Link href="/request" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">AI Website Builder</Link>
              <Link href="/visionxix-ai" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Vision XIX AI</Link>
              <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Bots &amp; Assistants</Link>
              <Link href="/#about" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">About</Link>
              <Link href="/press" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg text-sm font-medium">Press &amp; Media</Link>
              <Link href="/request"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Get a Quote
            </Link>
            <Link
              href="/dashboard" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300">Dashboard</Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="mt-2 inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold">
                Contact
                <ArrowRightIcon className="ml-1.5 h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
