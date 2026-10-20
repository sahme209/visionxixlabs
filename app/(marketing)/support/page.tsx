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
    <div className="public-support-page overflow-hidden">
      <section className="relative isolate border-b border-white/[0.07]">
        <div className="mx-auto max-w-[1280px] px-5 pb-8 pt-16 sm:px-8 sm:pt-24 lg:px-12 lg:pb-10">
          <div className="grid items-end gap-8 lg:grid-cols-[1fr_0.72fr] lg:gap-20">
            <div className="max-w-5xl">
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-400">Axiom Founding Supporters · Vision XIX Labs</p>
              <h1 className="mt-5 text-[clamp(2.75rem,5.8vw,5rem)] font-medium leading-[1.02] tracking-[-0.055em] text-zinc-50">
                Independent engineering.<br /><span className="text-zinc-400">Shared responsibility.</span>
              </h1>
            </div>
            <div className="pb-2">
              <p className="text-base leading-7 text-zinc-300">We’re building Axiom Agent to make complex engineering operations more autonomous, secure, and accessible—without sacrificing human control.</p>
              <a href="#vision" className="mt-5 inline-flex min-h-11 items-center gap-3 text-sm font-medium text-zinc-200 underline decoration-white/25 underline-offset-4 transition hover:decoration-white/60">Explore the vision <ArrowDownIcon className="h-4 w-4" /></a>
            </div>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-5 border-t border-white/[0.09] pt-6 text-xs text-zinc-500">
            <span>Built by Vision XIX Labs LLC</span><span>Human authority · Governed execution · Verifiable outcomes</span>
          </div>
        </div>
      </section>

      <section aria-label="Ways to support Axiom" className="mx-auto grid max-w-[1280px] gap-8 px-5 py-12 sm:px-8 md:grid-cols-2 md:gap-12 lg:px-12 lg:py-16">
        <article className="border-t border-white/10 pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">For individual supporters</p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-zinc-100">Support the work.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">Help fund independent development through a one-time digital supporter purchase. Participation is voluntary; public recognition is your choice.</p>
          <a href="#join" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-zinc-200 underline decoration-white/25 underline-offset-4 hover:decoration-white/60">Become a Founding Supporter <ArrowRightIcon className="h-4 w-4" /></a>
        </article>
        <article className="border-t border-white/10 pt-5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">For AI &amp; technology partners</p>
          <h2 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-zinc-100">Build with us.</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-400">Discuss sponsorship, infrastructure credits, research collaboration, or technical support. Start with a scoped conversation about mutual fit.</p>
          <a href="#sponsorship" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-zinc-200 underline decoration-white/25 underline-offset-4 hover:decoration-white/60">Discuss a partnership <ArrowRightIcon className="h-4 w-4" /></a>
        </article>
        <p className="border-t border-white/[0.07] pt-4 text-xs leading-6 text-zinc-400 md:col-span-2">Vision XIX Labs LLC is a for-profit technology company. Supporter purchases are not tax-deductible charitable gifts.</p>
      </section>

      <section id="vision" className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
          <div><p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">The thesis</p><h2 className="mt-5 text-3xl font-medium leading-[1.12] tracking-[-0.04em] text-zinc-100 sm:text-4xl">Autonomy should increase capability—not remove accountability.</h2></div>
          <div className="grid gap-5 lg:border-l lg:border-white/[0.08] lg:pl-10">
            <p className="max-w-2xl text-lg leading-8 text-zinc-300">Axiom is an engineering operations agent designed around context, authorization, approvals, execution, and evidence. The website carries governance and administration; the desktop app is the engineering workspace; the backend enforces authority and executes approved work.</p>
            <p className="max-w-2xl leading-7 text-zinc-500">That separation is deliberate. Support for this program funds development without changing product billing, AI credits, or the controls that protect operational workflows.</p>
          </div>
        </div>
      </section>

      <div className="border-y border-white/[0.07] bg-white/[0.015]">
        <CinematicAxiomDemo />
      </div>

      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <CapabilityList eyebrow="Implemented today" title="What the demonstration represents" items={implemented} tone="implemented" />
          <CapabilityList eyebrow="Development direction" title="What support helps us advance" items={planned} tone="planned" />
        </div>
        <p className="mt-8 max-w-3xl text-sm leading-6 text-zinc-500">The interactive tour uses scripted sample data. Planned items describe development direction, not promised release dates or guaranteed outcomes.</p>
      </section>

      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="max-w-3xl"><p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Why support matters</p><h2 className="mt-5 text-3xl font-medium leading-[1.12] tracking-[-0.04em] text-zinc-100 sm:text-4xl">Fund the difficult work behind trustworthy autonomy.</h2><p className="mt-6 text-base leading-7 text-zinc-400">Supporter purchases help Vision XIX Labs invest in the engineering foundations required to make Axiom useful, governed, and durable.</p></div>
          <div className="mt-9 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {fundingAreas.map(({ icon: Icon, title, copy }) => <article key={title} className="grid gap-4 py-6 sm:grid-cols-[40px_220px_1fr] sm:items-center"><Icon className="h-5 w-5 text-zinc-400" /><h3 className="text-lg font-medium text-zinc-100">{title}</h3><p className="max-w-2xl text-sm leading-6 text-zinc-500">{copy}</p></article>)}
          </div>
        </div>
      </section>

      <section id="join" className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.86fr_1.14fr] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Founding Supporters</p>
            <h2 className="mt-5 text-3xl font-medium leading-[1.12] tracking-[-0.04em] text-zinc-100 sm:text-4xl">Take part in Axiom’s beginning.</h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-zinc-400">Make a one-time digital supporter purchase at the level that is right for you. Suggested amounts are simply starting points; purchases begin at $1.</p>
            <div className="mt-8 space-y-5">
              <Benefit title="A digital Founding Supporter badge" copy="A personalized, downloadable badge delivered after Stripe confirms payment." />
              <Benefit title="Development updates" copy="Opt in to occasional, substantive updates about Axiom’s progress. Unsubscribe whenever you choose." />
              <Benefit title="Recognition—with consent" copy="Choose whether and how your name may appear in future supporter recognition. Private is the default." />
            </div>
          </div>
          <SupporterCheckout enabled={checkout.ready} unavailableReason={checkout.reason} />
        </div>
      </section>

      <section id="sponsorship" className="border-y border-white/[0.08] bg-white/[0.015]">
        <div className="mx-auto grid max-w-[1280px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-28">
          <div><p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Strategic sponsorship</p><h2 className="mt-5 text-3xl font-medium leading-[1.12] tracking-[-0.04em] text-zinc-100 sm:text-4xl">Partner with us to advance autonomous engineering.</h2><p className="mt-6 max-w-xl text-base leading-7 text-zinc-400">For individuals, foundations, and organizations considering a substantial commitment, begin with a private, professional conversation about fit, scope, and appropriate payment arrangements. AI companies and technology partners can also discuss infrastructure credits, research collaboration, or a defined technical partnership.</p><div className="mt-8 flex items-center gap-3 text-sm text-zinc-500"><ScaleIcon className="h-5 w-5 text-zinc-400" /> Sponsorship is not equity, an investment, or a charitable contribution.</div><p className="mt-4 max-w-xl text-sm leading-6 text-zinc-400">For infrastructure credits or other non-financial proposals, select “Prefer to discuss” in the inquiry form.</p></div>
          <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-5 sm:p-7"><SponsorInquiryForm /></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1280px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div><p className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">Trust & transparency</p><h2 className="mt-5 text-3xl font-medium tracking-[-0.04em] text-zinc-100">Know what participation means.</h2></div>
          <div className="grid border-y border-white/[0.08] sm:grid-cols-2 sm:divide-x sm:divide-white/[0.08]">
            <TrustCard icon={CircleStackIcon} title="The company" copy="Vision XIX Labs LLC is a for-profit technology company developing Axiom Agent." />
            <TrustCard icon={ShieldCheckIcon} title="The payment boundary" copy="Stripe-hosted checkout handles card data. Vision XIX Labs does not store card numbers." />
            <TrustCard icon={ScaleIcon} title="The legal character" copy="Supporter purchases are not charitable donations, tax-deductible charitable gifts, investments, equity, or promises of returns." />
            <TrustCard icon={EnvelopeIcon} title="Accountability" copy="Questions, receipt help, and refund requests can be sent to support@visionxixlabs.com. Founder identity will be published here only after the profile is verified and approved." />
          </div>
        </div>
        <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-500"><Link href="/privacy" className="hover:text-zinc-200">Privacy policy</Link><Link href="/terms" className="hover:text-zinc-200">Terms</Link><Link href="/security" className="hover:text-zinc-200">Security</Link><a href="mailto:support@visionxixlabs.com" className="hover:text-zinc-200">support@visionxixlabs.com</a><Link href="/contact" className="inline-flex items-center gap-2 text-zinc-400 hover:text-zinc-300">Contact Vision XIX Labs <ArrowRightIcon className="h-4 w-4" /></Link></div>
      </section>
    </div>
  );
}

