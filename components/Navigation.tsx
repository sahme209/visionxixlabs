"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

const links = [
    { href: "/#workflow", label: "Workflow" },
    { href: "/#capabilities", label: "Capabilities" },
    { href: "/#integrations", label: "Integrations" },
    { href: "/demo", label: "Sandbox demo" },
    { href: "/docs", label: "Docs" },
    { href: "/plans", label: "Access" },
] as const;

export function Navigation() {
    const [open, setOpen] = useState(false);

    return (
        <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#09090b]/95 backdrop-blur-xl" aria-label="Primary navigation">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
                    <Image src="/vision-xix-logo.png" alt="Vision XIX Labs" width={32} height={32} className="rounded-lg" priority />
                    <span className="font-semibold">TAURI</span>
                    <span className="hidden text-xs text-zinc-500 sm:inline">by Vision XIX Labs</span>
                </Link>

                <div className="hidden items-center gap-6 md:flex">
                    {links.map((link) => <Link key={link.href} href={link.href} className="text-sm text-zinc-400 hover:text-white">{link.label}</Link>)}
                    <Link href="/auth/signin" className="text-sm text-zinc-300 hover:text-white">Sign in</Link>
                    <Link href="/auth/signup?redirect=/dashboard" className="rounded-full bg-violet-500 px-4 py-2 text-sm font-semibold hover:bg-violet-400">Open web app</Link>
                </div>

                <button type="button" className="rounded-lg p-2 text-zinc-300 md:hidden" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-label="Toggle navigation">
                    {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
                </button>
            </div>

            {open && (
                <div className="border-t border-white/[0.07] bg-[#09090b] px-4 py-4 md:hidden">
                    <div className="mx-auto flex max-w-7xl flex-col gap-1">
                        {links.map((link) => <Link key={link.href} href={link.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm text-zinc-300 hover:bg-white/5">{link.label}</Link>)}
                        <Link href="/auth/signin" onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 text-sm text-zinc-300 hover:bg-white/5">Sign in</Link>
                        <Link href="/auth/signup?redirect=/dashboard" onClick={() => setOpen(false)} className="mt-2 rounded-lg bg-violet-500 px-3 py-3 text-center text-sm font-semibold">Open web app</Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
