"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200/90 dark:border-slate-800/90 shadow-[0_8px_30px_rgba(15,23,42,0.12)]"
          : "bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 shadow-[0_1px_3px_rgba(124,58,237,0.06)]"
      }`}
    >
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
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/#how-it-works"
              className="nav-link-underline relative px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-colors text-sm font-medium"
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              className="nav-link-underline relative px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-colors text-sm font-medium"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="nav-link-underline relative px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-colors text-sm font-medium"
            >
              Contact
            </Link>
            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700" aria-hidden />
            <Link
              href="/auth/signin"
              className="nav-link-underline relative px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-xl transition-colors text-sm font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup?redirect=/dashboard/onboarding"
              className="btn-huly cta-glow inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 hover:shadow-violet-500/40 transition-all"
            >
              Start Free
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
              <Link href="/auth/signup?redirect=/dashboard/onboarding" onClick={() => setMobileMenuOpen(false)} className="mx-4 inline-flex items-center justify-center gap-2 px-4 py-3 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-2xl text-sm font-semibold shadow-lg shadow-violet-500/30 cta-glow">
                Start Free
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <Link href="/#how-it-works" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm">
                How it works
              </Link>
              <Link href="/pricing" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm">
                Pricing
              </Link>
              <Link href="/contact" onClick={() => setMobileMenuOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg text-sm">
                Contact
              </Link>
              <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)} className="mt-2 mx-4 inline-flex items-center justify-center px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm font-semibold">
                Sign in
                <ArrowRightIcon className="ml-1.5 h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
