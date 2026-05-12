"use client";

import Link from "next/link";
import {
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  GlobeAltIcon,
  LanguageIcon,
  CommandLineIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  ChartBarIcon,
  BoltIcon,
  CubeTransparentIcon,
} from "@heroicons/react/24/outline";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import { Navigation } from "@/components/Navigation";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";
import { AnimatedButton } from "@/components/ui/AnimatedButton";

const TRAINING_FEATURES = [
  { title: "Import training content", desc: "Enter a URL to scan, upload PDFs/DOCX/CSV/MD, or drop raw text. We index your site and knowledge base.", icon: DocumentTextIcon },
  { title: "URL, sitemap, YouTube, Zendesk, Gitbook", desc: "Train from website, sitemap, YouTube, Zendesk Help Center, or Gitbook — enter a URL and we scrape it.", icon: GlobeAltIcon },
  { title: "Auto-sync", desc: "Retrain when your content changes — daily, weekly, or on-demand. Keep your chatbot up to date without manual work.", icon: BoltIcon },
];

const CHAT_FEATURES = [
  { title: "Quick prompts", desc: "Give visitors digital icebreakers. Add frequently asked questions or questions you wish more users would ask.", icon: SparklesIcon },
  { title: "95+ languages", desc: "Assistant responds in the visitor's language. No extra setup. Let visitors ask and respond in any language.", icon: LanguageIcon },
  { title: "Escalate to human", desc: "One-click handoff when the conversation needs a person. Hybrid AI + human support for best-in-class assistance.", icon: ArrowRightIcon },
  { title: "Lead capture", desc: "Capture interested visitors' details. Build a list of potential leads and follow up with qualified prospects.", icon: ChatBubbleLeftRightIcon },
  { title: "Chat history & analytics", desc: "Review conversations, assess performance, see what visitors ask. Gain insights into user behavior.", icon: ChartBarIcon },
];

const EXTENSION_FEATURES = [
  { title: "Functions", desc: "Natural language commands trigger in-app actions. Book a demo, schedule a call, add to CRM — all from chat.", icon: BoltIcon },
  { title: "Email summaries", desc: "Daily summaries delivered to your inbox. Track performance, upload more training data, stay on pulse of chatbot interactions.", icon: EnvelopeIcon },
  { title: "API access", desc: "Full chat API for dashboards, workflows, and custom integrations. Retrain, update settings, sync data programmatically.", icon: CommandLineIcon },
  { title: "Integrations", desc: "Native integrations with Zendesk, Intercom, Crisp. Chatbot becomes an extended arm of your support toolkit.", icon: CubeTransparentIcon },
];

const SECURITY_FEATURES = [
  { title: "Production AI", desc: "Built for reliability, observability, and scale. GPT-4o-mini and GPT-4o options. Your data in your cloud.", icon: ShieldCheckIcon },
  { title: "Enterprise security", desc: "RBAC, audit logs, SOC2-ready. No shared credentials. Enterprise-ready from day one.", icon: ShieldCheckIcon },
];

function FeatureGrid({ features }: { features: typeof TRAINING_FEATURES }) {
  return (
    <div className={`grid sm:grid-cols-2 ${features.length > 2 ? "lg:grid-cols-3" : ""} gap-6`}>
      <Stagger delay={0.1} interval={0.06}>
        {features.map((f) => {
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
  );
}

export default function VisionXIXAIFeaturesPage() {
  return (
    <div className="min-h-screen bg-[#09090b] relative">
      {/* Background layers */}
      <div className="fixed inset-0 bg-dots opacity-20 pointer-events-none" aria-hidden />
      <div className="fixed inset-0 noise-grain pointer-events-none" aria-hidden />
      <Navigation />

      {/* Hero */}
      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] spotlight-orb opacity-35 pointer-events-none" aria-hidden />
        <div className="absolute -top-32 right-10 w-64 h-64 rounded-full bg-fuchsia-600/8 blur-[100px] pointer-events-none" aria-hidden />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Reveal direction="up" blur delay={0.05}>
            <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-[-0.04em]">
              Everything you need for <span className="text-gradient">AI customer support</span>
            </h1>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <p className="mt-6 text-xl text-zinc-400 max-w-2xl mx-auto">
              Vision XIX AI is a production-ready support solution that does the work of a full support staff at a fraction of the cost.
            </p>
          </Reveal>
          <Reveal direction="up" blur delay={0.15}>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <AnimatedButton href="/visionxix-ai-assistant" variant="primary" className="px-6 py-3 text-base cta-glow">
                Try live demo
                <ArrowRightIcon className="h-5 w-5" />
              </AnimatedButton>
              <AnimatedButton href={`mailto:${SUPPORT_EMAIL}?subject=Demo Request`} variant="ghost" className="px-6 py-3 text-base">
                Book a demo
              </AnimatedButton>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* Training & customization */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]">Training & <span className="text-gradient">customization</span></h2>
            <p className="text-zinc-400 mb-10">Unlock the full potential of your chatbot by customizing its knowledge.</p>
          </Reveal>
          <FeatureGrid features={TRAINING_FEATURES} />
        </div>
      </section>

      <div className="section-divider" />

      {/* Chat interactions */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]">Chat <span className="text-gradient">interactions</span></h2>
            <p className="text-zinc-400 mb-10">Enhance user interactions with advanced AI, multi-language support, and seamless human escalation.</p>
          </Reveal>
          <FeatureGrid features={CHAT_FEATURES} />
        </div>
      </section>

      <div className="section-divider" />

      {/* Extensions */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 bg-grid-mesh opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-5xl mx-auto relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]"><span className="text-gradient">Extensions</span></h2>
            <p className="text-zinc-400 mb-10">Extend your chatbot with automation, summaries, and integrations.</p>
          </Reveal>
          <FeatureGrid features={EXTENSION_FEATURES} />
        </div>
      </section>

      <div className="section-divider" />

      {/* Security & production */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-white mb-2 tracking-[-0.04em]">Security & <span className="text-gradient">production</span></h2>
            <p className="text-zinc-400 mb-10">Built for enterprise. Your data, your cloud, your control.</p>
          </Reveal>
          <FeatureGrid features={SECURITY_FEATURES} />
        </div>
      </section>

      <div className="section-divider" />

      {/* Embed */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">Embed on <span className="text-gradient">your site</span></h2>
            <p className="text-zinc-400 mb-6">Each chatbot gets a unique URL and embed code. Add it to your marketing site, help center, or in-app.</p>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <div className="glass-card rounded-xl border border-white/[0.06] p-6 overflow-x-auto">
              <pre className="text-sm text-emerald-400 font-mono">
{`<script src="https://visionxixlabs.com/widget.js" data-chat-id="YOUR_CHAT_ID"></script>`}
              </pre>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="section-divider" />

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[300px] spotlight-orb opacity-20 pointer-events-none" aria-hidden />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <Reveal direction="up" blur>
            <h2 className="text-2xl font-bold text-white mb-4 tracking-[-0.04em]">Ready to <span className="text-gradient">supercharge</span> your support?</h2>
          </Reveal>
          <Reveal direction="up" blur delay={0.1}>
            <AnimatedButton href="/visionxix-ai" variant="primary" className="px-6 py-3 text-base cta-glow">
              Get started
              <ArrowRightIcon className="h-5 w-5" />
            </AnimatedButton>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
