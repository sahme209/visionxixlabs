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
  LanguageIcon,
  CommandLineIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon as SparklesSolid } from "@heroicons/react/24/solid";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { Navigation } from "@/components/Navigation";
import { AIROICalculator } from "@/components/AIROICalculator";

const STEPS = [
  { title: "Sync training data", desc: "Add your URL, docs, or raw content. We index your site and knowledge base.", icon: DocumentTextIcon },
  { title: "Install on your site", desc: "Embed a branded chatbot on your site — or multiple sites. One line of code.", icon: GlobeAltIcon },
  { title: "Learn and refine", desc: "Lead capture, analytics, and feedback. We improve the assistant over time.", icon: SparklesIcon },
];

const FEATURES = [
  { title: "Production AI, not demos", desc: "Built for reliability, observability, and scale. Your data stays in your cloud.", icon: CpuChipIcon },
  { title: "Lead capture & analytics", desc: "Capture emails, intent, and conversation insights. Follow up with qualified leads.", icon: ChatBubbleLeftRightIcon },
  { title: "95+ languages", desc: "Assistant responds in the visitor's language. No extra setup.", icon: LanguageIcon },
  { title: "API access", desc: "Programmatic chat API for dashboards, workflows, and custom integrations.", icon: CommandLineIcon },
  { title: "Escalate to human", desc: "One-click handoff to your team when the conversation needs a person.", icon: ArrowRightIcon },
  { title: "Secure by design", desc: "RBAC, audit logs, SOC2-ready. Enterprise-ready from day one.", icon: ShieldCheckIcon },
];

const COMPARISON = [
  { feature: "Production AI", us: "✓ Built for ops", them: "Generic SaaS" },
  { feature: "Your cloud, your data", us: "✓ Optional self-host", them: "Their cloud only" },
  { feature: "API access", us: "✓ Full API", them: "Limited" },
  { feature: "Enterprise security", us: "✓ SOC2-ready", them: "Basic" },
  { feature: "Multi-language", us: "95+", them: "95+" },
  { feature: "Lead capture", us: "✓", them: "✓" },
  { feature: "Conversation analytics", us: "✓", them: "✓" },
];

const FAQ = [
  { q: "What makes Vision XIX AI different?", a: "Same idea—chatbot trained on your site—but we’re production-grade: your data in your cloud, full API, enterprise security (RBAC, SOC2-ready), and built by cloud engineers. We focus on reliability, observability, and scale." },
  { q: "Do you support multiple languages?", a: "Yes. The assistant responds in 95+ languages automatically when visitors ask in their language." },
  { q: "Can I use an API?", a: "Yes. We offer a full chat API for custom integrations, dashboards, and workflows." },
  { q: "How do you train the chatbot?", a: "Add your URL, sitemap, PDFs, docs, or raw text. We index your content and keep it in sync (daily, weekly, or on-demand)." },
];

