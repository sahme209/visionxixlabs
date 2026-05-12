"use client";

import Image from "next/image";
import Link from "next/link";
import {
  DevicePhoneMobileIcon as DevicePhoneMobileIconSolid,
  GlobeAltIcon as GlobeAltIconSolid,
} from "@heroicons/react/24/solid";
import { CheckBadgeIcon, SparklesIcon } from "@heroicons/react/24/outline";
import { Navigation } from "../../components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

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
    <div className="min-h-screen bg-[#09090b] relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-dots opacity-10 pointer-events-none" aria-hidden />
      <div className="spotlight-orb absolute -top-40 left-1/4 w-[450px] h-[450px] rounded-full bg-violet-600/[0.06] blur-[140px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-40 right-0 w-80 h-80 rounded-full bg-fuchsia-600/[0.04] blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full bg-violet-500/[0.03] blur-[100px] pointer-events-none" aria-hidden />

      <Navigation />
      <main className="pt-24 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="max-w-7xl mx-auto">
          <Reveal direction="up" blur delay={0.05}>
            <p className="mb-6 px-4 py-3 glass-card rounded-xl text-zinc-400 text-sm border border-white/[0.06]">
              Apps are separate from our cloud consulting offerings. For cloud services, see{" "}
              <Link href="/cloud-solutions" className="text-violet-400 hover:underline font-medium">
                Solutions
              </Link>
              .
            </p>
          </Reveal>

          {/* Header */}
          <Reveal direction="up" blur delay={0.1}>
            <header className="mb-12 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <div className="huly-badge inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-violet-500/10 text-violet-400 mb-4">
                  <SparklesIcon className="h-5 w-5" />
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Vision XIX Labs Apps
                  </span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold mb-3 tracking-[-0.04em]">
                  <span className="text-gradient">Mobile applications</span>
                </h1>
                <p className="text-sm md:text-base text-zinc-400 max-w-2xl">
                  We also build focused mobile applications that solve real-world
                  problems. These apps run alongside our cloud consulting work and
                  benefit from the same engineering principles.
                </p>
              </div>
              <div className="text-xs text-zinc-400">
                <p>
                  Looking for cloud consulting? Visit our{" "}
                  <Link
                    href="/cloud-solutions"
                    className="text-violet-400 hover:underline"
                  >
                    Cloud Solutions
                  </Link>{" "}
                  pages for AWS and Azure services.
                </p>
              </div>
            </header>
          </Reveal>

          <div className="section-divider mb-12" />

          {/* Apps grid */}
          <section>
            <Stagger delay={0.15} interval={0.1}>
              <div className="grid md:grid-cols-3 gap-8">
                {apps.map((app, index) => (
                  <div
                    key={app.id}
                    className="animated-border card-inner-glow card-hover glass-card rounded-2xl p-8 shadow-xl border border-white/[0.06]"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className="flex items-start justify-between mb-6">
                      <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center bg-white/[0.06] rounded-xl">
                        <Image
                          src={app.icon}
                          alt={`${app.name} icon`}
                          width={80}
                          height={80}
                          className="object-contain rounded-xl"
                        />
                      </div>
                      {app.badge && (
                        <span className="huly-badge px-3 py-1 rounded-full text-xs font-semibold bg-violet-500/10 text-violet-400">
                          {app.badge}
                        </span>
                      )}
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-white tracking-[-0.04em]">
                      {app.name}
                    </h2>
                    <p className="text-violet-400 font-semibold mb-3">
                      {app.tagline}
                    </p>
                    <p className="text-sm text-zinc-400 mb-5">
                      {app.description}
                    </p>
                    <ul className="space-y-1 mb-5">
                      {app.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center text-xs text-zinc-400"
                        >
                          <CheckBadgeIcon className="h-4 w-4 text-violet-400 mr-2" />
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
                          className="btn-huly cta-glow flex-1 inline-flex items-center justify-center px-4 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300"
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
                          className="btn-huly flex-1 inline-flex items-center justify-center px-4 py-3 bg-white/[0.06] text-zinc-300 rounded-lg font-semibold hover:bg-white/[0.08] transition-colors"
                        >
                          <GlobeAltIconSolid className="h-5 w-5 mr-2" />
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Stagger>
          </section>
        </div>
      </main>
    </div>
  );
}
