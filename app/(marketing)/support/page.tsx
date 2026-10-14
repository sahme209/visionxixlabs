import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownIcon, ArrowRightIcon, BeakerIcon, BoltIcon, CheckIcon, CircleStackIcon, CodeBracketIcon, EnvelopeIcon, ScaleIcon, ShieldCheckIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { CinematicAxiomDemo } from "@/components/marketing/CinematicAxiomDemo";
import { SponsorInquiryForm } from "@/components/support/SponsorInquiryForm";
import { SupporterCheckout } from "@/components/support/SupporterCheckout";
import { supporterCheckoutReadiness } from "@/lib/supporters/core";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Axiom Founding Supporters",
  description: "Support the careful development of Axiom Agent—autonomous engineering with human control, security, and governance at its core.",
  alternates: { canonical: "/support" },
  openGraph: {
    title: "Axiom Founding Supporters | Vision XIX Labs",
    description: "Support the careful development of Axiom Agent—autonomous engineering with human control, security, and governance at its core.",
    url: "/support",
  },
};

const fundingAreas = [
  { icon: CodeBracketIcon, title: "AI engineering", copy: "Product research and implementation for useful, context-aware engineering assistance." },
  { icon: ShieldCheckIcon, title: "Security & governance", copy: "Authorization boundaries, approval controls, audit evidence, and safer operating patterns." },
  { icon: BoltIcon, title: "Autonomous workflows", copy: "Carefully scoped orchestration that can coordinate work while preserving human authority." },
  { icon: BeakerIcon, title: "Infrastructure & testing", copy: "Reliable environments, evaluations, regression coverage, and operational validation." },
  { icon: SparklesIcon, title: "Broader access", copy: "Work that makes the platform practical for more engineering teams and use cases." },
];

const implemented = [
  "Repository-scoped context and evidence",
  "Explicit approval gates for proposed writes",
  "Scripted product demonstrations that touch no live systems",
  "Auditable workflow and validation concepts in the Axiom experience",
];

const planned = [
  "Expanded governed workflow coverage",
  "Deeper security and evaluation systems",
  "Additional engineering-tool integrations",
  "More accessible paths for teams adopting autonomous operations",
];

