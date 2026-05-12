import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Navigation } from "@/components/Navigation";
import { SITE_URL } from "@/lib/seo";

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
    <div className="min-h-screen bg-[#09090b]">
      <Navigation />

      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Press &amp; Media
          </h1>
          <p className="text-lg text-zinc-400 mb-8">
            We welcome links from partners, press, and resources pages. Use the information below to link to Vision XIX Labs and help others discover our work.
          </p>

          {/* Canonical URL for backlinks */}
          <section className="mb-10 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] shadow-sm">
            <h2 className="text-xl font-semibold text-white mb-3">
              Preferred link (canonical URL)
            </h2>
            <p className="text-sm text-zinc-400 mb-3">
              For best SEO and consistency, please link to our main site:
            </p>
            <code className="block p-4 rounded-lg bg-white/[0.04] text-violet-400 font-mono text-sm break-all">
              {SITE_URL}
            </code>
          </section>

          {/* Suggested anchor text */}
          <section className="mb-10 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] shadow-sm">
            <h2 className="text-xl font-semibold text-white mb-3">
              Suggested anchor text for backlinks
            </h2>
            <p className="text-sm text-zinc-400 mb-4">
              Using descriptive anchor text helps search engines and users. You can use any of these:
            </p>
            <ul className="space-y-2 text-sm text-zinc-300">
              <li><strong>Vision XIX Labs</strong> – company name</li>
              <li><strong>Vision XIX Labs – Cloud &amp; AI Engineering</strong> – with tagline</li>
              <li><strong>cloud and AI engineering</strong> – keyword-focused</li>
              <li><strong>multi-cloud consulting (AWS, Azure, GCP)</strong> – service-focused</li>
              <li><strong>VisaNova</strong> or <strong>RecallEase</strong> – when referencing our apps</li>
            </ul>
          </section>

          {/* Logo / badge */}
          <section className="mb-10 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] shadow-sm">
            <h2 className="text-xl font-semibold text-white mb-3">
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

          {/* Short description for use elsewhere */}
          <section className="mb-10 p-6 rounded-xl bg-white/[0.02] border border-white/[0.06] shadow-sm">
            <h2 className="text-xl font-semibold text-white mb-3">
              One-line description
            </h2>
            <p className="text-sm text-zinc-400 mb-3">
              For directories, partner pages, or author bios:
            </p>
            <blockquote className="pl-4 border-l-4 border-indigo-500 text-zinc-300 italic">
              Vision XIX Labs builds cloud and AI solutions for modern infrastructure—AWS, Azure, and GCP—and creates apps like VisaNova (USCIS case tracker) and RecallEase (health and reminders).
            </blockquote>
          </section>

          {/* Internal links for SEO */}
          <section className="p-6 rounded-xl bg-white/[0.04]/50 border border-white/[0.06]">
            <h2 className="text-lg font-semibold text-white mb-3">
              Explore our site
            </h2>
            <ul className="flex flex-wrap gap-3 text-sm">
              <li><Link href="/" className="text-violet-400 hover:underline">Home</Link></li>
              <li><Link href="/cloud-solutions" className="text-violet-400 hover:underline">Cloud Solutions</Link></li>
              <li><Link href="/ai-solutions" className="text-violet-400 hover:underline">AI Solutions</Link></li>
              <li><Link href="/apps" className="text-violet-400 hover:underline">Our Apps</Link></li>
              <li><Link href="/contact" className="text-violet-400 hover:underline">Contact</Link></li>
              <li><Link href="/case-studies" className="text-violet-400 hover:underline">Case Studies</Link></li>
              <li><Link href="/insights" className="text-violet-400 hover:underline">Insights</Link></li>
            </ul>
          </section>

          <p className="mt-8 text-sm text-zinc-500">
            Questions? <Link href="/contact" className="text-violet-400 hover:underline">Contact us</Link>.
          </p>
        </div>
      </main>

      {/* Minimal footer for this page */}
      <footer className="border-t border-white/[0.06] py-6 px-4 text-center text-sm text-zinc-500">
        <Link href="/" className="hover:text-violet-400">Vision XIX Labs</Link>
        {" · "}
        <Link href="/privacy" className="hover:text-violet-400">Privacy</Link>
        {" · "}
        <Link href="/terms" className="hover:text-violet-400">Terms</Link>
      </footer>
    </div>
  );
}
