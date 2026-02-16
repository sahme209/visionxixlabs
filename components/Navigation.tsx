"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, Bars3Icon, XMarkIcon } from "@heroicons/react/24/outline";

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link href="/" className="flex items-center space-x-3 group">
            <Image
              src="/vision-xix-logo.png"
              alt="Vision XIX Labs"
              width={56}
              height={56}
              className="rounded-xl shadow-lg group-hover:shadow-xl transition-shadow"
              priority
            />
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Vision XIX Labs
            </span>
          </Link>
          <div className="hidden md:flex items-center space-x-1">
            <Link
              href="/cloud-solutions"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Solutions
            </Link>
            <Link
              href="/ai-solutions"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              AI Solutions
            </Link>
            <Link
              href="/cloud-solutions/aws"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all text-sm font-medium"
            >
              AWS
            </Link>
            <Link
              href="/cloud-solutions/azure"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Azure
            </Link>
            <Link
              href="/cloud-solutions/gcp"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all text-sm font-medium"
            >
              GCP
            </Link>
            <Link
              href="/apps"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              Products
            </Link>
            <Link
              href="/#about"
              className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
            >
              About
            </Link>
            <Link
              href="/contact"
              className="ml-2 inline-flex items-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-lg text-sm font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
            >
              Get Started
              <ArrowRightIcon className="ml-1.5 h-4 w-4" />
            </Link>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {mobileMenuOpen ? (
              <XMarkIcon className="h-6 w-6" />
            ) : (
              <Bars3Icon className="h-6 w-6" />
            )}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-slate-200 dark:border-slate-800 mt-2">
            <div className="flex flex-col space-y-2">
              <Link
                href="/cloud-solutions"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
              >
                Solutions
              </Link>
              <Link
                href="/ai-solutions"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
              >
                AI Solutions
              </Link>
              <Link
                href="/cloud-solutions/aws"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-all text-sm font-medium"
              >
                AWS
              </Link>
              <Link
                href="/cloud-solutions/azure"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all text-sm font-medium"
              >
                Azure
              </Link>
              <Link
                href="/cloud-solutions/gcp"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all text-sm font-medium"
              >
                GCP
              </Link>
              <Link
                href="/apps"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
              >
                Products
              </Link>
              <Link
                href="/#about"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-all text-sm font-medium"
              >
                About
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 inline-flex items-center justify-center px-5 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-lg text-sm font-semibold shadow-lg"
              >
                Get Started
                <ArrowRightIcon className="ml-1.5 h-4 w-4" />
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
