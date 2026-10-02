"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightOnRectangleIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";

export function AuthCompanionHeader({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuButton = useRef<HTMLButtonElement>(null);
  const navigation = [
    { href: "/auth/success", label: "Overview" },
    { href: "/account/integrations", label: "Integrations" },
    { href: "/account", label: "Settings" },
    { href: "/account/help", label: "Help" },
  ];

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setMobileMenuOpen(false);
      requestAnimationFrame(() => mobileMenuButton.current?.focus());
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  function closeMobileMenu() {
    setMobileMenuOpen(false);
    requestAnimationFrame(() => mobileMenuButton.current?.focus());
  }

  return (
    <header className="rounded-2xl border border-white/[0.08] bg-black/20 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.16)] backdrop-blur-md sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-4">
      <div className="flex items-center justify-between gap-3 sm:justify-start">
        <Link href="/auth/success" className="group inline-flex items-center gap-2.5 px-2 py-1.5 text-zinc-100">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-violet-300/25 bg-violet-300/[0.08] text-[10px] font-semibold text-violet-200">A</span>
          <span>
            <span className="block text-sm font-semibold tracking-[-0.025em]">Axiom</span>
            <span className="block text-[9px] uppercase tracking-[0.16em] text-zinc-500">Web companion</span>
          </span>
        </Link>
        <div className="flex items-center gap-1.5 sm:hidden">
          <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-emerald-200">Pilot</span>
          <button
            ref={mobileMenuButton}
            type="button"
            aria-label={mobileMenuOpen ? "Close companion menu" : "Open companion menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="axiom-companion-menu"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-300 transition hover:bg-white/[0.07]"
          >
            {mobileMenuOpen ? <XMarkIcon className="h-4 w-4" /> : <Bars3Icon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav aria-label="Signed-in companion navigation" className="hidden min-w-0 items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-white/[0.025] p-1 sm:flex">
        {navigation.map((item) => {
          const active = pathname === item.href || (item.href === "/account/help" && pathname.startsWith("/account/help/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs transition ${active ? "bg-white/[0.1] text-white shadow-sm" : "text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden min-w-0 items-center justify-between gap-3 px-1 sm:mt-0 sm:flex sm:justify-end">
        <span className="hidden max-w-[12rem] truncate text-xs text-zinc-500 lg:block" title={email ?? undefined}>{email}</span>
        <span className="hidden rounded-full border border-emerald-400/15 bg-emerald-400/[0.05] px-2 py-1 text-[9px] font-medium uppercase tracking-[0.12em] text-emerald-200 sm:inline">Pilot access</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>

      {mobileMenuOpen && (
        <div id="axiom-companion-menu" className="mt-3 border-t border-white/[0.07] pt-3 sm:hidden">
          <nav aria-label="Signed-in companion navigation" className="grid grid-cols-2 gap-2">
            {navigation.map((item) => {
              const active = pathname === item.href || (item.href === "/account/help" && pathname.startsWith("/account/help/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  onClick={closeMobileMenu}
                  className={`rounded-xl border px-3 py-3 text-sm transition ${active ? "border-violet-300/25 bg-violet-300/[0.09] text-white" : "border-white/[0.07] bg-white/[0.025] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200"}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
            <span className="min-w-0 truncate text-xs text-zinc-500" title={email ?? undefined}>{email ?? "Signed-in workspace"}</span>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
