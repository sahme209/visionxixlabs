"use client";

import { useState } from "react";
import Link from "next/link";
import {
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  Bars3Icon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon as SparklesSolid } from "@heroicons/react/24/solid";
import { PARENT_WEBSITE, SUPPORT_EMAIL } from "@/lib/constants/company";

const STEPS = [
  {
    title: "Sync training data",
    desc: "Add your URL, docs, or raw content. We index your site and knowledge base.",
    icon: DocumentTextIcon,
  },
  {
    title: "Install on your site",
    desc: "Embed a branded chatbot on your site — or multiple sites. One line of code.",
    icon: GlobeAltIcon,
  },
  {
    title: "Learn and refine",
    desc: "Lead capture, analytics, and feedback. We improve the assistant over time.",
    icon: SparklesIcon,
  },
];

const FEATURES = [
  {
    title: "Production AI, not demos",
    desc: "Built for reliability, observability, and scale. Your data stays in your cloud.",
    icon: CpuChipIcon,
  },
  {
    title: "Lead capture",
    desc: "Capture emails and intent. Follow up with qualified leads from chat.",
    icon: ChatBubbleLeftRightIcon,
  },
  {
    title: "Escalate to human",
    desc: "One-click handoff to your team when the conversation needs a person.",
    icon: ArrowRightIcon,
  },
  {
    title: "Secure by design",
    desc: "RBAC, audit logs, no shared credentials. Enterprise-ready from day one.",
    icon: ShieldCheckIcon,
  },
];

