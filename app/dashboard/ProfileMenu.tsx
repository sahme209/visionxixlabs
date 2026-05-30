"use client";

/**
 * Operator profile dropdown — replaces the lonely sign-out button in
 * the topbar. Click the email pill, get a calm panel with Settings,
 * Integrations, Connection diagnostic, and Sign out.
 *
 * Closes on outside click and on route change. Calm-rule styled —
 * one tone, no decorative gradient.
 */

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Cog6ToothIcon,
  PuzzlePieceIcon,
  WrenchScrewdriverIcon,
  ArrowRightOnRectangleIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";

export function ProfileMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // Close on outside click.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  // Close on route change.
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-200 transition-colors"
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="hidden sm:inline max-w-[180px] truncate">{email}</span>
        <ChevronDownIcon className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 rounded-xl border border-white/[0.08] bg-[#0c0c0e] shadow-xl overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-white/[0.04]">
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-zinc-500">signed in</p>
            <p className="text-[12px] text-zinc-200 truncate">{email}</p>
          </div>
          <ul className="py-1">
            <MenuRow href="/dashboard/settings/notifications" icon={Cog6ToothIcon} label="Notification settings" />
            <MenuRow href="/dashboard/integrations" icon={PuzzlePieceIcon} label="Integrations" />
            <MenuRow href="/api/admin/diag/connect-flow" icon={WrenchScrewdriverIcon} label="Connection diagnostic" external />
          </ul>
          <div className="border-t border-white/[0.04] py-1">
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="w-full flex items-center gap-2 px-4 py-2 text-[12px] text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors text-left"
            >
              <ArrowRightOnRectangleIcon className="h-3.5 w-3.5 text-zinc-500" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRow({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string;
  icon: typeof Cog6ToothIcon;
  label: string;
  external?: boolean;
}) {
  const className = "w-full flex items-center gap-2 px-4 py-2 text-[12px] text-zinc-300 hover:bg-white/[0.04] hover:text-white transition-colors";
  if (external) {
    return (
      <li>
        <a href={href} target="_blank" rel="noreferrer" className={className} role="menuitem">
          <Icon className="h-3.5 w-3.5 text-zinc-500" />
          {label}
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className={className} role="menuitem">
        <Icon className="h-3.5 w-3.5 text-zinc-500" />
        {label}
      </Link>
    </li>
  );
}
