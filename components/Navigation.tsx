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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#09090b]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center space-x-3 group shrink-0">
            <Image
              src="/vision-xix-logo.png"
              alt="Vision XIX Labs"
              width={38}
              height={38}
              className="rounded-xl shadow-lg group-hover:shadow-violet-500/20 transition-shadow"
              priority
            />
            <span className="text-lg font-bold text-gradient">
              Vision XIX Labs
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-1">
            {[
              { href: "/axiom", label: "Product" },
              { href: "/axiom/operations", label: "Operations" },
              { href: "/operator/pricing", label: "Pricing" },
              { href: "/contact", label: "Contact" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="nav-link-underline relative px-4 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium"
              >
                {link.label}
              </Link>
            ))}
            <div className="w-px h-5 bg-white/[0.08] mx-2" aria-hidden />
            <Link
              href="/auth/signin"
              className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/operator/onboarding"
              className="btn-huly cta-glow inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/20 hover:shadow-violet-500/30 transition-all ml-2"
            >
              Start Free
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-white/[0.06] mt-2">
            <div className="flex flex-col space-y-1">
              <Link href="/operator/onboarding" onClick={() => setMobileMenuOpen(false)} className="mx-4 mb-3 inline-flex items-center justify-center gap-2 px-4 py-3 text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-xl text-sm font-semibold shadow-lg shadow-violet-500/20 cta-glow">
                Start Free
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              {[
                { href: "/axiom", label: "Product" },
                { href: "/axiom/operations", label: "Operations" },
                { href: "/operator/pricing", label: "Pricing" },
                { href: "/contact", label: "Contact" },
              ].map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setMobileMenuOpen(false)} className="px-4 py-2.5 text-zinc-400 font-medium hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors">
                  {link.label}
                </Link>
              ))}
              <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)} className="mt-2 mx-4 inline-flex items-center justify-center px-5 py-2.5 border border-white/[0.12] text-white rounded-lg text-sm font-semibold hover:bg-white/5 transition-colors">
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
