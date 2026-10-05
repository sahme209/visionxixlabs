import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navigation } from "@/components/Navigation";

export const metadata: Metadata = {
  title: "Axiom Agent resources",
  description: "Practical guidance for a governed deployment workflow, desktop installation, and security boundaries.",
};

const GUIDES = [
  { eyebrow: "Start here", title: "A calm first release", detail: "How to install Axiom Agent, sign in, and keep a deployment request complete before review.", href: "/docs/getting-started" },
  { eyebrow: "Workflow", title: "Release operations", detail: "A clear model for readiness, human approval, validation, recovery, and auditable closure.", href: "/docs/releaseops" },
  { eyebrow: "Trust", title: "Security boundaries", detail: "What is scoped per tenant, what is read-only, and why a connection is not treated as live before validation.", href: "/docs/security-model" },
  { eyebrow: "Desktop", title: "Install Axiom Agent", detail: "Platform installation guidance for the operational workspace.", href: "/docs/desktop-install" },
];

export default function ResourcesPage() {
  return (
    <div className="axiom-canvas min-h-screen text-zinc-100">
      <Navigation />
      <main className="pt-16">
        <section className="relative isolate overflow-hidden border-b border-white/[0.07] px-5 pb-20 pt-20 sm:px-8 sm:pt-28 lg:px-12 lg:pb-28">
          <Image src="/images/axiom-validation-landscape-v1.png" alt="" fill priority sizes="100vw" className="-z-20 object-cover opacity-40" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(10,11,10,0.65),#0c0d0c_86%)]" />
          <div className="mx-auto max-w-[1400px]"><p className="mono-label"><span className="text-emerald-200">Axiom Agent resources</span></p><h1 className="mt-5 max-w-3xl text-[clamp(2.8rem,5.2vw,5.6rem)] font-medium leading-[0.96] tracking-[-0.058em] text-zinc-100">Guidance for the release you can explain.</h1><p className="mt-6 max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg">Practical notes for running a governed deployment workflow. The guides describe what is available now and keep planned connections clearly separate from verified ones.</p></div>
        </section>
        <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:py-28"><div className="grid gap-3 md:grid-cols-2">{GUIDES.map((guide) => <Link key={guide.href} href={guide.href} className="group rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition hover:border-white/[0.17] hover:bg-white/[0.045] sm:p-7"><p className="mono-label"><span className="text-violet-300">{guide.eyebrow}</span></p><h2 className="mt-8 text-xl font-medium tracking-[-0.03em] text-zinc-100">{guide.title}</h2><p className="mt-3 max-w-md text-sm leading-6 text-zinc-500">{guide.detail}</p><span className="mt-7 inline-block text-sm text-zinc-300 transition group-hover:text-white">Read guide →</span></Link>)}</div></section>
        <section className="border-t border-white/[0.07] bg-[#11120f] px-5 py-16 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1400px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="mono-label"><span className="text-orange-200">What is changing</span></p><h2 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-zinc-100">Follow the product as it becomes more capable.</h2></div><Link href="/changelog" className="shrink-0 rounded-full border border-white/[0.14] px-5 py-3 text-center text-sm text-zinc-200 transition hover:bg-white/[0.06]">Read the changelog</Link></div></section>
      </main>
      <Footer />
    </div>
  );
}
