"use client";

import Image from "next/image";
import Link from "next/link";
import {
  DevicePhoneMobileIcon as DevicePhoneMobileIconSolid,
  GlobeAltIcon as GlobeAltIconSolid,
} from "@heroicons/react/24/solid";
import { CheckBadgeIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";

const apps = [
  {
    id: "visanova",
    name: "VisaNova",
    tagline: "USCIS Case Tracker & Forecast",
    description:
      "Track and estimate your U.S. immigration case progress using recent approval trends and easy-to-understand insights.",
    icon: "/visanova-icon.png",
    appStoreUrl: "https://apps.apple.com/us/app/visanova/id6749717843",
    websiteUrl: "https://visanova.app",
    features: [
      "Personalized case timeline",
      "Trend charts & approval pace",
      "Service center insights",
      "Daily immigration highlights",
    ],
    badge: "Featured",
  },
  {
    id: "recallease",
    name: "RecallEase",
    tagline: "Health, Routine & Reminder",
    description:
      "A personal health companion for managing routines, medications, and important reminders.",
    icon: "/recallease-icon.png",
    appStoreUrl: "https://apps.apple.com/us/app/recallease/id6754576974",
    websiteUrl: null,
    features: ["Health tracking", "Routine management", "Smart reminders"],
    badge: "New",
  },
];

export default function AppsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <p className="mb-6 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 text-sm border border-slate-200 dark:border-slate-700">
            Apps are separate from our cloud consulting offerings. For cloud services, see{" "}
            <Link href="/cloud-solutions" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">
              Solutions
            </Link>
            .
          </p>
          {/* Header */}
          <header className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 mb-4">
                <SparklesIcon className="h-5 w-5" />
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Vision XIX Labs Apps
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold mb-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Mobile applications
              </h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl">
                We also build focused mobile applications that solve real-world
                problems. These apps run alongside our cloud consulting work and
                benefit from the same engineering principles.
              </p>
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              <p>
                Looking for cloud consulting? Visit our{" "}
                <Link
                  href="/cloud-solutions"
                  className="text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Cloud Solutions
                </Link>{" "}
                pages for AWS and Azure services.
              </p>
            </div>
          </header>

          {/* Apps grid */}
          <section>
            <div className="grid md:grid-cols-3 gap-8">
              {apps.map((app, index) => (
                <div
                  key={app.id}
                  className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-xl">
                      <Image
                        src={app.icon}
                        alt={`${app.name} icon`}
                        width={80}
                        height={80}
                        className="object-contain rounded-xl"
                      />
                    </div>
                    {app.badge && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                        {app.badge}
                      </span>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                    {app.name}
                  </h2>
                  <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-3">
                    {app.tagline}
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                    {app.description}
                  </p>
                  <ul className="space-y-1 mb-5">
                    {app.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-center text-xs text-slate-600 dark:text-slate-400"
                      >
                        <CheckBadgeIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mr-2" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col sm:flex-row gap-3">
                    {app.appStoreUrl && (
                      <a
                        href={app.appStoreUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300"
                      >
                        <DevicePhoneMobileIconSolid className="h-5 w-5 mr-2" />
                        App Store
                      </a>
                    )}
                    {app.websiteUrl && (
                      <a
                        href={app.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                      >
                        <GlobeAltIconSolid className="h-5 w-5 mr-2" />
                        Website
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

