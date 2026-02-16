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
              <Image
                src="/vision-xix-logo.png"
                alt="Vision XIX Labs"
                width={32}
                height={32}
                className="rounded-md"
                priority
              />
              <span className="text-xl font-bold bg-gradient-to-r from-indigo-500 to-sky-400 bg-clip-text text-transparent">
                Vision XIX Labs
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link
                href="/apps"
                className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Apps
              </Link>
              <a
                href="#solutions"
                className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Solutions
              </a>
              <Link
                href="/cloud-solutions"
                className="text-slate-700 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                Cloud Solutions
              </Link>
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
              <Link
                href="/services"
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300"
              >
                AWS Services
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </Link>
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
                Cloud platforms and products, built with care
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold mb-6 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
              Vision XIX Labs
            </h1>
            <p className="text-xl md:text-2xl text-slate-600 dark:text-slate-400 mb-8 max-w-3xl mx-auto">
              A cloud consulting and product studio helping teams design,
              automate, and operate reliable platforms on AWS and Azure.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="#contact"
                className="inline-flex items-center px-8 py-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-semibold shadow-lg hover:shadow-xl border border-slate-200 dark:border-slate-700 transform hover:-translate-y-1 transition-all duration-300"
              >
                Get in Touch
              </a>
              <Link
                href="/cloud-solutions"
                className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-1 transition-all duration-300"
              >
                Explore Cloud Solutions
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center px-8 py-4 bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 rounded-xl font-semibold shadow-lg hover:shadow-xl border border-slate-200/80 dark:border-slate-700 transform hover:-translate-y-1 transition-all duration-300"
              >
                AWS Services
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* (Apps now live on /apps; homepage focuses on cloud solutions) */}

      {/* Solutions / Services Overview */}
      <section
        id="solutions"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100">
              AWS &amp; DevOps Solutions
            </h2>
            <p className="text-xl text-slate-600 dark:text-slate-400 max-w-3xl mx-auto">
              Beyond mobile apps, we help teams design AWS cloud infrastructure,
              modernize CI/CD with GitHub and Octopus Deploy, and improve cost,
              reliability, and security.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="card-hover bg-slate-50 dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                AWS Cloud Infrastructure
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
                Design, provisioning, and networking foundations for a stable AWS
                environment.
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-6">
                <li>Design and scaling on AWS</li>
                <li>EC2 and EBS architecture guidance</li>
                <li>VPC patterns, routing, and security groups</li>
              </ul>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Outcomes: stable, scalable foundation; faster deployments; fewer
                incidents.
              </p>
            </div>
            <div className="card-hover bg-slate-50 dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                CI/CD &amp; Release Automation
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
                Practical delivery pipelines built around GitHub and Octopus
                Deploy.
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-6">
                <li>GitHub-based workflows</li>
                <li>Octopus Deploy release pipelines</li>
                <li>Environment consistency across dev, test, and prod</li>
              </ul>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
                Outcomes: safer releases; repeatable deployments; reduced manual
                effort.
              </p>
            </div>
            <div className="card-hover bg-slate-50 dark:bg-slate-800 rounded-2xl p-8 shadow-xl border border-slate-200 dark:border-slate-700">
              <h3 className="text-2xl font-bold mb-2 text-slate-900 dark:text-slate-100">
                Cost, Reliability &amp; Security
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4 text-sm">
                FinOps, observability, and governance practices that grow with
                your business.
              </p>
              <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1 mb-6">
                <li>Cost optimization and right-sizing</li>
                <li>Monitoring, logging, and SLO-aligned alerts</li>
                <li>IAM patterns and policy guardrails</li>
              </ul>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-6">
                Outcomes: lower spend; faster detection and recovery; reduced
                risk.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/cloud-solutions"
                  className="inline-flex items-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  View Cloud Solutions
                  <ArrowRightIcon className="ml-1 h-4 w-4" />
                </Link>
                <Link
                  href="/cloud-solutions/aws"
                  className="inline-flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  AWS details
                </Link>
                <Link
                  href="/cloud-solutions/azure"
                  className="inline-flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-indigo-700 dark:hover:text-indigo-300"
                >
                  Azure details
                </Link>
              </div>
            </div>
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
                <Image
                  src="/vision-xix-logo.png"
                  alt="Vision XIX Labs"
                  width={28}
                  height={28}
                  className="rounded-md"
                />
                <span className="text-lg font-bold text-white">Vision XIX Labs</span>
              </div>
              <p className="text-slate-400">
                Engineering multi-cloud platforms and products with a focus on
                reliability, security, and cost efficiency.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/apps"
                    className="hover:text-indigo-400 transition-colors"
                  >
                    Our Apps
                  </Link>
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
