"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";

export function Navigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-3">
            <Image
              src="/vision-xix-logo.png"
              alt="Vision XIX Labs"
              width={56}
              height={56}
              className="rounded-xl shadow-md"
              priority
            />
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-sky-400 bg-clip-text text-transparent">
              Vision XIX Labs
            </span>
          </Link>
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/apps"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              Apps
            </Link>
            <Link
              href="/#solutions"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              Solutions
            </Link>
            <Link
              href="/cloud-solutions"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              Cloud Solutions
            </Link>
            <Link
              href="/cloud-solutions/aws"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              AWS
            </Link>
            <Link
              href="/cloud-solutions/azure"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              Azure
            </Link>
            <Link
              href="/cloud-solutions/gcp"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              GCP
            </Link>
            <Link
              href="/#about"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              About
            </Link>
            <Link
              href="/#contact"
              className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-medium"
            >
              Contact
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300"
            >
              Get Started
              <ArrowRightIcon className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
