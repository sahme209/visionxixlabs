import type { Metadata } from "next";
import Link from "next/link";
import { Navigation } from "../../../components/Navigation";

export const metadata: Metadata = {
  title: "Workflow Automation with AI | AI Solutions | Vision XIX Labs",
  description:
    "Email classification, support automation, CRM enrichment, and report generation. AI-powered workflow automation in your cloud.",
};

export default function AIAutomationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <nav
            aria-label="Breadcrumb"
            className="mb-6 text-xs text-slate-500 dark:text-slate-400"
          >
            <ol className="flex items-center space-x-2">
              <li>
                <Link href="/" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/ai-solutions" className="hover:text-indigo-600 dark:hover:text-indigo-400">
                  AI Solutions
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-semibold">
                Workflow Automation with AI
              </li>
            </ol>
          </nav>
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Workflow Automation with AI
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-8">
            We automate repetitive workflows with AI—email classification, support automation, CRM data enrichment, and report generation—integrated with your existing systems and deployed in your cloud.
          </p>
          <div className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 mb-8">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3">
              What we deliver
            </h2>
            <ul className="space-y-2 text-slate-600 dark:text-slate-400">
              <li>• Email classification and routing</li>
              <li>• Support ticket automation and triage</li>
              <li>• CRM data enrichment and cleanup</li>
              <li>• Report generation and summarization</li>
              <li>• Integration with your tools and CI/CD where needed</li>
            </ul>
          </div>
          <Link
            href="/contact"
            className="inline-flex items-center px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Talk to an Engineer
          </Link>
          <p className="mt-8">
            <Link href="/ai-solutions" className="text-indigo-600 dark:text-indigo-400 hover:underline text-sm font-medium">
              ← Back to AI Solutions
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
