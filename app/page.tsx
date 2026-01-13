"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DevicePhoneMobileIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CheckBadgeIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import {
  DevicePhoneMobileIcon as DevicePhoneMobileIconSolid,
  GlobeAltIcon as GlobeAltIconSolid,
} from "@heroicons/react/24/solid";

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const apps = [
    {
      id: "visanova",
      name: "VisaNova",
      tagline: "USCIS Case Tracker & Forecast",
      description:
        "Track and estimate your U.S. immigration case progress using recent approval trends and easy-to-understand insights. Get personalized timelines, trend charts, and service center insights.",
      icon: "/visanova-icon.png",
      appStoreUrl: "https://apps.apple.com/us/app/visanova/id6749717843",
      websiteUrl: "https://visanova.app",
      features: [
        "Personalized case timeline",
        "Trend charts & approval pace",
        "Service center insights",
        "Daily immigration highlights",
      ],
      color: "from-blue-600 to-indigo-700",
      badge: "Featured",
    },
    {
      id: "recallease",
      name: "RecallEase",
      tagline: "Health, Routine & Reminder",
      description:
        "Your personal health companion for managing routines, medications, and important reminders. Stay organized and never miss a beat with intelligent scheduling and notifications.",
      icon: "/recallease-icon.png",
      appStoreUrl: "https://apps.apple.com/us/app/recallease/id6754576974",
      websiteUrl: null,
      features: [
        "Health tracking",
        "Routine management",
        "Smart reminders",
        "Medication schedules",
      ],
      color: "from-purple-600 to-pink-600",
      badge: "New",
    },
    {
      id: "android",
      name: "Android Apps",
      tagline: "Coming Soon",
      description:
        "We're bringing our innovative apps to Android! Stay tuned for VisaNova and RecallEase on the Google Play Store.",
      icon: "🤖",
      appStoreUrl: null,
      websiteUrl: null,
      features: [
        "Full feature parity",
        "Cross-platform sync",
        "Native Android experience",
        "Coming 2025",
      ],
      color: "from-green-600 to-emerald-700",
      badge: "Coming Soon",
      comingSoon: true,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <SparklesIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Vision XIX Labs
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <a
                href="#apps"
                className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Apps
              </a>
              <a
                href="#about"
                className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                About
              </a>
              <a
                href="#contact"
                className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Contact
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div
            className={`animate-fade-in ${
              mounted ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 mb-8">
              <RocketLaunchIcon className="h-5 w-5" />
              <span className="text-sm font-semibold">
                Building the Future of Digital Experiences
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Vision XIX Labs
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
              Creating innovative mobile applications that simplify complex
              processes and enhance everyday life
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="#apps"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                Explore Our Apps
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </a>
              <a
                href="#contact"
                className="inline-flex items-center px-8 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 transform hover:-translate-y-1 transition-all duration-300"
              >
                Get in Touch
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Apps Showcase */}
      <section id="apps" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              Our Applications
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Innovative solutions designed to make your life easier and more
              organized
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {apps.map((app, index) => (
              <div
                key={app.id}
                className={`card-hover bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700 ${
                  mounted ? "animate-fade-in" : ""
                }`}
                style={{
                  animationDelay: `${index * 0.1}s`,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="relative w-20 h-20 flex-shrink-0 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-xl">
                    {app.comingSoon || !app.icon.startsWith("/") ? (
                      <div className="text-6xl">{app.icon}</div>
                    ) : (
                      <Image
                        src={app.icon}
                        alt={`${app.name} icon`}
                        width={80}
                        height={80}
                        className="object-contain rounded-xl"
                        style={{ maxWidth: "100%", height: "auto" }}
                        onError={(e) => {
                          console.error(`Failed to load image: ${app.icon}`);
                        }}
                      />
                    )}
                  </div>
                  {app.badge && (
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        app.comingSoon
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                          : app.badge === "Featured"
                          ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                          : "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                      }`}
                    >
                      {app.badge}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                  {app.name}
                </h3>
                <p className="text-indigo-600 dark:text-indigo-400 font-semibold mb-4">
                  {app.tagline}
                </p>
                <p className="text-slate-600 dark:text-slate-400 mb-6">
                  {app.description}
                </p>
                <ul className="space-y-2 mb-6">
                  {app.features.map((feature, idx) => (
                    <li
                      key={idx}
                      className="flex items-center text-sm text-slate-600 dark:text-slate-400"
                    >
                      <CheckBadgeIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400 mr-2 flex-shrink-0" />
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
                  {app.comingSoon && (
                    <div className="flex-1 inline-flex items-center justify-center px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg font-semibold cursor-not-allowed">
                      Coming Soon
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section
        id="about"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-800"
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                About Vision XIX Labs
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-4">
                Vision XIX Labs LLC is a forward-thinking mobile application
                development company dedicated to creating innovative solutions
                that address real-world challenges.
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-4">
                We specialize in building intuitive, user-friendly applications
                that combine cutting-edge technology with thoughtful design. Our
                mission is to simplify complex processes and enhance everyday
                experiences through innovative digital solutions.
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                From immigration case tracking to health and wellness management,
                we're committed to creating apps that make a meaningful
                difference in people's lives.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white">
                <SparklesIcon className="h-12 w-12 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Innovation</h3>
                <p className="text-indigo-100">
                  Pushing boundaries with cutting-edge technology
                </p>
              </div>
              <div className="bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-8 text-white">
                <CheckBadgeIcon className="h-12 w-12 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Quality</h3>
                <p className="text-pink-100">
                  Delivering excellence in every detail
                </p>
              </div>
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-8 text-white">
                <RocketLaunchIcon className="h-12 w-12 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Growth</h3>
                <p className="text-blue-100">
                  Continuously evolving and improving
                </p>
              </div>
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-8 text-white">
                <ShieldCheckIcon className="h-12 w-12 mb-4" />
                <h3 className="text-2xl font-bold mb-2">Trust</h3>
                <p className="text-emerald-100">
                  Building reliable and secure solutions
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-slate-900 dark:text-slate-100">
            Get in Touch
          </h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 mb-12">
            Have questions, feedback, or need support? We're here to help!
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            <a
              href="mailto:support@visionxixlabs.com"
              className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700"
            >
              <EnvelopeIcon className="h-12 w-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                Support Email
              </h3>
              <p className="text-indigo-600 dark:text-indigo-400 font-semibold">
                support@visionxixlabs.com
              </p>
            </a>
            <Link
              href="/privacy"
              className="card-hover bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700"
            >
              <ShieldCheckIcon className="h-12 w-12 text-indigo-600 dark:text-indigo-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                Privacy Policy
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Learn how we protect your data
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <SparklesIcon className="h-6 w-6 text-indigo-400" />
                <span className="text-lg font-bold text-white">
                  Vision XIX Labs
                </span>
              </div>
              <p className="text-slate-400">
                Creating innovative mobile applications that make life easier.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <a
                    href="#apps"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Our Apps
                  </a>
                </li>
                <li>
                  <a
                    href="#about"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <a
                    href="mailto:support@visionxixlabs.com"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Support
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-400">
            <p>
              © {new Date().getFullYear()} Vision XIX Labs LLC. All rights
              reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
