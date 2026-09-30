"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRightIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronDownIcon,
  StarIcon,
  CpuChipIcon,
  CloudIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,
  PuzzlePieceIcon,
  RocketLaunchIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";

/* ── Dropdown items ──────────────────────────────────────────── */
const productDropdown = [
  { href: "/axiom/releaseops", label: "Deployment operations", desc: "Request-to-playbook workflow", icon: ShieldCheckIcon },
  { href: "/capabilities", label: "Capabilities", desc: "Released, preview, and planned behavior", icon: CpuChipIcon },
  { href: "/integrations", label: "Integrations", desc: "Supported systems and exact connection scope", icon: PuzzlePieceIcon },
  { href: "/demo", label: "Isolated demo", desc: "Explore the workflow with fictional sample data", icon: PlayCircleIcon },
];

const resourcesDropdown = [
  { href: "/docs", label: "Documentation", desc: "Installation, setup, and operating guidance", icon: BookOpenIcon },
  { href: "/security", label: "Security", desc: "Implemented controls and current limitations", icon: ShieldCheckIcon },
  { href: "/changelog", label: "Release notes", desc: "What shipped and what was verified", icon: RocketLaunchIcon },
  { href: "/status", label: "Service status", desc: "Current availability and incidents", icon: CloudIcon },
  { href: "/contact", label: "Contact & support", desc: "Reach the verified business support path", icon: DocumentTextIcon },
];

const mobileLinks = [
  { href: "/axiom/releaseops", label: "Deployment operations", desc: "Request-to-playbook workflow", icon: ShieldCheckIcon },
  { href: "/demo", label: "Isolated demo", desc: "Explore safe synthetic data", icon: PlayCircleIcon },
  { href: "/download", label: "Desktop downloads", desc: "Installers and release status", icon: ArrowDownTrayIcon },
  { href: "/docs", label: "Documentation", desc: "Setup, security, and runbooks", icon: BookOpenIcon },
  { href: "/changelog", label: "What shipped", desc: "Verified product changes", icon: RocketLaunchIcon },
  { href: "/plans", label: "Plans", desc: "Product options", icon: DocumentTextIcon },
];

/* ── Dropdown component ──────────────────────────────────────── */
function NavDropdown({
  label,
  items,
  open,
  onToggle,
  onClose,
}: {
  label: string;
  items: typeof productDropdown;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onClose]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="nav-link-underline relative flex items-center gap-1 px-4 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium"
      >
        {label}
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute top-full left-0 mt-2 w-64 bg-[#09090b]/95 backdrop-blur-xl border border-white/[0.06] rounded-xl shadow-2xl shadow-black/40 p-1.5 z-50"
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-start gap-3 px-4 py-2.5 text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] rounded-lg transition-all duration-200 group/item"
                >
                  <Icon className="h-4 w-4 mt-0.5 text-zinc-500 group-hover/item:text-violet-400 transition-colors shrink-0" />
                  <div>
                    <div className="font-medium text-zinc-300 group-hover/item:text-white transition-colors">
                      {item.label}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">{item.desc}</div>
                  </div>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Main Navigation ─────────────────────────────────────────── */
export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverflow = document.documentElement.style.overflow;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const closeForDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };
    const handleMenuKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        requestAnimationFrame(() => mobileMenuButtonRef.current?.focus());
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = mobileMenuPanelRef.current?.querySelectorAll<HTMLElement>(
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
    document.addEventListener("keydown", handleMenuKeyboard);
    desktopQuery.addEventListener("change", closeForDesktop);
    requestAnimationFrame(() => {
      mobileMenuPanelRef.current?.querySelector<HTMLElement>("a[href]")?.focus();
    });

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousRootOverflow;
      document.removeEventListener("keydown", handleMenuKeyboard);
      desktopQuery.removeEventListener("change", closeForDesktop);
    };
  }, [mobileMenuOpen]);

  return (
    <nav
      aria-label="Primary navigation"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#09090b]/90 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-10">
        <div className="flex h-16 items-center justify-between lg:h-[72px]">
          {/* Logo with hover scale */}
          <Link
            href="/"
            className="flex items-center space-x-3 group shrink-0 transition-transform duration-200 hover:scale-[1.02]"
          >
            <Image
              src="/vision-xix-logo.png"
              alt="Vision XIX Labs"
              width={34}
              height={34}
              className="rounded-xl shadow-lg group-hover:shadow-violet-500/20 transition-shadow"
              priority
            />
            <span className="text-lg font-semibold tracking-[-0.025em] text-zinc-100 transition-colors group-hover:text-white">
              Vision XIX Labs
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 lg:flex">
            {/* Product dropdown */}
            <NavDropdown
              label="Product"
              items={productDropdown}
              open={openDropdown === "product"}
              onToggle={() =>
                setOpenDropdown(openDropdown === "product" ? null : "product")
              }
              onClose={() => setOpenDropdown(null)}
            />

            {/* Resources dropdown */}
            <NavDropdown
              label="Resources"
              items={resourcesDropdown}
              open={openDropdown === "resources"}
              onToggle={() =>
                setOpenDropdown(
                  openDropdown === "resources" ? null : "resources"
                )
              }
              onClose={() => setOpenDropdown(null)}
            />

            {/* Pricing — the only standalone middle nav link. */}
            <Link
              href="/plans"
              className="nav-link-underline relative px-4 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium"
            >
              Pricing
            </Link>

            {/* Focused action cluster: isolated demo and desktop download. */}
            <div className="ml-3 flex items-center gap-2 border-l border-white/[0.07] pl-4">
              <Link
                href="/demo"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/[0.09] bg-white/[0.025] px-4 py-2 text-sm font-medium tracking-tight text-zinc-200 transition-all hover:border-brand-coral/30 hover:bg-brand-coral/[0.07]"
              >
                <PlayCircleIcon className="h-4 w-4 text-brand-coral" />
                Demo
              </Link>
              <Link
                href="/download"
                className="btn-press inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-full px-5 py-2 text-sm font-semibold tracking-tight"
              >
                Download
                <ArrowRightIcon className="h-3.5 w-3.5 shrink-0" />
              </Link>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={mobileMenuButtonRef}
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation-panel"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-zinc-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-coral/70 lg:hidden"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Mobile menu with slide animation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              ref={mobileMenuPanelRef}
              id="mobile-navigation-panel"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="fixed inset-x-0 bottom-0 top-16 overflow-y-auto overscroll-contain border-t border-white/[0.06] bg-[#09090b]/98 shadow-2xl backdrop-blur-xl lg:hidden"
            >
              <div className="mx-auto max-w-md px-4 pt-5 pb-[max(2rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-col" aria-label="Mobile navigation links">
                  <p className="px-1 text-[11px] font-mono uppercase tracking-[0.18em] text-zinc-500">
                    Axiom desktop workspace
                  </p>
                  <Link
                    href="/download"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-3 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    Get the desktop app
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>

                  <div className="mt-5 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
                  {mobileLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex min-h-[60px] items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-zinc-200 transition-colors last:border-b-0 hover:bg-white/[0.05]"
                    >
                      <item.icon className="h-5 w-5 shrink-0 text-brand-coral" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-white">{item.label}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">{item.desc}</span>
                      </span>
                    </Link>
                  ))}
                  </div>

                  <a
                    href="https://github.com/sahme209/axiom-releases"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-5 inline-flex min-h-11 items-center gap-2 self-center px-4 text-sm font-medium text-zinc-400 hover:text-white"
                  >
                    <StarIcon className="h-4 w-4" />
                    Release repository
                  </a>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