export default function VisionXIXAILandingPage() {
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim()) return;
    setLeadStatus("loading");
    try {
      const res = await fetch("/api/visionxix-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: leadEmail.trim(),
          name: leadName.trim() || undefined,
          message: leadMessage.trim() || undefined,
          source: "visionxix-ai-landing",
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLeadStatus("success");
        setLeadEmail("");
        setLeadName("");
        setLeadMessage("");
      } else setLeadStatus("error");
    } catch {
      setLeadStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--border-color)] bg-[var(--bg-surface)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href={PARENT_WEBSITE} className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--uscis-blue)]/10">
              <SparklesSolid className="h-5 w-5 text-[var(--uscis-blue)]" />
            </div>
            <span className="font-semibold text-[var(--text-primary)]">Vision XIX Labs AI</span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            <a href="#how-it-works" className="text-sm text-[var(--text-secondary)] hover:text-[var(--uscis-blue)]">
              How it works
            </a>
            <a href="#features" className="text-sm text-[var(--text-secondary)] hover:text-[var(--uscis-blue)]">
              Features
            </a>
            <Link
              href="/visionxix-ai-assistant"
              className="text-sm font-medium text-[var(--uscis-blue)] hover:underline"
            >
              Try demo
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Vision XIX Labs AI - Demo Request`}
              className="rounded-full bg-[var(--uscis-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--uscis-blue-dark)]"
            >
              Book a demo
            </a>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 text-[var(--text-secondary)]"
          >
            {mobileMenuOpen ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[var(--border-color)] px-4 py-4 space-y-3">
            <a href="#how-it-works" className="block text-sm text-[var(--text-secondary)]" onClick={() => setMobileMenuOpen(false)}>How it works</a>
            <a href="#features" className="block text-sm text-[var(--text-secondary)]" onClick={() => setMobileMenuOpen(false)}>Features</a>
            <Link href="/visionxix-ai-assistant" className="block text-sm font-medium text-[var(--uscis-blue)]">Try demo</Link>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Demo Request`} className="block rounded-full bg-[var(--uscis-blue)] px-4 py-2 text-sm font-medium text-white text-center w-fit">
              Book a demo
            </a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[var(--text-primary)] tracking-tight">
            AI that knows your business
          </h1>
          <p className="mt-6 text-xl text-[var(--text-secondary)] max-w-2xl mx-auto">
            Production-ready chatbots trained on your site. 24/7 support, lead capture, and enterprise security.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/visionxix-ai-assistant"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--uscis-blue)] px-6 py-3 text-base font-semibold text-white hover:bg-[var(--uscis-blue-dark)]"
            >
              Try live demo
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Vision XIX Labs AI - Free Trial`}
              className="inline-flex items-center gap-2 rounded-full border-2 border-[var(--uscis-blue)] px-6 py-3 text-base font-semibold text-[var(--uscis-blue)] hover:bg-[var(--uscis-blue)]/5"
            >
              Start free trial
            </a>
          </div>
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">
            No credit card · 7-day trial · Cancel anytime
          </p>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[var(--bg-surface-alt)]">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[var(--text-primary)] mb-12">
            Before vs After
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">Before</h3>
              <ul className="space-y-3 text-[var(--text-secondary)]">
                <li className="flex gap-2"><span className="text-[var(--uscis-red)]">×</span> Generic chatbots that frustrate visitors</li>
                <li className="flex gap-2"><span className="text-[var(--uscis-red)]">×</span> Custom bots are brittle and hard to maintain</li>
                <li className="flex gap-2"><span className="text-[var(--uscis-red)]">×</span> Support team buried in repetitive tickets</li>
                <li className="flex gap-2"><span className="text-[var(--uscis-red)]">×</span> Leads slip away when no one's online</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-[var(--uscis-blue)]/30 bg-[var(--bg-surface)] p-6 shadow-[var(--shadow-colored)]">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4">After</h3>
              <ul className="space-y-3 text-[var(--text-secondary)]">
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-[var(--uscis-green)] shrink-0" /> AI trained on your content — accurate, on-brand</li>
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-[var(--uscis-green)] shrink-0" /> Production-ready: reliable, observable, scalable</li>
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-[var(--uscis-green)] shrink-0" /> 24/7 support + lead capture + escalate to human</li>
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-[var(--uscis-green)] shrink-0" /> Capture leads and qualify before your team picks up</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Three steps */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[var(--text-primary)] mb-4">
            Three steps to your own AI assistant
          </h2>
          <p className="text-center text-[var(--text-secondary)] mb-16 max-w-2xl mx-auto">
            Built for production, with lead capture, analytics, and enterprise security.
          </p>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--uscis-blue)]/10 text-[var(--uscis-blue)] mb-4">
                  <step.icon className="h-6 w-6" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--uscis-blue)] text-xs font-bold text-white">
                  {i + 1}
                </span>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{step.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-[var(--bg-surface-alt)]">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[var(--text-primary)] mb-4">
            Built for revenue, not just support
          </h2>
          <p className="text-center text-[var(--text-secondary)] mb-16 max-w-2xl mx-auto">
            Lead capture, analytics, and escalation — everything you need to convert visitors into customers.
          </p>
          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 hover:border-[var(--uscis-blue)]/30 transition-colors"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--uscis-blue)]/10 text-[var(--uscis-blue)] mb-3">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)]">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA + Lead form */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-[var(--text-primary)] mb-4">
            Ready to convert more visitors?
          </h2>
          <p className="text-center text-[var(--text-secondary)] mb-10">
            Request a demo or start a free trial. No obligation.
          </p>
          <form onSubmit={submitLead} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Name"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                className="rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
              />
              <input
                type="email"
                placeholder="Email *"
                required
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                className="rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
              />
            </div>
            <textarea
              placeholder="Tell us about your site or use case..."
              value={leadMessage}
              onChange={(e) => setLeadMessage(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-[var(--border-color)] px-4 py-3 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] resize-none"
            />
            <button
              type="submit"
              disabled={leadStatus === "loading"}
              className="w-full rounded-xl bg-[var(--uscis-blue)] py-3 font-semibold text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {leadStatus === "loading" ? "Sending..." : leadStatus === "success" ? "Submitted ✓" : "Request demo"}
            </button>
            {leadStatus === "success" && (
              <p className="text-center text-sm text-[var(--uscis-green)]">We&apos;ll be in touch shortly.</p>
            )}
            {leadStatus === "error" && (
              <p className="text-center text-sm text-[var(--uscis-red)]">Something went wrong. Please email us directly.</p>
            )}
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--border-color)] py-8 px-4">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href={PARENT_WEBSITE} className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--uscis-blue)]">
            Vision XIX Labs
          </Link>
          <div className="flex gap-6 text-sm text-[var(--text-secondary)]">
            <Link href="/visionxix-ai-assistant" className="hover:text-[var(--uscis-blue)]">Try demo</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-[var(--uscis-blue)]">Contact</a>
            <a href={`${PARENT_WEBSITE}/privacy`} className="hover:text-[var(--uscis-blue)]">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
