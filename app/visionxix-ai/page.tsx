"use client";

import { useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
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
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { Navigation } from "@/components/Navigation";
import { AIROICalculator } from "@/components/AIROICalculator";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

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
  { feature: "Production AI", us: "Built for ops", them: "Generic SaaS" },
  { feature: "Your cloud, your data", us: "Optional self-host", them: "Their cloud only" },
  { feature: "API access", us: "Full API", them: "Limited" },
  { feature: "Enterprise security", us: "SOC2-ready", them: "Basic" },
  { feature: "Multi-language", us: "95+", them: "95+" },
  { feature: "Lead capture", us: "Yes", them: "Yes" },
  { feature: "Conversation analytics", us: "Yes", them: "Yes" },
];

const FAQ = [
  { q: "What makes Vision XIX AI different?", a: "Same idea--chatbot trained on your site--but we're production-grade: your data in your cloud, full API, enterprise security (RBAC, SOC2-ready), and built by cloud engineers. We focus on reliability, observability, and scale." },
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
    <div className="min-h-screen bg-[#09090b] relative">
      {/* Background layers */}
      <div className="fixed inset-0 bg-dots opacity-20 pointer-events-none" aria-hidden />
      <div className="fixed inset-0 noise-grain pointer-events-none" aria-hidden />
      <Navigation />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] spotlight-orb opacity-40 pointer-events-none" aria-hidden />
        <div className="absolute -top-40 right-0 w-80 h-80 rounded-full bg-fuchsia-600/8 blur-[120px] pointer-events-none" aria-hidden />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Reveal direction="up" blur delay={0.05}>
            <div className="inline-flex items-center justify-center huly-badge px-4 py-1 text-xs font-semibold text-violet-400 mb-4">
              Vision XIX AI is part of the Axiom ecosystem.
            </div>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-[-0.04em]">
              AI that <span className="text-gradient">knows your business</span>
            </h1>
          </Reveal>
          <Reveal direction="up" blur delay={0.15}>
            <p className="mt-6 text-xl text-zinc-400 max-w-2xl mx-auto">
              Production-ready chatbots trained on your site. 24/7 support, lead capture, email summaries, and enterprise security.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.2}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <AnimatedButton href="/visionxix-ai-assistant" variant="primary" className="px-6 py-3 text-base cta-glow">
                Try live demo
                <ArrowRightIcon className="h-5 w-5" />
              </AnimatedButton>
              <AnimatedButton href="/visionxix-ai/pricing" variant="ghost" className="px-6 py-3 text-base">
                View pricing
              </AnimatedButton>
            </div>
          </Reveal>
          <Reveal direction="up" blur delay={0.25}>
            <p className="mt-4 text-sm text-zinc-500">No credit card &middot; 7-day trial &middot; Cancel anytime</p>
            <div className="mt-6">
              <Link
                href="/cloud-operator"
                className="inline-flex items-center gap-2 huly-badge px-4 py-2 text-xs font-semibold text-zinc-200 hover:border-violet-500/40 hover:text-white transition-colors"
              >
                Run Infrastructure Analysis with Axiom
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Before vs After */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-12 tracking-[-0.04em]">Before vs <span className="text-gradient">After</span></h2>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-8">
            <Reveal direction="up" blur delay={0.1}>
              <div className="animated-border rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Before</h3>
                <ul className="space-y-3 text-zinc-400">
                  <li className="flex gap-2"><span className="text-red-600">&times;</span> Generic chatbots that frustrate visitors</li>
                  <li className="flex gap-2"><span className="text-red-600">&times;</span> Custom bots are brittle and hard to maintain</li>
                  <li className="flex gap-2"><span className="text-red-600">&times;</span> Support team buried in repetitive tickets</li>
                  <li className="flex gap-2"><span className="text-red-600">&times;</span> Leads slip away when no one&apos;s online</li>
                </ul>
              </div>
            </Reveal>
            <Reveal direction="up" blur delay={0.15}>
              <div className="animated-border card-inner-glow rounded-2xl border-2 border-violet-500/30 bg-white/[0.02] p-6 shadow-lg shadow-violet-500/5">
                <h3 className="text-lg font-semibold text-white mb-4">After</h3>
                <ul className="space-y-3 text-zinc-400">
                  <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> AI trained on your content</li>
                  <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> Production-ready, reliable, scalable</li>
                  <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> 24/7 + lead capture + escalate to human</li>
                  <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 text-emerald-500 shrink-0" /> Capture and qualify leads before handoff</li>
                </ul>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />
        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">Three steps to your own <span className="text-gradient">AI assistant</span></h2>
            <p className="text-center text-zinc-400 mb-16 max-w-2xl mx-auto">
              Built for production, with lead capture, analytics, and enterprise security.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-10">
            <Stagger delay={0.1} interval={0.06}>
              {STEPS.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative animated-border card-inner-glow card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 mb-4">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-bold text-white">{i + 1}</span>
                    <h3 className="text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-zinc-400">{step.desc}</p>
                  </div>
                );
              })}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Comparison */}
      <section id="comparison" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">Why <span className="text-gradient">Vision XIX AI</span></h2>
            <p className="text-center text-zinc-400 mb-12">Production-grade. Your cloud. Enterprise security.</p>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <div className="glass-card rounded-2xl border border-white/[0.06] overflow-hidden shadow-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-white/[0.03] border-b border-white/[0.06]">
                    <th className="text-left py-4 px-4 font-semibold text-white">Feature</th>
                    <th className="text-left py-4 px-4 font-semibold text-violet-400">Vision XIX AI</th>
                    <th className="text-left py-4 px-4 font-semibold text-zinc-500">Typical SaaS</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={`bg-white/[0.02] ${i < COMPARISON.length - 1 ? "border-b border-white/[0.06]" : ""}`}>
                      <td className="py-3 px-4 font-medium text-white">{row.feature}</td>
                      <td className="py-3 px-4 text-emerald-400">{row.us}</td>
                      <td className="py-3 px-4 text-zinc-500">{row.them}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">Trusted by teams shipping AI</h2>
            <p className="text-center text-zinc-400 mb-12 max-w-2xl mx-auto">
              Vision XIX AI is built for teams that need production-grade AI support — not demos.
            </p>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-8">
            <Stagger delay={0.1} interval={0.06}>
              {[
                { quote: "The AI assistant handles 80% of our support tickets. Our team can focus on complex cases.", author: "Head of Support, SaaS" },
                { quote: "Lead capture and escalation to human are game-changers. We convert more visitors.", author: "Product Lead, B2B" },
                { quote: "Enterprise security and API access — exactly what we needed to integrate with our stack.", author: "CTO, Enterprise" },
              ].map((t) => (
                <div key={t.author} className="animated-border card-inner-glow card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                  <p className="text-zinc-400 text-sm mb-4">&ldquo;{t.quote}&rdquo;</p>
                  <p className="text-sm font-semibold text-white">— {t.author}</p>
                </div>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Integrations */}
      <section id="integrations" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">Integrates with <span className="text-gradient">your stack</span></h2>
            <p className="text-center text-zinc-400 mb-12 max-w-2xl mx-auto">
              Connect Vision XIX AI to Zendesk, Intercom, Crisp, and more. Full API for custom integrations.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <div className="flex flex-wrap justify-center gap-8 items-center">
              {[
                { name: "Zendesk", sub: "Help Center sync" },
                { name: "Intercom", sub: "Inbox + handoff" },
                { name: "Crisp", sub: "Live chat" },
                { name: "API", sub: "Custom" },
              ].map((item) => (
                <div key={item.name} className="flex flex-col items-center gap-2">
                  <div className="h-12 w-24 rounded-lg glass-card border border-white/[0.06] flex items-center justify-center text-xs font-semibold text-zinc-400 hover-lift transition-transform">{item.name}</div>
                  <span className="text-xs text-zinc-500">{item.sub}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      <AIROICalculator />

      <div className="section-divider" />

      {/* Embed */}
      <section id="embed" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">Embed on your site in <span className="text-gradient">one line</span></h2>
            <p className="text-center text-zinc-400 mb-8 max-w-2xl mx-auto">
              Each chatbot gets a unique URL and embed code. Add it to your marketing site, help center, or in-app.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <div className="glass-card rounded-2xl border border-white/[0.06] overflow-hidden">
              <pre className="p-6 text-sm text-emerald-400 overflow-x-auto font-mono">
{`<script src="https://visionxixlabs.com/widget.js" data-chat-id="YOUR_CHAT_ID"></script>`}
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">Built for <span className="text-gradient">revenue &amp; scale</span></h2>
            <p className="text-center text-zinc-400 mb-16 max-w-2xl mx-auto">
              Lead capture, analytics, 95+ languages, API access — plus production-grade security and your cloud.
            </p>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <Stagger delay={0.1} interval={0.06}>
              {FEATURES.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="animated-border card-inner-glow card-hover rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-400 mb-3">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{f.title}</h3>
                    <p className="text-sm text-zinc-400">{f.desc}</p>
                  </div>
                );
              })}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">FAQ</h2>
          </Reveal>
          <div className="space-y-6">
            <Stagger delay={0.1} interval={0.06}>
              {FAQ.map((item) => (
                <div key={item.q} className="animated-border rounded-xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <h3 className="font-semibold text-white mb-2">{item.q}</h3>
                  <p className="text-sm text-zinc-400">{item.a}</p>
                </div>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <div className="section-divider" />

      {/* Contact / Lead Form */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[400px] spotlight-orb opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-2xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl sm:text-3xl font-bold text-center text-white mb-4 tracking-[-0.04em]">Ready to convert more <span className="text-gradient">visitors</span>?</h2>
            <p className="text-center text-zinc-400 mb-10">Request a demo or start a free trial. No obligation.</p>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <form onSubmit={submitLead} className="glass-card rounded-2xl border border-white/[0.06] p-8 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <input type="text" placeholder="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors" />
                <input type="email" placeholder="Email *" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-colors" />
              </div>
              <textarea placeholder="Tell us about your site or use case..." value={leadMessage} onChange={(e) => setLeadMessage(e.target.value)} rows={3} className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 resize-none transition-colors" />
              <button type="submit" disabled={leadStatus === "loading"} className="btn-huly cta-glow w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 font-semibold text-white hover:shadow-lg hover:shadow-violet-500/30 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                {leadStatus === "loading" ? "Sending..." : leadStatus === "success" ? "Submitted" : "Request demo"}
              </button>
              {leadStatus === "success" && <p className="text-center text-sm text-emerald-400">We&apos;ll be in touch shortly.</p>}
              {leadStatus === "error" && <p className="text-center text-sm text-red-400">Something went wrong. Please email us directly.</p>}
            </form>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
