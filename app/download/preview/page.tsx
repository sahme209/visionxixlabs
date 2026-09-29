import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeftIcon, EnvelopeIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { readDesktopRuntimeReadiness } from "@/lib/desktop/desktopRuntimeReadiness";

export const metadata: Metadata = {
  title: "Installer availability — Axiom Agent",
  description: "Check the current release manifest and platform-specific installer status for Axiom Agent.",
};

interface DownloadPreviewPageProps {
  searchParams: Promise<{ reason?: string }>;
}

export default async function DownloadPreviewPage({ searchParams }: DownloadPreviewPageProps) {
  const { reason } = await searchParams;
  const runtimeUnavailable = reason === "runtime";
  if (runtimeUnavailable && (await readDesktopRuntimeReadiness()).ready) {
    redirect("/download?status=recovered");
  }

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6 md:pt-36">
        <p className="text-[10px] font-mono uppercase tracking-[0.24em] text-amber-300">Installer availability</p>
        <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] md:text-5xl">
          {runtimeUnavailable ? "Desktop downloads are temporarily paused." : "No verified installer was selected."}
        </h1>
        <p className="mt-5 text-base leading-relaxed text-zinc-400">
          {runtimeUnavailable
            ? "Installers have been built, but new desktop sign-in is unavailable while production storage is being prepared. Downloads will resume only after the complete sign-in and entitlement path is verified."
            : "This page is the honest fallback when the release manifest has no matching platform asset. It does not substitute a browser product, source archive, waitlist, or promised release date."}
        </p>
        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-6">
          <div className="flex items-center gap-3">
            <ShieldCheckIcon className="h-5 w-5 text-amber-300" />
            <h2 className="font-semibold">{runtimeUnavailable ? "Why the download is paused" : "Check the current release first"}</h2>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-zinc-300">
            {runtimeUnavailable
              ? "Publishing an installer is not enough: account pairing, access entitlement, and the first authenticated request must also work. The website now fails closed when that service path cannot be verified."
              : "The downloads page reads the public release manifest and shows the exact filename, architecture, signing state, installation friction, checksum availability, and release record for each asset."}
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/download" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-zinc-950">
            <ArrowLeftIcon className="h-4 w-4" /> Return to downloads
          </Link>
          <a href="mailto:support@visionxixlabs.com" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-5 py-3 text-sm text-zinc-200 hover:bg-white/[0.05]">
            <EnvelopeIcon className="h-4 w-4" /> Contact support
          </a>
        </div>
      </main>
      <Footer />
    </div>
  );
}
