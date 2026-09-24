import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
    title: "Access TAURI — Web Application",
    description: "TAURI is currently delivered as an authenticated web application.",
};

export default function AccessPage() {
    return (
        <div className="min-h-screen bg-[#09090b] text-white">
            <Navigation />
            <main className="px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
                <div className="mx-auto max-w-3xl">
                    <p className="font-mono text-xs uppercase tracking-[0.22em] text-violet-300">Product access</p>
                    <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">TAURI is a web application.</h1>
                    <p className="mt-6 text-lg leading-8 text-zinc-300">
                        Customers access TAURI through an authenticated browser workspace. There is no verified current desktop installer offered for customer use.
                    </p>
                    <div className="mt-9 flex flex-wrap gap-3">
                        <Link href="/auth/signup?redirect=/dashboard" className="rounded-full bg-violet-500 px-6 py-3 text-sm font-semibold hover:bg-violet-400">Create a workspace</Link>
                        <Link href="/auth/signin" className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold hover:bg-white/5">Sign in</Link>
                        <Link href="/demo" className="rounded-full border border-sky-500/30 px-6 py-3 text-sm font-semibold text-sky-200 hover:bg-sky-500/10">Try the fictional sandbox</Link>
                    </div>
                    <section className="mt-14 rounded-2xl border border-amber-500/25 bg-amber-500/[0.06] p-6">
                        <h2 className="font-semibold text-amber-100">Desktop status</h2>
                        <p className="mt-2 text-sm leading-6 text-amber-100/75">
                            The repository contains a Tauri shell and historical unsigned developer artifacts. They are not current with the web product and have not been verified as a supported customer release, so download links are intentionally withheld.
                        </p>
                    </section>
                    <section className="mt-8 rounded-2xl border border-white/[0.08] p-6">
                        <h2 className="font-semibold">Need procurement or deployment help?</h2>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">Contact the team for workspace setup, security review, and integration scoping. We will distinguish available features from sandbox and roadmap work.</p>
                        <Link href="/contact" className="mt-4 inline-block text-sm font-semibold text-violet-300 hover:text-violet-200">Contact Vision XIX Labs →</Link>
                    </section>
                </div>
            </main>
            <Footer />
        </div>
    );
}
