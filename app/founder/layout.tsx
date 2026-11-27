import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { founderContext } from "@/lib/founder/founderAccess";

export const metadata: Metadata = { title: "Founder console · V19", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Private founder console. Anyone who is not the founder gets an ordinary 404, so the path reveals nothing. */
export default async function FounderLayout({ children }: { children: React.ReactNode }) {
  const founder = await founderContext();
  if (!founder) notFound();
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <header className="flex items-center gap-4 border-b border-white/8 px-5 py-3">
        <Link href="/founder" className="text-sm font-medium tracking-tight">V19 Founder</Link>
        <nav aria-label="Founder" className="flex gap-3 text-xs text-zinc-400"><Link href="/founder" className="hover:text-white">Company today</Link><Link href="/founder/blueprint" className="hover:text-white">Operations map</Link><Link href="/control" className="hover:text-white">Cockpit</Link></nav>
        <span className="ml-auto text-xs text-zinc-500">{founder.email}</span>
      </header>
      <main className="px-5 py-4">{children}</main>
    </div>
  );
}
