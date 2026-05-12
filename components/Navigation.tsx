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
  CogIcon,
  CloudIcon,
  SparklesIcon,
  BookOpenIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";

/* ── Dropdown items ──────────────────────────────────────────── */
const productDropdown = [
  { href: "/axiom", label: "Axiom", desc: "Autonomous cloud agent", icon: CpuChipIcon },
  { href: "/axiom/operations", label: "Operations", desc: "Infrastructure workflows", icon: CogIcon },
  { href: "/operator/onboarding", label: "Cloud Operator", desc: "Multi-cloud control plane", icon: CloudIcon },
  { href: "/builder", label: "Website Builder", desc: "AI-powered site engine", icon: SparklesIcon },
];

const resourcesDropdown = [
  { href: "/insights", label: "Insights", desc: "Latest updates and guides", icon: BookOpenIcon },
  { href: "/enterprise-readiness", label: "Enterprise", desc: "Compliance and readiness", icon: DocumentTextIcon },
  { href: "/security", label: "Security", desc: "Trust center and policies", icon: ShieldCheckIcon },
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
        <div className="flex justify-between items-center h-16">
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
            <span className="text-lg font-bold text-gradient">
              Vision XIX Labs
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
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

            {/* Direct links */}
            <Link
              href="/operator/pricing"
              className="nav-link-underline relative px-4 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium"
            >
              Pricing
            </Link>
            <Link
              href="/contact"
              className="nav-link-underline relative px-4 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium"
            >
              Contact
            </Link>

            {/* GitHub star pill */}
            <a
              href="https://github.com/visionxixlabs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 border border-white/[0.08] rounded-full px-3 py-1 text-xs text-zinc-400 hover:text-white hover:border-white/[0.15] transition-all duration-200 ml-2"
            >
              <StarIcon className="h-3.5 w-3.5" />
              GitHub
            </a>

            <div className="w-px h-5 bg-white/[0.08] mx-2" aria-hidden />
            <Link
              href="/auth/signin"
              className="px-4 py-2 text-zinc-400 hover:text-white rounded-lg transition-colors text-sm font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/operator/onboarding"
              className="btn-huly inline-flex items-center gap-2 px-5 py-2.5 bg-white text-zinc-900 rounded-full text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:bg-zinc-100 transition-all ml-2"
            >
              Start Free
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Mobile hamburger */}
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

        {/* Mobile menu with slide animation */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="md:hidden overflow-hidden"
            >
              <div className="py-4 border-t border-white/[0.06] mt-2">
                <div className="flex flex-col space-y-1">
                  <Link
                    href="/operator/onboarding"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mx-4 mb-3 inline-flex items-center justify-center gap-2 px-4 py-3 bg-white text-zinc-900 rounded-full text-sm font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    Start Free
                    <ArrowRightIcon className="h-4 w-4" />
                  </Link>

                  {/* Product section */}
                  <div className="px-4 pt-2 pb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Product
                  </div>
                  {productDropdown.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2.5 text-zinc-400 font-medium hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4 text-zinc-500" />
                      {item.label}
                    </Link>
                  ))}

                  {/* Resources section */}
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    Resources
                  </div>
                  {resourcesDropdown.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="px-4 py-2.5 text-zinc-400 font-medium hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors flex items-center gap-2"
                    >
                      <item.icon className="h-4 w-4 text-zinc-500" />
                      {item.label}
                    </Link>
                  ))}

                  {/* Direct links */}
                  <div className="px-4 pt-3 pb-1 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    More
                  </div>
                  <Link
                    href="/operator/pricing"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2.5 text-zinc-400 font-medium hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
                  >
                    Pricing
                  </Link>
                  <Link
                    href="/contact"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2.5 text-zinc-400 font-medium hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors"
                  >
                    Contact
                  </Link>

                  {/* GitHub */}
                  <a
                    href="https://github.com/visionxixlabs"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileMenuOpen(false)}
                    className="px-4 py-2.5 text-zinc-400 font-medium hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors flex items-center gap-2"
                  >
                    <StarIcon className="h-4 w-4" />
                    GitHub
                  </a>

                  <Link
                    href="/auth/signin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-2 mx-4 inline-flex items-center justify-center px-5 py-2.5 border border-white/[0.12] text-white rounded-lg text-sm font-semibold hover:bg-white/5 transition-colors"
                  >
                    Sign in
                    <ArrowRightIcon className="ml-1.5 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
