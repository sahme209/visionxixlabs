import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import {
  BuildingOffice2Icon,
  GlobeAmericasIcon,
  CpuChipIcon,
  LightBulbIcon,
  ArrowRightIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Markets We Serve – US & Pakistan | Vision XIX Labs",
  description:
    "AI adoption gaps in the US and Pakistan. Where companies need AI—customer support, automation, analytics, governance—and how Vision XIX Labs helps.",
  alternates: { canonical: `${SITE_URL}/markets` },
  openGraph: {
    title: "Markets We Serve | US & Pakistan | Vision XIX Labs",
    description: "Market intelligence on AI gaps. How we help US and Pakistani companies deploy cloud and AI solutions.",
    url: `${SITE_URL}/markets`,
  },
};

export default function MarketsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-28 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            className="mb-8 text-xs text-slate-500 dark:text-slate-400"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link
                  href="/"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400"
                >
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Markets We Serve
              </li>
            </ol>
          </nav>

          {/* Hero */}
          <header className="mb-16 text-center">
            <div className="inline-flex items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/40 px-4 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 mb-3">
              US & Pakistan
            </div>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-slate-100 mb-4">
              Where companies need AI—and how we help
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Market intelligence on AI adoption gaps in the US and Pakistan. We help companies in both markets close those gaps with practical cloud and AI solutions.
            </p>
          </header>

          {/* US Market */}
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-6">
              <GlobeAmericasIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
                United States
              </h2>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Adoption gaps
              </h3>
              <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                <li className="flex gap-3">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span><strong className="text-slate-700 dark:text-slate-300">SMB vs. enterprise:</strong> Large firms adopt AI faster; micro- and small businesses (1–50 employees) lag due to limited technical capacity and budgets.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span><strong className="text-slate-700 dark:text-slate-300">Digital maturity:</strong> Many SMBs lack automation, data hygiene, and security basics—prerequisites for AI. Organizations with higher digital maturity see roughly double the growth.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span><strong className="text-slate-700 dark:text-slate-300">Barriers:</strong> Data privacy concerns, workforce upskilling needs, limited technical expertise, and unclear ROI slow adoption.</span>
                </li>
                <li className="flex gap-3">
                  <span className="text-indigo-500 mt-0.5">•</span>
                  <span><strong className="text-slate-700 dark:text-slate-300">Intent vs. action:</strong> A majority of SMBs plan to invest in AI but need help choosing the right use cases and implementation path.</span>
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Where US companies need AI
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Customer support automation and smart routing</span>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Sales and marketing personalization at scale</span>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Data extraction from invoices, forms, documents</span>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Internal knowledge bases and internal AI assistants</span>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 sm:col-span-2">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">DevOps and developer productivity (code assistance, documentation)</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                <LightBulbIcon className="h-5 w-5 text-indigo-600" />
                How we help US companies
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                We focus on practical AI that fits existing workflows. No data scientists or heavy infrastructure required. We start with a <Link href="/free-review" className="text-indigo-600 dark:text-indigo-400 hover:underline">free cloud and AI review</Link>, identify quick wins, and deliver fixed-scope packages for <Link href="/solutions-for-growing-teams" className="text-indigo-600 dark:text-indigo-400 hover:underline">growing teams</Link>. For larger organizations, we follow <Link href="/enterprise-readiness" className="text-indigo-600 dark:text-indigo-400 hover:underline">enterprise-ready</Link> governance and delivery practices.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Discuss your US operations
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* Pakistan Market */}
          <section className="mb-20">
            <div className="flex items-center gap-3 mb-6">
              <BuildingOffice2Icon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100">
                Pakistan
              </h2>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Market opportunity
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Pakistan’s AI market is growing rapidly. Companies are adopting AI tools for customer support, sales, operations analytics, and developer productivity. A large share of online workers already use AI weekly—the gap is in structured implementation, governance, and production deployment.
              </p>
              <ul className="space-y-2 text-slate-600 dark:text-slate-400 text-sm">
                <li>• <strong className="text-slate-700 dark:text-slate-300">Agriculture:</strong> Precision farming, pest detection, smart irrigation—high value in a sector central to the economy.</li>
                <li>• <strong className="text-slate-700 dark:text-slate-300">International trade:</strong> AI to address language and regulatory barriers can unlock export growth.</li>
                <li>• <strong className="text-slate-700 dark:text-slate-300">Digital services:</strong> Customer support automation, chatbots, and internal AI tools for knowledge and operations.</li>
                <li>• <strong className="text-slate-700 dark:text-slate-300">Manufacturing & logistics:</strong> Demand forecasting, inventory optimization, and process automation.</li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 mb-8">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Where Pakistani companies need AI
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Customer support and sales enablement</span>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Operational analytics and reporting</span>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Developer productivity and DevOps</span>
                </div>
                <div className="flex gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <CheckCircleIcon className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-slate-600 dark:text-slate-400">Data privacy and responsible AI governance</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border-2 border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                <LightBulbIcon className="h-5 w-5 text-indigo-600" />
                How we help Pakistani companies
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                We design AI solutions for Pakistani enterprises and scale-ups: cloud infrastructure (AWS, Azure, GCP), internal AI and LLM systems, automation, and security. We work with your team to deploy production-grade AI while building governance for data privacy and responsible use. Ideal for companies ready to move from pilots to production.
              </p>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Discuss your Pakistan operations
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* CTA */}
          <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center">
            <CpuChipIcon className="h-12 w-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Ready to close your AI gap?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-xl mx-auto">
              US or Pakistan—we help companies identify where AI delivers value and implement it with clear deliverables.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors"
            >
              Get started
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 mt-24">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-6 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-white">Vision XIX Labs</span>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                Cloud &amp; AI engineering for modern infrastructure. AWS, Azure, GCP — design, automate, optimize, secure.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">AWS</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">Azure</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">GCP</span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">AI/ML</span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Cloud</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/cloud-solutions" className="hover:text-white transition-colors">Cloud Solutions</Link></li>
                <li><Link href="/cloud-solutions/aws" className="hover:text-white transition-colors">AWS</Link></li>
                <li><Link href="/cloud-solutions/azure" className="hover:text-white transition-colors">Azure</Link></li>
                <li><Link href="/cloud-solutions/gcp" className="hover:text-white transition-colors">GCP</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Solutions</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/ai-solutions" className="hover:text-white transition-colors">AI Solutions</Link></li>
                <li><Link href="/ai-engineering" className="hover:text-white transition-colors">AI Engineering</Link></li>
                <li><Link href="/markets" className="hover:text-white transition-colors">Markets We Serve</Link></li>
                <li><Link href="/enterprise-readiness" className="hover:text-white transition-colors">Enterprise Readiness</Link></li>
                <li><Link href="/solutions-for-growing-teams" className="hover:text-white transition-colors">Growing Teams</Link></li>
                <li><Link href="/cloud-security" className="hover:text-white transition-colors">Cloud Security</Link></li>
                <li><Link href="/case-studies" className="hover:text-white transition-colors">Case Studies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/#about" className="hover:text-white transition-colors">About</Link></li>
                <li><Link href="/apps" className="hover:text-white transition-colors">Products</Link></li>
                <li><Link href="/press" className="hover:text-white transition-colors">Press &amp; Media</Link></li>
                <li><Link href="/insights" className="hover:text-white transition-colors">Insights</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white transition-colors">Terms</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Connect</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li><a href="mailto:support@visionxixlabs.com" className="hover:text-white transition-colors">support@visionxixlabs.com</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8">
            <p className="text-slate-400 text-sm">© {new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