export default function SupportPage() {
  const checkout = supporterCheckoutReadiness();
  return (
    <div className="overflow-hidden bg-[#141414]">
      <section className="relative isolate min-h-[82vh] border-b border-white/[0.07]">
        <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_15%,rgba(249,115,22,0.13),transparent_30%),radial-gradient(circle_at_15%_80%,rgba(255,255,255,0.04),transparent_32%)]" />
        <div aria-hidden="true" className="absolute inset-0 -z-10 opacity-[0.14] [background-image:linear-gradient(rgba(255,255,255,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.09)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <div className="mx-auto flex min-h-[82vh] max-w-[1400px] flex-col justify-between px-5 pb-10 pt-24 sm:px-8 lg:px-12 lg:pb-14 lg:pt-32">
          <div className="grid items-end gap-12 lg:grid-cols-[1fr_360px]">
            <div className="max-w-5xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-orange-300">Axiom Founding Supporters · Vision XIX Labs</p>
              <h1 className="mt-6 text-[clamp(3.5rem,8.5vw,8.8rem)] font-medium leading-[0.86] tracking-[-0.07em] text-zinc-50">
                Help build the future of <span className="text-zinc-500">autonomous engineering.</span>
              </h1>
            </div>
            <div className="pb-2">
              <p className="text-lg leading-8 text-zinc-300">We’re building Axiom Agent to make complex engineering operations more autonomous, secure, and accessible—without sacrificing human control.</p>
              <a href="#vision" className="mt-7 inline-flex min-h-12 items-center gap-3 rounded-full border border-white/15 px-5 text-sm font-medium text-zinc-100 transition hover:border-orange-300/40 hover:bg-white/[0.04]">Explore the vision <ArrowDownIcon className="h-4 w-4" /></a>
            </div>
          </div>
          <div className="mt-16 flex flex-wrap items-center justify-between gap-5 border-t border-white/[0.09] pt-6 text-xs text-zinc-500">
            <span>Built by Vision XIX Labs LLC</span><span>Human authority · Governed execution · Verifiable outcomes</span>
          </div>
        </div>
      </section>

      <section id="vision" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.75fr_1.25fr]">
          <div><p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">The thesis</p><h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.05em] text-zinc-100 sm:text-6xl">Autonomy should increase capability—not remove accountability.</h2></div>
          <div className="grid gap-8 border-l border-white/[0.08] pl-6 sm:pl-10">
            <p className="max-w-2xl text-xl leading-9 text-zinc-300">Axiom is an engineering operations agent designed around context, authorization, approvals, execution, and evidence. The website carries governance and administration; the desktop app is the engineering workspace; the backend enforces authority and executes approved work.</p>
            <p className="max-w-2xl leading-7 text-zinc-500">That separation is deliberate. Support for this program funds development without changing product billing, AI credits, or the controls that protect operational workflows.</p>
          </div>
        </div>
      </section>

      <div className="border-y border-white/[0.07] bg-[#11110f]">
        <CinematicAxiomDemo />
      </div>

      <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-12 lg:grid-cols-2">
          <CapabilityList eyebrow="Implemented today" title="What the demonstration represents" items={implemented} tone="implemented" />
          <CapabilityList eyebrow="Development direction" title="What support helps us advance" items={planned} tone="planned" />
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-6 text-zinc-500">The interactive tour uses scripted sample data. Planned items describe development direction, not promised release dates or guaranteed outcomes.</p>
      </section>

      <section className="border-y border-white/[0.07] bg-[#10100f]">
        <div className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="max-w-3xl"><p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">Why support matters</p><h2 className="mt-5 text-4xl font-medium tracking-[-0.05em] text-zinc-100 sm:text-6xl">Fund the difficult work behind trustworthy autonomy.</h2><p className="mt-6 text-lg leading-8 text-zinc-400">Supporter purchases help Vision XIX Labs invest in the engineering foundations required to make Axiom useful, governed, and durable.</p></div>
          <div className="mt-14 grid border-l border-t border-white/[0.08] sm:grid-cols-2 lg:grid-cols-5">
            {fundingAreas.map(({ icon: Icon, title, copy }) => <article key={title} className="min-h-64 border-b border-r border-white/[0.08] p-6"><Icon className="h-6 w-6 text-orange-300" /><h3 className="mt-12 text-lg font-medium text-zinc-100">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section id="join" className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-32">
        <div className="grid gap-14 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">Founding Supporters</p>
            <h2 className="mt-5 text-4xl font-medium tracking-[-0.05em] text-zinc-100 sm:text-6xl">Take part in Axiom’s beginning.</h2>
            <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">Make a one-time digital supporter purchase at the level that is right for you. Suggested amounts are simply starting points; purchases begin at $1.</p>
            <div className="mt-10 space-y-5">
              <Benefit title="A digital Founding Supporter badge" copy="A personalized, downloadable badge delivered after Stripe confirms payment." />
              <Benefit title="Development updates" copy="Opt in to occasional, substantive updates about Axiom’s progress. Unsubscribe whenever you choose." />
              <Benefit title="Recognition—with consent" copy="Choose whether and how your name may appear in future supporter recognition. Private is the default." />
            </div>
          </div>
          <SupporterCheckout enabled={checkout.ready} unavailableReason={checkout.reason} />
        </div>
      </section>

      <section id="sponsorship" className="border-y border-white/[0.08] bg-[radial-gradient(circle_at_10%_0%,rgba(249,115,22,.10),transparent_34%),#10100f]">
        <div className="mx-auto grid max-w-[1400px] gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-28">
          <div><p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">Strategic sponsorship</p><h2 className="mt-5 text-4xl font-medium leading-tight tracking-[-0.05em] text-zinc-100 sm:text-6xl">Partner with us to advance autonomous engineering.</h2><p className="mt-6 max-w-xl text-lg leading-8 text-zinc-400">For individuals, foundations, and organizations considering a substantial commitment, begin with a private, professional conversation about fit, scope, and appropriate payment arrangements.</p><div className="mt-8 flex items-center gap-3 text-sm text-zinc-500"><ScaleIcon className="h-5 w-5 text-orange-300" /> Sponsorship is not equity, an investment, or a charitable contribution.</div></div>
          <div className="rounded-3xl border border-white/[0.1] bg-[#1a1a18] p-5 sm:p-8"><SponsorInquiryForm /></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div><p className="text-[11px] uppercase tracking-[0.2em] text-orange-300">Trust & transparency</p><h2 className="mt-5 text-4xl font-medium tracking-[-0.05em] text-zinc-100">Know what participation means.</h2></div>
          <div className="grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] sm:grid-cols-2">
            <TrustCard icon={CircleStackIcon} title="The company" copy="Vision XIX Labs LLC is a for-profit technology company developing Axiom Agent." />
            <TrustCard icon={ShieldCheckIcon} title="The payment boundary" copy="Stripe-hosted checkout handles card data. Vision XIX Labs does not store card numbers." />
            <TrustCard icon={ScaleIcon} title="The legal character" copy="Supporter purchases are not charitable donations, tax-deductible charitable gifts, investments, equity, or promises of returns." />
            <TrustCard icon={EnvelopeIcon} title="Accountability" copy="Questions, receipt help, and refund requests can be sent to support@visionxixlabs.com. Founder identity will be published here only after the profile is verified and approved." />
          </div>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-500"><Link href="/privacy" className="hover:text-zinc-200">Privacy policy</Link><Link href="/terms" className="hover:text-zinc-200">Terms</Link><Link href="/security" className="hover:text-zinc-200">Security</Link><a href="mailto:support@visionxixlabs.com" className="hover:text-zinc-200">support@visionxixlabs.com</a><Link href="/contact" className="inline-flex items-center gap-2 text-orange-300 hover:text-orange-200">Contact Vision XIX Labs <ArrowRightIcon className="h-4 w-4" /></Link></div>
      </section>
    </div>
  );
}

function CapabilityList({ eyebrow, title, items, tone }: { eyebrow: string; title: string; items: readonly string[]; tone: "implemented" | "planned" }) {
  return <article className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-8"><p className={`text-[11px] uppercase tracking-[0.18em] ${tone === "implemented" ? "text-emerald-300" : "text-orange-300"}`}>{eyebrow}</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-zinc-100">{title}</h3><ul className="mt-7 space-y-4">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-400"><span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${tone === "implemented" ? "bg-emerald-400/10 text-emerald-300" : "bg-orange-400/10 text-orange-300"}`}><CheckIcon className="h-3 w-3" /></span>{item}</li>)}</ul></article>;
}

function Benefit({ title, copy }: { title: string; copy: string }) {
  return <div className="flex gap-4"><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-300/20 bg-orange-400/[0.07] text-xs font-semibold text-orange-200">✓</span><div><h3 className="font-medium text-zinc-200">{title}</h3><p className="mt-1 max-w-lg text-sm leading-6 text-zinc-500">{copy}</p></div></div>;
}

function TrustCard({ icon: Icon, title, copy }: { icon: typeof ShieldCheckIcon; title: string; copy: string }) {
  return <article className="bg-[#171715] p-6 sm:p-8"><Icon className="h-6 w-6 text-orange-300" /><h3 className="mt-8 text-lg font-medium text-zinc-100">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{copy}</p></article>;
}
