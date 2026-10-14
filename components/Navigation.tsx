"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

const primaryLinks = [
  { href: "/product", label: "Axiom" },
  { href: "/demo", label: "Product tour" },
  { href: "/integrations", label: "Integrations" },
  { href: "/security", label: "Security" },
];

const mobileLinks = [
  ...primaryLinks,
  { href: "/capabilities", label: "Capabilities" },
  { href: "/resources", label: "Resources" },
  { href: "/status", label: "Status" },
  { href: "/plans", label: "Plans" },
  { href: "/support", label: "Founding Supporters" },
  { href: "/contact", label: "Contact" },
];

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Shrinks the bar height and deepens its border/shadow once the page
    // has scrolled past the hero, so the nav reads as "docked chrome"
    // rather than a static banner — the same elevation-on-scroll detail
    // Cursor's and Linear's marketing sites use.
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        requestAnimationFrame(() => menuButtonRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("a[href]")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileMenuOpen]);

  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <nav
      aria-label="Primary navigation"
      className={`site-navigation fixed inset-x-0 top-0 z-50 backdrop-blur-2xl transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? "border-b border-white/[0.09] bg-[#090a08]/88 shadow-[0_1px_0_rgba(255,255,255,0.03),0_18px_50px_-28px_rgba(0,0,0,0.95)]"
          : "border-b border-transparent bg-[#090a08]/62"
      }`}
    >
      <div
        className={`mx-auto flex max-w-[1400px] items-center justify-between px-5 transition-[height] duration-300 sm:px-8 lg:px-12 ${
          scrolled ? "h-14 lg:h-16" : "h-16 lg:h-[72px]"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-zinc-100" aria-label="Vision XIX Labs home">
          <Image src="/vision-xix-logo.png" alt="" width={28} height={28} className="rounded-md" priority />
          <span>Vision XIX Labs</span>
        </Link>

        <div className="hidden items-center gap-7 lg:flex">
          {primaryLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-zinc-400 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/support" className="px-2 py-2 text-sm text-zinc-400 transition-colors hover:text-orange-200">Support Axiom</Link>
          <Link href="/auth/signin" className="px-2 py-2 text-sm text-zinc-300 transition-colors hover:text-white">Sign in</Link>
          <Link href="/download" className="rounded-full bg-[#f0f0eb] px-4 py-2 text-sm font-semibold text-[#11120f] transition hover:bg-white hover:shadow-[0_8px_30px_-12px_rgba(255,255,255,.45)]">Download</Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/[0.06] lg:hidden"
        >
          {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          ref={menuRef}
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          // The bar's own height shrinks (h-16 -> h-14) once scrolled, for
          // the "docked chrome" effect above — this must track that exactly,
          // or the overlay starts a few pixels below the bar's real bottom
          // edge and leaves a sliver of page content visible at the top.
          className={`fixed inset-x-0 bottom-0 overflow-y-auto border-t border-white/[0.06] bg-[#090a08]/[0.98] px-5 py-6 lg:hidden ${scrolled ? "top-14" : "top-16"}`}
        >
          <div className="mx-auto flex max-w-lg flex-col">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Explore Axiom</p>
            <div className="mt-4 divide-y divide-white/[0.07] border-y border-white/[0.07]" aria-label="Primary links">
              {mobileLinks.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenu} className="flex min-h-12 items-center px-1 text-base font-medium text-zinc-200 transition hover:text-orange-200">
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="mt-8 border-t border-white/[0.07] pt-5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Your workspace</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
              <Link href="/auth/signin" onClick={closeMenu} className="rounded-full border border-white/[0.14] px-4 py-3 text-center text-sm text-zinc-200">Sign in</Link>
              <Link href="/download" onClick={closeMenu} className="rounded-full bg-white px-4 py-3 text-center text-sm font-medium text-black">Download</Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
