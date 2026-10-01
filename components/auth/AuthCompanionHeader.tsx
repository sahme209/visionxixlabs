"use client";

import Link from "next/link";
import { ArrowRightOnRectangleIcon } from "@heroicons/react/24/outline";
import { signOut } from "next-auth/react";

export function AuthCompanionHeader({ email }: { email: string | null }) {
  return (
    <header className="flex flex-col gap-4 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:pb-6">
      <Link href="/" className="text-sm font-semibold tracking-[-0.02em] text-zinc-100">Vision XIX Labs</Link>
      <nav aria-label="Signed-in companion navigation" className="flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-zinc-400">
        <Link href="/auth/success" className="text-zinc-100">Overview</Link>
        <Link href="/integrations" className="hover:text-white">Integrations</Link>
        <Link href="/account" className="hover:text-white">Settings</Link>
        <Link href="/docs" className="hover:text-white">Help</Link>
        <span className="hidden h-4 w-px bg-white/[0.08] sm:block" aria-hidden />
        <span className="max-w-[13rem] truncate text-zinc-500" title={email ?? undefined}>{email}</span>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/[0.1] px-3 text-xs text-zinc-300 transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
          Sign out
        </button>
      </nav>
    </header>
  );
}
