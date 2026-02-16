"use client";

import Image from "next/image";
import Link from "next/link";
import {
  EnvelopeIcon,
  ShieldCheckIcon,
  SparklesIcon,
  RocketLaunchIcon,
  CheckBadgeIcon,
  ArrowRightIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "../components/Navigation";
import { EnterpriseTrustSignals } from "@/components/EnterpriseTrustSignals";

export default function Home() {

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
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="text-indigo-600 dark:text-indigo-400">Cloud &amp; AI Engineering</span>
            <span className="text-slate-900 dark:text-slate-100"> for Modern Infrastructure</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
            We design, automate, optimize, and secure cloud platforms across AWS, Azure, and Google Cloud — with production-grade AI integration and DevOps automation.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Link
              href="/contact"
              className="inline-flex items-center px-6 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-xl font-semibold shadow-md hover:opacity-90 transition-opacity"
            >
              Talk to an Engineer
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
            <Link
              href="/cloud-solutions"
              className="inline-flex items-center px-6 py-3 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-xl font-semibold border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              Explore Solutions
              <ArrowRightIcon className="ml-2 h-5 w-5" />
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <Link
              href="/cloud-solutions/aws"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
            >
              <span className="text-orange-600 dark:text-orange-400 font-semibold mr-1">AWS</span>
              Cloud
            </Link>
            <Link
              href="/cloud-solutions/azure"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <span className="text-blue-600 dark:text-blue-400 font-semibold mr-1">Azure</span>
              Cloud
            </Link>
            <Link
              href="/cloud-solutions/gcp"
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-red-300 dark:hover:border-red-600 transition-colors"
            >
              <span className="text-red-600 dark:text-red-400 font-semibold mr-1">GCP</span>
              Cloud
            </Link>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
            Foundations · CI/CD · FinOps · Observability · Security · IaC
          </p>
        </div>
      </section>

      <EnterpriseTrustSignals />

      {/* (Apps now live on /apps; homepage focuses on cloud solutions) */}

      {/* Capabilities summary — no fabricated metrics */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">AWS</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Cloud platforms</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Azure</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Cloud platforms</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">GCP</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Cloud platforms</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">IaC</div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Infrastructure as Code</div>
            </div>
          </div>
        </div>
      </section>

      {/* Solutions / Services Overview */}
      <section
        id="solutions"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900"
        aria-labelledby="solutions-heading"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 id="solutions-heading" className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-4">
              Multi-cloud engineering solutions
            </h2>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              We design, automate, and operate cloud platforms across AWS, Azure, and Google Cloud with a focus on reliability, security, and cost efficiency.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div>
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
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div>
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
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
              <div>
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

          {/* Solutions for Growing Teams */}
          <section
            className="mt-16 pt-16 border-t border-slate-200 dark:border-slate-700"
            aria-labelledby="growing-teams-heading"
          >
            <div className="text-center mb-8">
              <h2 id="growing-teams-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Cloud &amp; AI Solutions for Growing Teams
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
                Fixed-scope packages for startups and small businesses: health checks, CI/CD setup, AI automation, cost optimization.
              </p>
              <Link
                href="/solutions-for-growing-teams"
                className="inline-flex items-center text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                View packages
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </section>

          {/* Secure-by-Design Cloud Engineering */}
          <section
            className="mt-16 pt-16 border-t border-slate-200 dark:border-slate-700"
            aria-labelledby="cloud-security-heading"
          >
            <div className="text-center mb-8">
              <h2 id="cloud-security-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-3">
                Secure-by-Design Cloud Engineering
              </h2>
              <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto mb-6">
                Security baseline, DevOps hardening, AI security review, and visibility setup — practical hardening without exaggerated claims.
              </p>
              <Link
                href="/cloud-security"
                className="inline-flex items-center text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
              >
                Cloud Security &amp; Hardening
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </section>
        </div>
      </section>

      {/* About Section */}
      <section
        id="about"
        className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30"
        aria-labelledby="about-heading"
      >
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 id="about-heading" className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                Engineering-first cloud consulting
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
                We work alongside engineering teams to design, automate, and operate cloud platforms. Infrastructure as Code, CI/CD, and clear documentation so you can run and improve after handover.
              </p>
              <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                We also build products—from immigration case tracking to health and productivity apps—shipping software that solves real problems.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/cloud-solutions"
                  className="inline-flex items-center px-5 py-2.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  Solutions
                  <ArrowRightIcon className="ml-1.5 h-4 w-4" />
                </Link>
                <Link
                  href="/case-studies"
                  className="inline-flex items-center px-5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
                >
                  Case Studies
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex items-center px-5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg font-semibold text-sm hover:border-slate-300 dark:hover:border-slate-500 transition-colors"
                >
                  Contact
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
                <SparklesIcon className="h-7 w-7 text-slate-600 dark:text-slate-400 mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Proven patterns</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">We use established practices, not unproven trends.</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
                <CheckBadgeIcon className="h-7 w-7 text-slate-600 dark:text-slate-400 mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Production-ready</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Code and infrastructure built to run in production.</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
                <RocketLaunchIcon className="h-7 w-7 text-slate-600 dark:text-slate-400 mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Automation</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Pipelines and IaC to ship faster and safer.</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
                <ShieldCheckIcon className="h-7 w-7 text-slate-600 dark:text-slate-400 mb-3" />
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Security by design</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Access control and governance built in from the start.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-4 sm:px-6 lg:px-8 border-t border-slate-200 dark:border-slate-700" aria-labelledby="contact-heading">
        <div className="max-w-3xl mx-auto text-center">
          <h2 id="contact-heading" className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-4">
            Discuss your requirements
          </h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">
            For cloud migration, cost optimization, or platform design—we work with CTOs, VP Engineering, and technical leads to define scope and delivery.
          </p>
          <div className="grid md:grid-cols-2 gap-6 mb-10">
            <a
              href="mailto:support@visionxixlabs.com"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
            >
              <EnvelopeIcon className="h-8 w-8 text-slate-600 dark:text-slate-400 mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-1">Email</h3>
              <p className="text-slate-600 dark:text-slate-400 text-sm">support@visionxixlabs.com</p>
            </a>
            <Link
              href="/contact"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 p-6 shadow-sm hover:opacity-90 transition-opacity"
            >
              <RocketLaunchIcon className="h-8 w-8 text-white dark:text-slate-900 mb-3" />
              <h3 className="text-lg font-semibold mb-1">Contact form</h3>
              <p className="text-slate-300 dark:text-slate-600 text-sm">Request a call or send a message</p>
            </Link>
          </div>
          <div className="flex flex-wrap justify-center gap-4 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Privacy</Link>
            <Link href="/cloud-solutions" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Solutions</Link>
            <Link href="/case-studies" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Case Studies</Link>
            <Link href="/apps" className="hover:text-slate-900 dark:hover:text-slate-100 underline underline-offset-4">Products</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={40}
                  height={40}
                  className="rounded-lg"
                />
                <span className="text-lg font-bold text-white">
                  Vision XIX Labs
                </span>
              </div>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">
                Cloud &amp; AI engineering for modern infrastructure. AWS, Azure, GCP — design, automate, optimize, secure.
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
              <h4 className="text-white font-semibold mb-4 text-sm">Solutions</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/cloud-solutions" className="hover:text-white transition-colors">Cloud Solutions</Link></li>
                <li><Link href="/cloud-security" className="hover:text-white transition-colors">Cloud Security</Link></li>
                <li><Link href="/cloud-solutions/aws" className="hover:text-white transition-colors">AWS</Link></li>
                <li><Link href="/cloud-solutions/azure" className="hover:text-white transition-colors">Azure</Link></li>
                <li><Link href="/cloud-solutions/gcp" className="hover:text-white transition-colors">GCP</Link></li>
                <li><Link href="/ai-solutions" className="hover:text-white transition-colors">AI Solutions</Link></li>
                <li><Link href="/solutions-for-growing-teams" className="hover:text-white transition-colors">Growing Teams</Link></li>
                <li><Link href="/case-studies" className="hover:text-white transition-colors">Case Studies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#about" className="hover:text-white transition-colors">About</a></li>
                <li><Link href="/apps" className="hover:text-white transition-colors">Products</Link></li>
                <li><Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4 text-sm">Connect</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/contact" className="hover:text-white transition-colors">Contact</Link></li>
                <li>
                  <a href="mailto:support@visionxixlabs.com" className="hover:text-white transition-colors">
                    support@visionxixlabs.com
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} Vision XIX Labs LLC. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
