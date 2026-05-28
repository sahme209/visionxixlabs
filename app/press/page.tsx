import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { SITE_URL } from "@/lib/seo";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Press & Media – Vision XIX Labs",
  description:
    "Official press and media resources for Vision XIX Labs. Link to us, use our logo, and find suggested anchor text for backlinks. Cloud & AI engineering – AWS, Azure, GCP.",
  alternates: { canonical: `${SITE_URL}/press` },
  openGraph: {
    title: "Press & Media | Vision XIX Labs",
    description: "Link to Vision XIX Labs. Press kit, logo, and suggested anchor text for partners and media.",
    url: `${SITE_URL}/press`,
  },
};

export default function PressPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Huly aurora */}
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute -top-40 left-1/3 w-[480px] h-[420px] rounded-full bg-brand-violet/[0.07] blur-[130px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-1/4 right-[5%] w-[360px] h-[300px] rounded-full bg-brand-coral/[0.06] blur-[120px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="ambient-drift absolute bottom-20 right-0 w-[300px] h-[280px] rounded-full bg-cyan-500/[0.04] blur-[100px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />

      <Navigation />

      <main className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-6xl mx-auto px-6 md:px-10">
          <Reveal direction="up" blur delay={0.05}>
            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 mb-4 inline-flex items-center gap-3">
              <span className="text-brand-coral/90 tabular-nums">P1</span>
              <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              Press &amp; Media
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-[-0.04em] leading-[1.04]">
              Link to{" "}
              <span className="relative inline-block">
                VisionXIXLabs.
                <span aria-hidden className="absolute left-0 -bottom-1 h-[3px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-85" />
              </span>
            </h1>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl">
              We welcome links from partners, press, and resources pages. Use the information below to link to Vision XIX Labs and help others discover our work.
            </p>
          </Reveal>

          <Stagger delay={0.1} interval={0.08}>
            {/* Canonical URL for backlinks */}
            <Reveal direction="up" blur delay={0.1}>
              <section className="mb-10 p-6 rounded-xl glass-card animated-border card-inner-glow border border-white/[0.06] shadow-sm">
                <h2 className="text-xl font-semibold text-white mb-3 tracking-[-0.04em]">
                  Preferred link (canonical URL)
                </h2>
                <p className="text-sm text-zinc-400 mb-3">
                  For best SEO and consistency, please link to our main site:
                </p>
                <code className="block p-4 rounded-lg bg-white/[0.04] text-violet-400 font-mono text-sm break-all">
                  {SITE_URL}
                </code>
              </section>
            </Reveal>

            {/* Suggested anchor text */}
            <Reveal direction="up" blur delay={0.15}>
              <section className="mb-10 p-6 rounded-xl glass-card animated-border card-inner-glow border border-white/[0.06] shadow-sm">
                <h2 className="text-xl font-semibold text-white mb-3 tracking-[-0.04em]">
                  Suggested anchor text for backlinks
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                  Using descriptive anchor text helps search engines and users. You can use any of these:
                </p>
                <ul className="space-y-2 text-sm text-zinc-300">
                  <li><strong>Vision XIX Labs</strong> – company name</li>
                  <li><strong>Axiom Agent</strong> – autonomous cloud operations platform</li>
                  <li><strong>Vision XIX Labs – Cloud &amp; AI Engineering</strong> – with tagline</li>
                  <li><strong>autonomous cloud operations</strong> – product-focused</li>
                  <li><strong>multi-cloud intelligence (AWS, Azure, GCP)</strong> – service-focused</li>
                </ul>
              </section>
            </Reveal>

            {/* Logo / badge */}
            <Reveal direction="up" blur delay={0.2}>
              <section className="mb-10 p-6 rounded-xl glass-card animated-border card-inner-glow border border-white/[0.06] shadow-sm">
                <h2 className="text-xl font-semibold text-white mb-3 tracking-[-0.04em]">
                  Logo and branding
                </h2>
                <p className="text-sm text-zinc-400 mb-4">
                  You may use our logo when linking to us. Please link the image to {SITE_URL}.
                </p>
                <div className="flex items-center gap-4 flex-wrap">
                  <Image
                    src="/vision-xix-logo.png"
                    alt="Vision XIX Labs"
                    width={80}
                    height={80}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-zinc-500">
                    Logo URL: <code className="bg-white/[0.04] px-1 rounded">{SITE_URL}/vision-xix-logo.png</code>
                  </p>
                </div>
              </section>
            </Reveal>

            {/* Short description for use elsewhere */}
            <Reveal direction="up" blur delay={0.25}>
              <section className="mb-10 p-6 rounded-xl glass-card animated-border card-inner-glow border border-white/[0.06] shadow-sm">
                <h2 className="text-xl font-semibold text-white mb-3 tracking-[-0.04em]">
                  One-line description
                </h2>
                <p className="text-sm text-zinc-400 mb-3">
                  For directories, partner pages, or author bios:
                </p>
                <blockquote className="pl-4 border-l-4 border-violet-500 text-zinc-300 italic">
                  Vision XIX Labs builds cloud and AI solutions for modern infrastructure—AWS, Azure, and GCP—and creates apps like VisaNova (USCIS case tracker) and RecallEase (health and reminders).
                </blockquote>
              </section>
            </Reveal>

            {/* Internal links for SEO */}
            <Reveal direction="up" blur delay={0.3}>
              <section className="p-6 rounded-xl glass-card border border-white/[0.06]">
                <h2 className="text-lg font-semibold text-white mb-3 tracking-[-0.04em]">
                  Explore our site
                </h2>
                <ul className="flex flex-wrap gap-3 text-sm">
                  <li><Link href="/" className="text-violet-400 hover:underline">Home</Link></li>
                  <li><Link href="/cloud-solutions" className="text-violet-400 hover:underline">Cloud Solutions</Link></li>
                  <li><Link href="/axiom" className="text-violet-400 hover:underline">Axiom Agent</Link></li>
                  <li><Link href="/services" className="text-violet-400 hover:underline">Services</Link></li>
                  <li><Link href="/contact" className="text-violet-400 hover:underline">Contact</Link></li>
                  <li><Link href="/case-studies" className="text-violet-400 hover:underline">Case Studies</Link></li>
                  <li><Link href="/insights" className="text-violet-400 hover:underline">Insights</Link></li>
                </ul>
              </section>
            </Reveal>
          </Stagger>

          <Reveal direction="up" blur delay={0.35}>
            <p className="mt-8 text-sm text-zinc-500">
              Questions? <Link href="/contact" className="text-violet-400 hover:underline">Contact us</Link>.
            </p>
          </Reveal>
        </div>
      </main>

      <Footer />
    </div>
  );
}
