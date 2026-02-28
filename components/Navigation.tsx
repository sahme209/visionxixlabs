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
  { href: "/ai-solutions", label: "AI Solutions" },
  { href: "/ai-engineering", label: "AI Engineering & LLM Systems" },
  { href: "/cloud-security", label: "Cloud Security" },
  { href: "/solutions-for-growing-teams", label: "Growing Teams" },
  { href: "/case-studies", label: "Case Studies" },
  { href: "/free-review", label: "Free Cloud Review" },
  { href: "/cloud-solutions", label: "Cloud Solutions Overview" },
];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setCloudOpen(false);
        setSolutionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-[0_1px_3px_rgba(124,58,237,0.06)]">
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
            <span className="text-xl font-bold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-clip-text text-transparent">
              Vision XIX Labs
            </span>
          </Link>
          <div ref={navRef} className="hidden md:flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setCloudOpen(!cloudOpen); setSolutionsOpen(false); }}
                className="inline-flex items-center px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-all text-sm font-medium"
              >
                Cloud
                <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform ${cloudOpen ? "rotate-180" : ""}`} />
              </button>
              {cloudOpen && (
                <div className="absolute left-0 top-full mt-2 w-48 py-2 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
                  {cloudLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setCloudOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg hover:text-violet-600 dark:hover:text-violet-400"
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
                onClick={() => { setSolutionsOpen(!solutionsOpen); setCloudOpen(false); }}
                className="inline-flex items-center px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-all text-sm font-medium"
              >
                Solutions
                <ChevronDownIcon className={`ml-1 h-4 w-4 transition-transform ${solutionsOpen ? "rotate-180" : ""}`} />
              </button>
              {solutionsOpen && (
                <div className="absolute left-0 top-full mt-2 w-52 py-2 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200/80 dark:border-slate-700/80 shadow-xl shadow-slate-200/50 dark:shadow-none">
                  {solutionsLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSolutionsOpen(false)}
                      className="block px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg hover:text-violet-600 dark:hover:text-violet-400"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/cloud-operator"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-all text-sm font-medium"
            >
              Axiom
            </Link>
            <Link
              href="/insights"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Insights
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-2xl text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-200 transition-colors"
            >
              Contact
              <ArrowRightIcon className="ml-1.5 h-4 w-4" />
            </Link>
            <Link
              href="/cloud-operator"
              className="btn-huly inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 hover:from-violet-500 hover:to-fuchsia-500"
            >
              Run Axiom
              <ArrowRightIcon className="h-4 w-4" />
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
              <Link href="/cloud-solutions" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm font-medium">Cloud Solutions</Link>
              <Link href="/cloud-solutions/aws" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg text-sm font-medium">AWS</Link>
              <Link href="/cloud-solutions/azure" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg text-sm font-medium">Azure</Link>
              <Link href="/cloud-solutions/gcp" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium">GCP</Link>
              <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Solutions</p>
              <Link href="/ai-solutions" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm font-medium">AI Solutions</Link>
              <Link href="/cloud-security" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm font-medium">Cloud Security</Link>
              <Link href="/solutions-for-growing-teams" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm font-medium">Growing Teams</Link>
              <Link href="/case-studies" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm font-medium">Case Studies</Link>
              <Link href="/insights" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm font-medium">Insights</Link>
              <Link href="/cloud-operator" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm font-medium">Axiom</Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="mt-2 inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold">
                Contact
                <ArrowRightIcon className="ml-1.5 h-4 w-4" />
              </Link>
              <Link href="/cloud-operator" onClick={() => setMobileMenuOpen(false)} className="inline-flex items-center justify-center gap-2 px-4 py-2 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30">
                Run Axiom
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
