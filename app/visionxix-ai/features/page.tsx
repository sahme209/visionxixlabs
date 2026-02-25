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

export default function VisionXIXAIFeaturesPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <Navigation />

      <section className="pt-28 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Everything you need for AI customer support
          </h1>
          <p className="mt-6 text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            Vision XIX AI is a production-ready support solution that does the work of a full support staff at a fraction of the cost.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/visionxix-ai-assistant" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700">
              Try live demo
              <ArrowRightIcon className="h-5 w-5" />
            </Link>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=Demo Request`} className="inline-flex items-center gap-2 rounded-full border-2 border-indigo-600 px-6 py-3 text-base font-semibold text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20">
              Book a demo
            </a>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Training & customization</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">Unlock the full potential of your chatbot by customizing its knowledge.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {TRAINING_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
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

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Chat interactions</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">Enhance user interactions with advanced AI, multi-language support, and seamless human escalation.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {CHAT_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
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

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Extensions</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">Extend your chatbot with automation, summaries, and integrations.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {EXTENSION_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
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

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Security & production</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-10">Built for enterprise. Your data, your cloud, your control.</p>
          <div className="grid sm:grid-cols-2 gap-6">
            {SECURITY_FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
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

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50 dark:bg-slate-800/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Embed on your site</h2>
          <p className="text-slate-600 dark:text-slate-400 mb-6">Each chatbot gets a unique URL and embed code. Add it to your marketing site, help center, or in-app.</p>
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 p-6 overflow-x-auto">
            <pre className="text-sm text-emerald-400 font-mono">
{`<script src="https://visionxixlabs.com/widget.js" data-chat-id="YOUR_CHAT_ID"></script>`}
            </pre>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">Ready to supercharge your support?</h2>
          <Link href="/visionxix-ai" className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-semibold text-white hover:bg-indigo-700">
            Get started
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