export default function VisionXIXAILandingPage() {
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadMessage, setLeadMessage] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

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
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Navigation />

      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/30 px-4 py-1 text-xs font-semibold text-indigo-700 dark:text-indigo-200 mb-4">
            Vision XIX AI is part of the Axiom ecosystem.
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            AI that knows your business
          </h1>
          <p className="mt-6 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Production-ready chatbots trained on your site. 24/7 support, lead capture, email summaries, and enterprise security.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/visionxix-ai-assistant"
              className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700"
            >
              Try live demo
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <Link
              href="/visionxix-ai/pricing"
              className="inline-flex items-center gap-2 rounded-full border-2 border-indigo-600 px-6 py-3 text-base font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              View pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-500">No credit card · 7-day trial · Cancel anytime</p>
          <div className="mt-6">
            <Link
              href="/cloud-operator"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 dark:border-slate-600 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300"
            >
              Run Axiom for Infrastructure Intelligence
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-12">Before vs After</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Before</h3>
              <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                <li className="flex gap-2"><span className="text-red-600">×</span> Generic chatbots that frustrate visitors</li>
                <li className="flex gap-2"><span className="text-red-600">×</span> Custom bots are brittle and hard to maintain</li>
                <li className="flex gap-2"><span className="text-red-600">×</span> Support team buried in repetitive tickets</li>
                <li className="flex gap-2"><span className="text-red-600">×</span> Leads slip away when no one&apos;s online</li>
              </ul>
            </div>
            <div className="rounded-2xl border-2 border-indigo-500/30 bg-white dark:bg-slate-900 p-6 shadow-lg shadow-indigo-500/5">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">After</h3>
              <ul className="space-y-3 text-slate-600 dark:text-slate-400">
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> AI trained on your content</li>
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> Production-ready, reliable, scalable</li>
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> 24/7 + lead capture + escalate to human</li>
                <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> Capture and qualify leads before handoff</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">Three steps to your own AI assistant</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-16 max-w-2xl mx-auto">
            Built for production, with lead capture, analytics, and enterprise security.
          </p>
          <div className="grid md:grid-cols-3 gap-10">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="relative">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 mb-4">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{step.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{step.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="comparison" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">Why Vision XIX AI</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-12">Production-grade. Your cloud. Enterprise security.</p>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-4 px-4 font-semibold text-slate-900 dark:text-slate-100">Feature</th>
                  <th className="text-left py-4 px-4 font-semibold text-indigo-600">Vision XIX AI</th>
                  <th className="text-left py-4 px-4 font-semibold text-slate-500">Typical SaaS</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.feature} className={`${i % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-800/50"} ${i < COMPARISON.length - 1 ? "border-b border-slate-200 dark:border-slate-700" : ""}`}>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">{row.feature}</td>
                    <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400">{row.us}</td>
                    <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{row.them}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">Trusted by teams shipping AI</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto">
            Vision XIX AI is built for teams that need production-grade AI support — not demos.
          </p>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">&ldquo;The AI assistant handles 80% of our support tickets. Our team can focus on complex cases.&rdquo;</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">— Head of Support, SaaS</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">&ldquo;Lead capture and escalation to human are game-changers. We convert more visitors.&rdquo;</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">— Product Lead, B2B</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
              <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">&ldquo;Enterprise security and API access — exactly what we needed to integrate with our stack.&rdquo;</p>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">— CTO, Enterprise</p>
            </div>
          </div>
        </div>
      </section>

      <section id="integrations" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">Integrates with your stack</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-12 max-w-2xl mx-auto">
            Connect Vision XIX AI to Zendesk, Intercom, Crisp, and more. Full API for custom integrations.
          </p>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-24 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-400">Zendesk</div>
              <span className="text-xs text-slate-500">Help Center sync</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-24 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-400">Intercom</div>
              <span className="text-xs text-slate-500">Inbox + handoff</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-24 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-400">Crisp</div>
              <span className="text-xs text-slate-500">Live chat</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="h-12 w-24 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-400">API</div>
              <span className="text-xs text-slate-500">Custom</span>
            </div>
          </div>
        </div>
      </section>

      <AIROICalculator />

      <section id="embed" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">Embed on your site in one line</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-8 max-w-2xl mx-auto">
            Each chatbot gets a unique URL and embed code. Add it to your marketing site, help center, or in-app.
          </p>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-900">
            <pre className="p-6 text-sm text-emerald-400 overflow-x-auto font-mono">
{`<script src="https://visionxixlabs.com/widget.js" data-chat-id="YOUR_CHAT_ID"></script>`}
            </pre>
          </div>
        </div>
      </section>

      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">Built for revenue & scale</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-16 max-w-2xl mx-auto">
            Lead capture, analytics, 95+ languages, API access — plus production-grade security and your cloud.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 hover:border-indigo-400/50 transition-colors">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 mb-3">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">FAQ</h2>
          <div className="space-y-6">
            {FAQ.map((item) => (
              <div key={item.q} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">{item.q}</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-900 dark:text-slate-100 mb-4">Ready to convert more visitors?</h2>
          <p className="text-center text-slate-600 dark:text-slate-400 mb-10">Request a demo or start a free trial. No obligation.</p>
          <form onSubmit={submitLead} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <input type="text" placeholder="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
              <input type="email" placeholder="Email *" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} className="rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <textarea placeholder="Tell us about your site or use case..." value={leadMessage} onChange={(e) => setLeadMessage(e.target.value)} rows={3} className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <button type="submit" disabled={leadStatus === "loading"} className="w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed">
              {leadStatus === "loading" ? "Sending..." : leadStatus === "success" ? "Submitted ✓" : "Request demo"}
            </button>
            {leadStatus === "success" && <p className="text-center text-sm text-emerald-600">We&apos;ll be in touch shortly.</p>}
            {leadStatus === "error" && <p className="text-center text-sm text-red-600">Something went wrong. Please email us directly.</p>}
          </form>
        </div>
      </section>

      <footer className="border-t border-slate-200 dark:border-slate-700 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link href="/" className="text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600">Vision XIX Labs</Link>
          <div className="flex gap-6 text-sm text-slate-600 dark:text-slate-400">
            <Link href="/visionxix-ai-assistant" className="hover:text-indigo-600">Try demo</Link>
            <Link href="/visionxix-ai/pricing" className="hover:text-indigo-600">Pricing</Link>
            <Link href="/visionxix-ai/features" className="hover:text-indigo-600">Features</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-indigo-600">Contact</a>
            <Link href="/privacy" className="hover:text-indigo-600">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
