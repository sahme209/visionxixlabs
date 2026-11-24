import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";
import { PageHero } from "@/components/marketing/PageHero";

export const metadata: Metadata = {
  title: "V19 resources",
  description: "Practical guidance for a governed deployment workflow, desktop installation, and security boundaries.",
};

const GUIDES = [
  { eyebrow: "Start here", title: "A calm first release", detail: "How to install V19, sign in, and keep a deployment request complete before review.", href: "/docs/getting-started" },
  { eyebrow: "Workflow", title: "Release operations", detail: "A clear model for readiness, human approval, validation, recovery, and auditable closure.", href: "/docs/releaseops" },
  { eyebrow: "Trust", title: "Security boundaries", detail: "What is scoped per tenant, what is read-only, and why a connection is not treated as live before validation.", href: "/docs/security-model" },
  { eyebrow: "Desktop", title: "Install V19", detail: "Platform installation guidance for the operational workspace.", href: "/docs/desktop-install" },
  { eyebrow: "Recovery", title: "Troubleshoot an issue", detail: "Find steps for sign-in, installation, and workflow problems.", href: "/docs/troubleshooting" },
];

export default function ResourcesPage() {
  return (
    <div className="axiom-canvas min-h-screen text-zinc-100">
      <Navigation />
      <main className="mx-auto max-w-[1240px] px-5 pb-20 pt-32 sm:px-10 lg:pb-28">
        <PageHero
          eyebrow="V19 resources"
          title="Guidance for the release"
          muted="you can explain."
          lead="Practical notes for running a governed deployment workflow. The guides describe what is available now and keep planned connections clearly separate from verified ones."
        />
        <section className="py-16 lg:py-24"><div className="grid gap-3 md:grid-cols-2">{GUIDES.map((guide) => <Link key={guide.href} href={guide.href} prefetch={false} className="group rounded-xl border border-white/8 bg-[var(--public-surface)] p-6 transition hover:border-white/17 hover:bg-white/4.5 sm:p-7"><p className="mono-label"><span className="text-zinc-400">{guide.eyebrow}</span></p><h2 className="mt-8 text-xl font-medium tracking-[-0.03em] text-zinc-100">{guide.title}</h2><p className="mt-3 max-w-md text-sm leading-6 text-zinc-400">{guide.detail}</p><span className="mt-7 inline-block text-sm text-zinc-300 transition group-hover:text-white">Read guide →</span></Link>)}</div></section>
        <section className="border-t border-white/[0.07] py-16"><div className="mx-auto flex max-w-[1240px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mono-label"><span className="text-zinc-400">What is changing</span></p><h2 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-zinc-100">Find desktop updates and release notes.</h2></div><Link href="/docs/desktop-install#updates" prefetch={false} className="shrink-0 rounded-lg border border-white/[0.14] px-5 py-3 text-center text-sm text-zinc-200 transition hover:bg-white/6">Desktop updates</Link></div></section>
      </main>
      <Footer />
    </div>
  );
}
