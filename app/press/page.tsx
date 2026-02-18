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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />

      <main className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Press &amp; Media
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            We welcome links from partners, press, and resources pages. Use the information below to link to Vision XIX Labs and help others discover our work.
          </p>

          {/* Canonical URL for backlinks */}
          <section className="mb-10 p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Preferred link (canonical URL)
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              For best SEO and consistency, please link to our main site:
            </p>
            <code className="block p-4 rounded-lg bg-slate-100 dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 font-mono text-sm break-all">
              {SITE_URL}
            </code>
          </section>

          {/* Suggested anchor text */}
          <section className="mb-10 p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Suggested anchor text for backlinks
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Using descriptive anchor text helps search engines and users. You can use any of these:
            </p>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <li><strong>Vision XIX Labs</strong> – company name</li>
              <li><strong>Vision XIX Labs – Cloud &amp; AI Engineering</strong> – with tagline</li>
              <li><strong>cloud and AI engineering</strong> – keyword-focused</li>
              <li><strong>multi-cloud consulting (AWS, Azure, GCP)</strong> – service-focused</li>
              <li><strong>VisaNova</strong> or <strong>RecallEase</strong> – when referencing our apps</li>
            </ul>
          </section>

          {/* Logo / badge */}
          <section className="mb-10 p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Logo and branding
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
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
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Logo URL: <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">{SITE_URL}/vision-xix-logo.png</code>
              </p>
            </div>
          </section>

          {/* Short description for use elsewhere */}
          <section className="mb-10 p-6 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              One-line description
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
              For directories, partner pages, or author bios:
            </p>
            <blockquote className="pl-4 border-l-4 border-indigo-500 text-slate-700 dark:text-slate-300 italic">
              Vision XIX Labs builds cloud and AI solutions for modern infrastructure—AWS, Azure, and GCP—and creates apps like VisaNova (USCIS case tracker) and RecallEase (health and reminders).
            </blockquote>
          </section>

          {/* Internal links for SEO */}
          <section className="p-6 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
              Explore our site
            </h2>
            <ul className="flex flex-wrap gap-3 text-sm">
              <li><Link href="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">Home</Link></li>
              <li><Link href="/cloud-solutions" className="text-indigo-600 dark:text-indigo-400 hover:underline">Cloud Solutions</Link></li>
              <li><Link href="/ai-solutions" className="text-indigo-600 dark:text-indigo-400 hover:underline">AI Solutions</Link></li>
              <li><Link href="/apps" className="text-indigo-600 dark:text-indigo-400 hover:underline">Our Apps</Link></li>
              <li><Link href="/contact" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contact</Link></li>
              <li><Link href="/case-studies" className="text-indigo-600 dark:text-indigo-400 hover:underline">Case Studies</Link></li>
              <li><Link href="/insights" className="text-indigo-600 dark:text-indigo-400 hover:underline">Insights</Link></li>
            </ul>
          </section>

          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            Questions? <Link href="/contact" className="text-indigo-600 dark:text-indigo-400 hover:underline">Contact us</Link>.
          </p>
        </div>
      </main>

      {/* Minimal footer for this page */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
        <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">Vision XIX Labs</Link>
        {" · "}
        <Link href="/privacy" className="hover:text-indigo-600 dark:hover:text-indigo-400">Privacy</Link>
        {" · "}
        <Link href="/terms" className="hover:text-indigo-600 dark:hover:text-indigo-400">Terms</Link>
      </footer>
    </div>
  );
}