function CapabilityList({ eyebrow, title, items, tone }: { eyebrow: string; title: string; items: readonly string[]; tone: "implemented" | "planned" }) {
  return <article className="border-t border-white/[0.1] pt-7"><p className={`text-[11px] uppercase tracking-[0.18em] ${tone === "implemented" ? "text-emerald-300" : "text-zinc-400"}`}>{eyebrow}</p><h3 className="mt-3 text-2xl font-medium tracking-[-0.035em] text-zinc-100">{title}</h3><ul className="mt-7 space-y-4">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-6 text-zinc-400"><span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center ${tone === "implemented" ? "text-emerald-300" : "text-zinc-400"}`}><CheckIcon className="h-3 w-3" /></span>{item}</li>)}</ul></article>;
}

function Benefit({ title, copy }: { title: string; copy: string }) {
  return <div className="flex gap-4"><span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.025] text-xs font-semibold text-zinc-300">✓</span><div><h3 className="font-medium text-zinc-200">{title}</h3><p className="mt-1 max-w-lg text-sm leading-6 text-zinc-500">{copy}</p></div></div>;
}

function TrustCard({ icon: Icon, title, copy }: { icon: typeof ShieldCheckIcon; title: string; copy: string }) {
  return <article className="border-b border-white/[0.08] py-7 sm:px-8 sm:first:pl-0"><Icon className="h-5 w-5 text-zinc-400" /><h3 className="mt-6 text-lg font-medium text-zinc-100">{title}</h3><p className="mt-3 text-sm leading-6 text-zinc-500">{copy}</p></article>;
}
