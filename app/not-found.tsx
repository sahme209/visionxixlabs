import Link from "next/link";
import { HomeIcon, ArrowLeftIcon } from "@heroicons/react/24/outline";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <p className="text-6xl font-bold text-indigo-600 dark:text-indigo-400 mb-2">404</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">
          Page not found
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved. Let&apos;s get you
          back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-white font-semibold hover:bg-indigo-700 transition-colors"
          >
            <HomeIcon className="h-5 w-5" />
            Back to Home
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 px-6 py-3 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5" />
            Contact Us
          </Link>
        </div>
        <nav className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Popular pages</p>
          <div className="flex flex-wrap gap-4 justify-center text-sm">
            <Link href="/cloud-solutions" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Cloud Solutions
            </Link>
            <Link href="/ai-solutions" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              AI Solutions
            </Link>
            <Link href="/services" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Services
            </Link>
            <Link href="/insights" className="text-indigo-600 dark:text-indigo-400 hover:underline">
              Insights
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}
