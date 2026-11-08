"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

const primaryLinks = [
  { href: "/product", label: "Product" },
  { href: "/integrations", label: "Integrations" },
  { href: "/security", label: "Security" },
  { href: "/docs", label: "Docs" },
  { href: "/demo", label: "Demo" },
];
const secondaryLinks = [
  { href: "/plans", label: "Get started" },
  { href: "/account/help", label: "Support (account required)" },
  { href: "/status", label: "Status" },
  { href: "/axiom", label: "Company" },
];
const mobileLinks = [
  ...primaryLinks,
  ...secondaryLinks,
  { href: "/support", label: "Founding Supporters" },
];

export function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const homeLinkRef = useRef<HTMLAnchorElement>(null);
  const restoreResponsiveFocus = useRef(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const focusMoreLink = useRef(false);
  const [scrolled, setScrolled] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (restoreResponsiveFocus.current && !mobileMenuOpen && !moreOpen) {
      restoreResponsiveFocus.current = false;
      homeLinkRef.current?.focus();
    }
  }, [mobileMenuOpen, moreOpen]);

  useEffect(() => {
    if (!moreOpen) return;
    if (focusMoreLink.current) {
      moreRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
      focusMoreLink.current = false;
    }
    const outside = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };
    const resize = () => {
      if (window.innerWidth < 1280) {
        restoreResponsiveFocus.current = !!moreRef.current?.contains(document.activeElement);
        setMoreOpen(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", resize);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", resize);
    };
  }, [moreOpen]);

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

    const onOutside = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !menuButtonRef.current?.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    // Match xl navigation visibility: a hidden dialog must not retain focus
    // trapping or scroll locks after a tablet/desktop resize.
    const onResize = () => {
      if (window.innerWidth >= 1280) {
        restoreResponsiveFocus.current = !!menuRef.current?.contains(document.activeElement);
        setMobileMenuOpen(false);
      }
    };
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("resize", onResize);
    onResize();
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutside);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("resize", onResize);
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    requestAnimationFrame(() => menuButtonRef.current?.focus());
  };

  const closeMenu = () => { setMobileMenuOpen(false); setMoreOpen(false); };
  const skipToContent = () => {
    closeMenu();
    const main = document.querySelector<HTMLElement>("main");
    if (!main) return;
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
    main.focus();
  };

  return (
    <nav
      aria-label="Primary navigation"
      className={`site-navigation fixed inset-x-0 top-0 ${mobileMenuOpen ? "z-[10000]" : "z-50"} transition-[background-color,border-color] duration-300 ${
        scrolled
          ? "border-b border-white/[0.09] bg-[#090a08]/88"
          : "border-b border-transparent bg-[#090a08]/62"
      }`}
    >
      {/* Blur only the bar: a backdrop filter on nav would constrain the fixed
          mobile dialog to the bar height instead of the viewport. */}
      <div
        aria-hidden={mobileMenuOpen || undefined}
        inert={mobileMenuOpen}
        className={`mx-auto flex backdrop-blur-xl max-w-[1280px] items-center justify-between px-5 transition-[height] duration-300 sm:px-8 lg:px-10 ${
          scrolled ? "h-14 xl:h-16" : "h-16 xl:h-[72px]"
        }`}
      >
        <button
          type="button"
          onClick={skipToContent}
          className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-3 focus:z-10 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-black focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-orange-300"
        >
          Skip to content
        </button>
        <Link ref={homeLinkRef} href="/" onClick={closeMenu} className="flex items-center gap-2.5 text-sm font-semibold tracking-[-0.02em] text-zinc-100" aria-label="Vision XIX Labs home">
          <Image src="/vision-xix-logo.png" alt="" width={28} height={28} className="object-contain" priority />
          <span>Vision XIX Labs</span>
        </Link>

        <div className="hidden items-center gap-7 xl:flex">
          {primaryLinks.map((item) => (
            <Link key={item.href} href={item.href} onClick={closeMenu} className="text-sm text-zinc-400 transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
          <div ref={moreRef} className="relative" onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMoreOpen(false);
          }}>
            <button ref={moreButtonRef} type="button" aria-expanded={moreOpen} aria-controls="more-navigation"
              className="flex items-center gap-1 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
              onClick={() => setMoreOpen((open) => !open)} onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  if (moreOpen) moreRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
                  else { focusMoreLink.current = true; setMoreOpen(true); }
                }
              }}>More <span aria-hidden="true" className="text-[10px]">⌄</span></button>
            {moreOpen && <div id="more-navigation" role="group" aria-label="More destinations"
              className="absolute right-0 top-full mt-2 min-w-60 rounded-xl border border-white/[0.09] bg-[#11120f] p-2 shadow-xl">
              {secondaryLinks.map((item) => <Link key={item.href} href={item.href} onClick={closeMenu}
                className="block rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/[0.05] hover:text-white">{item.label}</Link>)}
            </div>}
          </div>
        </div>

        <div className="hidden items-center gap-3 xl:flex">
          <Link href="/auth/signin" className="px-2 py-2 text-sm text-zinc-300 transition-colors hover:text-white">Sign in</Link>
          <Link href="/download" className="rounded-lg bg-[#f0f0eb] px-4 py-2 text-sm font-semibold text-[#11120f] transition hover:bg-white">Download</Link>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          aria-label="Open navigation menu"
          onClick={() => { setMoreOpen(false); setMobileMenuOpen((open) => !open); }}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/[0.06] xl:hidden"
        >
          <Bars3Icon className="h-6 w-6" />
        </button>
      </div>

      {mobileMenuOpen && (
        <div
          ref={menuRef}
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          className="fixed inset-0 overflow-y-auto bg-[#090a08] px-5 pb-6 xl:hidden"
        >
          <div className="mx-auto flex max-w-lg flex-col">
            <div className="flex min-h-16 items-center justify-between gap-4 border-b border-white/[0.07]">
              <p className="text-sm font-semibold tracking-[-0.02em] text-zinc-100">Explore Axiom</p>
              <button type="button" aria-label="Close navigation menu" onClick={closeMobileMenu}
                className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-sm text-zinc-300 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300">
                Close <XMarkIcon aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
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
