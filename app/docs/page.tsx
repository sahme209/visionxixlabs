import type { Metadata } from "next";
import Link from "next/link";
import { integrationInventory, tauriCapabilities } from "@/lib/product/tauriCapabilityInventory";

export const metadata: Metadata = {
  title: "TAURI product guide",
  description: "Verified TAURI capabilities, access paths, sandbox boundaries, and connector status.",
};

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-20 text-zinc-100">
      <div className="mx-auto max-w-5xl space-y-12">
        <header className="max-w-3xl space-y-4">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-violet-300">TAURI product guide</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">What customers can use today</h1>
          <p className="text-base leading-relaxed text-zinc-400">
            TAURI is a web application. Production workspaces use tenant-scoped records. The deployment walkthrough is a labeled, in-browser sandbox with fictional data and no production execution.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/signup?redirect=/dashboard" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950">Create a web workspace</Link>
            <Link href="/demo" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Open sandbox</Link>
            <Link href="/contact" className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold">Contact</Link>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Capability inventory</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {tauriCapabilities.map((item) => (
              <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="font-mono text-[10px] uppercase tracking-wider text-violet-300">{item.state.replaceAll("_", " ")}</p>
                <h3 className="mt-2 font-semibold">{item.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">{item.publicDescription}</p>
                <p className="mt-3 text-xs leading-relaxed text-zinc-500">Limit: {item.limitation}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold">Integrations</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-white/[0.04] text-zinc-300"><tr><th className="p-4">Integration</th><th className="p-4">State</th><th className="p-4">Customer boundary</th></tr></thead>
              <tbody>
                {integrationInventory.map((item) => (
                  <tr key={item.name} className="border-t border-white/10"><td className="p-4 font-medium">{item.name}</td><td className="p-4 text-zinc-300">{item.level}</td><td className="p-4 text-zinc-400">{item.note}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.05] p-5 text-sm leading-relaxed text-amber-100/80">
          No verified current desktop installer is offered. Historical developer artifacts are not a supported customer distribution channel.
        </aside>
      </div>
    </main>
  );
}
