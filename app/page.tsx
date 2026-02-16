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
import { Navigation } from "../components/Navigation";
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
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div
            className={`animate-fade-in ${
              mounted ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-indigo-100 via-purple-100 to-pink-100 dark:from-indigo-900/40 dark:via-purple-900/40 dark:to-pink-900/40 text-indigo-700 dark:text-indigo-300 mb-8 animate-fade-in">
              <RocketLaunchIcon className="h-5 w-5 animate-pulse" />
              <span className="text-sm font-semibold">
                Engineering cloud platforms that scale
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent leading-tight">
              Vision XIX Labs
            </h1>
            <p className="text-xl md:text-2xl lg:text-3xl text-slate-700 dark:text-slate-300 mb-4 max-w-4xl mx-auto font-medium">
              We help engineering teams build, deploy, and operate cloud platforms that are{" "}
              <span className="text-indigo-600 dark:text-indigo-400 font-bold">reliable</span>,{" "}
              <span className="text-purple-600 dark:text-purple-400 font-bold">secure</span>, and{" "}
              <span className="text-pink-600 dark:text-pink-400 font-bold">cost-effective</span>.
            </p>
            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-10 max-w-3xl mx-auto">
              Multi-cloud engineering across AWS, Azure, and Google Cloud Platform.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <Link
                href="/contact"
                className="group inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white rounded-xl font-semibold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 hover:scale-105 transition-all duration-300 relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center">
                  Talk to an Engineer
                  <ArrowRightIcon className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 via-purple-700 to-pink-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Link>
              <Link
                href="/cloud-solutions"
                className="inline-flex items-center px-8 py-4 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-semibold shadow-lg hover:shadow-xl border-2 border-slate-200 dark:border-slate-700 transform hover:-translate-y-1 transition-all duration-300 hover:border-indigo-300 dark:hover:border-indigo-600"
              >
                Explore Solutions
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mb-12">
              <Link
                href="/cloud-solutions/aws"
                className="group inline-flex items-center px-6 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-700 transform hover:-translate-y-0.5 hover:scale-105 transition-all duration-300 hover:border-orange-300 dark:hover:border-orange-600"
              >
                <span className="text-orange-600 dark:text-orange-400 font-bold mr-2">AWS</span>
                Cloud
              </Link>
              <Link
                href="/cloud-solutions/azure"
                className="group inline-flex items-center px-6 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-700 transform hover:-translate-y-0.5 hover:scale-105 transition-all duration-300 hover:border-blue-300 dark:hover:border-blue-600"
              >
                <span className="text-blue-600 dark:text-blue-400 font-bold mr-2">Azure</span>
                Cloud
              </Link>
              <Link
                href="/cloud-solutions/gcp"
                className="group inline-flex items-center px-6 py-3 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-900 dark:text-slate-100 rounded-lg text-sm font-semibold shadow-md hover:shadow-lg border border-slate-200 dark:border-slate-700 transform hover:-translate-y-0.5 hover:scale-105 transition-all duration-300 hover:border-red-300 dark:hover:border-red-600"
              >
                <span className="text-red-600 dark:text-red-400 font-bold mr-2">GCP</span>
                Cloud
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* (Apps now live on /apps; homepage focuses on cloud solutions) */}

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent mb-2">
                3
              </div>
              <div className="text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium">
                Cloud Providers
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                16+
              </div>
              <div className="text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium">
                Solution Areas
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-600 to-red-600 bg-clip-text text-transparent mb-2">
                100%
              </div>
              <div className="text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium">
                Infrastructure as Code
              </div>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-extrabold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent mb-2">
                24/7
              </div>
              <div className="text-sm md:text-base text-slate-600 dark:text-slate-400 font-medium">
                Support Ready
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions / Services Overview */}
      <section
        id="solutions"
        className="py-24 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-50/50 via-transparent to-purple-50/50 dark:from-indigo-900/10 dark:via-transparent dark:to-purple-900/10 pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Multi-cloud engineering solutions
            </h2>
            <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-300 max-w-4xl mx-auto font-medium">
              We design, automate, and operate cloud platforms across AWS, Azure,
              and Google Cloud with a focus on reliability, security, and cost
              efficiency.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="group card-hover bg-gradient-to-br from-orange-50 to-orange-100 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-6 md:p-8 shadow-xl border-2 border-orange-200 dark:border-orange-900/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-200 dark:bg-orange-900/30 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-orange-200 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300 text-xs font-bold mb-4">
                  AWS
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                  AWS Cloud Engineering
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm font-medium">
                  Production-ready AWS infrastructure, automation, and operations for modern workloads.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">✓</span>
                    <span>Landing zones, networking, and security baselines</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">✓</span>
                    <span>CI/CD with GitHub and Octopus Deploy</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-orange-500 mr-2">✓</span>
                    <span>FinOps and observability for production</span>
                  </li>
                </ul>
                <Link
                  href="/cloud-solutions/aws"
                  className="inline-flex items-center text-sm font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 dark:hover:text-orange-300 group-hover:underline"
                >
                  Explore AWS solutions
                  <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="group card-hover bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-6 md:p-8 shadow-xl border-2 border-blue-200 dark:border-blue-900/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-200 dark:bg-blue-900/30 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-200 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-xs font-bold mb-4">
                  AZURE
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                  Azure Cloud Engineering
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm font-medium">
                  Enterprise-grade Azure platforms with governance, security, and automation built-in.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>Azure landing zones and subscription structure</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>Networking, identity, and governance patterns</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-blue-500 mr-2">✓</span>
                    <span>Automation and CI/CD for Azure-native services</span>
                  </li>
                </ul>
                <Link
                  href="/cloud-solutions/azure"
                  className="inline-flex items-center text-sm font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 group-hover:underline"
                >
                  Explore Azure solutions
                  <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
            <div className="group card-hover bg-gradient-to-br from-red-50 to-red-100 dark:from-slate-800 dark:to-slate-800 rounded-2xl p-6 md:p-8 shadow-xl border-2 border-red-200 dark:border-red-900/50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-200 dark:bg-red-900/30 rounded-full blur-3xl opacity-50 group-hover:opacity-75 transition-opacity"></div>
              <div className="relative">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300 text-xs font-bold mb-4">
                  GCP
                </div>
                <h3 className="text-xl md:text-2xl font-bold mb-3 text-slate-900 dark:text-slate-100">
                  Google Cloud Platform
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-4 text-sm font-medium">
                  Scalable GCP architectures with automation, security, and cost-control engineered in.
                </p>
                <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-2 mb-6">
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✓</span>
                    <span>Project structure and VPC networking</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✓</span>
                    <span>CI/CD for containerized and serverless workloads</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-red-500 mr-2">✓</span>
                    <span>Cost visibility, monitoring, and guardrails</span>
                  </li>
                </ul>
                <Link
                  href="/cloud-solutions/gcp"
                  className="inline-flex items-center text-sm font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 group-hover:underline"
                >
                  Explore GCP solutions
                  <ArrowRightIcon className="ml-1 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section
        id="about"
        className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10"></div>
        <div className="max-w-7xl mx-auto relative">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold mb-6">
                Our Story
              </div>
              <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Engineering-first cloud consulting
              </h2>
              <p className="text-lg md:text-xl text-slate-700 dark:text-slate-300 mb-6 font-medium leading-relaxed">
                We're a team of cloud engineers who've built and operated platforms at scale. 
                We know what it takes to make cloud infrastructure reliable, secure, and cost-effective—because we've done it ourselves.
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                Our approach is practical: we work alongside your teams, write Infrastructure as Code, 
                automate everything that should be automated, and leave you with platforms you can actually run and improve.
              </p>
              <p className="text-lg text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
                Beyond consulting, we also build products. From immigration case tracking to health management apps, 
                we ship software that solves real problems for real people.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link
                  href="/cloud-solutions"
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  Our Services
                  <ArrowRightIcon className="ml-2 h-5 w-5" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg font-semibold shadow-lg hover:shadow-xl border-2 border-slate-200 dark:border-slate-700 transform hover:-translate-y-0.5 transition-all duration-300"
                >
                  Get in Touch
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="group card-hover bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-8 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
                <div className="bg-white/20 rounded-xl p-3 w-fit mb-4 group-hover:bg-white/30 transition-colors">
                  <SparklesIcon className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Innovation</h3>
                <p className="text-indigo-100 text-sm leading-relaxed">
                  Using proven patterns, not chasing trends
                </p>
              </div>
              <div className="group card-hover bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl p-8 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
                <div className="bg-white/20 rounded-xl p-3 w-fit mb-4 group-hover:bg-white/30 transition-colors">
                  <CheckBadgeIcon className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Quality</h3>
                <p className="text-pink-100 text-sm leading-relaxed">
                  Code and infrastructure that works in production
                </p>
              </div>
              <div className="group card-hover bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl p-8 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
                <div className="bg-white/20 rounded-xl p-3 w-fit mb-4 group-hover:bg-white/30 transition-colors">
                  <RocketLaunchIcon className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Velocity</h3>
                <p className="text-blue-100 text-sm leading-relaxed">
                  Ship faster with automation and best practices
                </p>
              </div>
              <div className="group card-hover bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-8 text-white shadow-xl transform hover:scale-105 transition-all duration-300">
                <div className="bg-white/20 rounded-xl p-3 w-fit mb-4 group-hover:bg-white/30 transition-colors">
                  <ShieldCheckIcon className="h-8 w-8" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Security</h3>
                <p className="text-emerald-100 text-sm leading-relaxed">
                  Security built-in, not bolted on
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold mb-6">
            Let's Talk
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Ready to build something great?
          </h2>
          <p className="text-xl md:text-2xl text-slate-700 dark:text-slate-300 mb-4 font-medium">
            Whether you're migrating to the cloud, optimizing costs, or building new platforms—we're here to help.
          </p>
          <p className="text-lg text-slate-600 dark:text-slate-400 mb-12">
            Have questions, feedback, or need support? We're here to help!
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <a
              href="mailto:support@visionxixlabs.com"
              className="group card-hover bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-600 transform hover:-translate-y-2 transition-all duration-300"
            >
              <div className="bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl p-4 w-fit mx-auto mb-4 group-hover:scale-110 transition-transform">
                <EnvelopeIcon className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                Email Us
              </h3>
              <p className="text-indigo-600 dark:text-indigo-400 font-semibold text-lg group-hover:underline">
                support@visionxixlabs.com
              </p>
            </a>
            <Link
              href="/contact"
              className="group card-hover bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl p-8 shadow-xl border-2 border-transparent transform hover:-translate-y-2 transition-all duration-300"
            >
              <div className="bg-white/20 rounded-xl p-4 w-fit mx-auto mb-4 group-hover:bg-white/30 transition-colors">
                <RocketLaunchIcon className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-white">
                Schedule a Call
              </h3>
              <p className="text-indigo-100 font-semibold">
                Let's discuss your cloud needs
              </p>
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              href="/privacy"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-4"
            >
              Privacy Policy
            </Link>
            <span className="text-slate-400">•</span>
            <Link
              href="/cloud-solutions"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-4"
            >
              Our Services
            </Link>
            <span className="text-slate-400">•</span>
            <Link
              href="/apps"
              className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 underline underline-offset-4"
            >
              Our Products
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-slate-300 py-16 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={48}
                  height={48}
                  className="rounded-xl shadow-lg"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  Vision XIX Labs
                </span>
              </div>
              <p className="text-slate-400 mb-4 leading-relaxed">
                Engineering multi-cloud platforms and products with a focus on
                reliability, security, and cost efficiency.
              </p>
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  AWS
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  Azure
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  GCP
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  Kubernetes
                </span>
                <span className="px-3 py-1 rounded-full bg-slate-800 text-xs font-semibold text-slate-300">
                  AI/ML
                </span>
              </div>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 text-lg">Solutions</h4>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/cloud-solutions"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    Cloud Solutions
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cloud-solutions/aws"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    AWS Services
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cloud-solutions/azure"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    Azure Services
                  </Link>
                </li>
                <li>
                  <Link
                    href="/cloud-solutions/gcp"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    GCP Services
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-bold mb-4 text-lg">Company</h4>
              <ul className="space-y-3">
                <li>
                  <a
                    href="#about"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    About Us
                  </a>
                </li>
                <li>
                  <Link
                    href="/apps"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    Our Products
                  </Link>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    Contact
                  </a>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="hover:text-indigo-400 transition-colors text-sm"
                  >
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a
                href="mailto:support@visionxixlabs.com"
                className="text-slate-400 hover:text-indigo-400 transition-colors text-sm"
              >
                support@visionxixlabs.com
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
