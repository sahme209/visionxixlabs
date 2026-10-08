"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

const primaryLinks = [
  { href: "/product", label: "Product" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/plans", label: "Pricing" },
  { href: "/resources", label: "Resources" },
];

const mobileLinks = [
  ...primaryLinks,
  { href: "/integrations", label: "Integrations" },
  { href: "/security", label: "Security" },
  { href: "/status", label: "Status" },
  { href: "/contact", label: "Contact" },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Closes the menu on a route change that didn't go through a link's
    // own onClick (e.g. browser back/forward), not just a click-through.
    setMobileMenuOpen(false);
  }, [pathname]);

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
      className={`fixed inset-x-0 top-0 z-50 backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? "border-b border-white/[0.09] bg-[#0c0d0c]/90 shadow-[0_1px_0_rgba(255,255,255,0.03),0_12px_30px_-20px_rgba(0,0,0,0.8)]"
          : "border-b border-white/[0.06] bg-[#0c0d0c]/95"
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

        <div className="hidden items-center gap-8 lg:flex">
          {primaryLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-zinc-400 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/auth/signin" className="px-2 py-2 text-sm text-zinc-300 transition-colors hover:text-white">Sign in</Link>
          <Link href="/contact" className="rounded-full border border-white/[0.14] px-4 py-2 text-sm text-zinc-200 transition-colors hover:bg-white/[0.06]">Contact</Link>
          <Link href="/download" className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition-colors hover:bg-white">Download</Link>
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
          className={`fixed inset-x-0 bottom-0 overflow-y-auto border-t border-white/[0.06] bg-[#0c0d0c] px-5 py-6 lg:hidden ${scrolled ? "top-14" : "top-16"}`}
        >
          <div className="mx-auto flex max-w-lg flex-col">
            <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Explore Axiom</p>
            <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Primary links">
              {mobileLinks.map((item) => (
                <Link key={item.href} href={item.href} onClick={closeMenu} className="rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3.5 text-sm font-medium text-zinc-200 transition hover:border-violet-300/25 hover:bg-white/[0.06]">
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
