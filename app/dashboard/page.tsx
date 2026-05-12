"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

type Bot = {
  id: string;
  name: string;
  messageCount: number;
  messageLimit: number;
  pageCount: number;
  pageLimit: number;
  sources: { id: string; type: string; url?: string | null }[];
};

type Usage = { messages: number; pages: number; bots: number };
type Limits = { messages: number; pages: number; bots: number };

export default function DashboardPage() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [plan, setPlan] = useState<string>("starter");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadBots = () =>
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data) => {
        setBots(data.bots || []);
        setUsage(data.usage ?? null);
        setLimits(data.limits ?? null);
        setPlan(data.plan ?? "starter");
      });

  useEffect(() => {
    loadBots().finally(() => setLoading(false));
  }, []);

  const createBot = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "My Chatbot" }),
      });
      const data = await res.json();
      if (res.ok && data.bot) {
        await loadBots();
      } else {
        alert(data.error || "Failed to create");
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Reveal direction="up" blur delay={0.05}>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white tracking-[-0.04em]">Your <span className="text-gradient">chatbots</span></h1>
          <p className="text-zinc-400 mt-1">
            Create chatbots, train them on your site, and embed them on your website.
          </p>
          {usage && limits && (
            <div className="mt-3 flex flex-wrap gap-3">
              <span className="huly-badge">
                Plan: <span className="font-medium capitalize text-violet-400">{plan}</span>
              </span>
              <span className="huly-badge">{usage.messages} / {limits.messages} messages</span>
              <span className="huly-badge">{usage.pages} / {limits.pages} pages</span>
              <span className="huly-badge">{usage.bots} / {limits.bots} chatbots</span>
            </div>
          )}
        </div>
      </Reveal>

      <Reveal direction="up" blur delay={0.1}>
        <button
          onClick={createBot}
          disabled={creating}
          className="btn-huly cta-glow mb-8 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
        >
          <PlusIcon className="h-5 w-5" />
          {creating ? "Creating..." : "Create chatbot"}
        </button>
      </Reveal>

      <div className="space-y-4">
        {bots.length === 0 ? (
          <Reveal direction="up" blur delay={0.15}>
            <div className="glass-card rounded-2xl border-2 border-dashed border-white/[0.08] p-12 text-center">
              <ChatBubbleLeftRightIcon className="h-12 w-12 text-zinc-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-white mb-2 tracking-[-0.04em]">No chatbots yet</h2>
              <p className="text-zinc-400 mb-6 max-w-sm mx-auto">
                Create your first chatbot and train it on your website or documents.
              </p>
              <button
                onClick={createBot}
                disabled={creating}
                className="btn-huly cta-glow inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                <PlusIcon className="h-5 w-5" />
                Create chatbot
              </button>
            </div>
          </Reveal>
        ) : (
          <Stagger delay={0.1} interval={0.06}>
            {bots.map((bot) => (
              <div
                key={bot.id}
                className="glass-card card-hover animated-border card-inner-glow rounded-2xl p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white tracking-[-0.04em]">{bot.name}</h2>
                    <div className="mt-2 flex flex-wrap gap-3 text-sm text-zinc-500">
                      <span className="huly-badge">{(bot.sources ?? []).length} sources</span>
                      <span className="huly-badge">{bot.messageCount} messages</span>
                      <span className="huly-badge">{bot.pageCount} pages</span>
                    </div>
                  </div>
                  <Link
                    href={`/dashboard/bots/${bot.id}`}
                    className="btn-huly rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </Stagger>
        )}
      </div>

      <div className="section-divider my-10" />

      <Reveal direction="up" blur delay={0.15}>
        <div className="glass-card card-hover rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-2 tracking-[-0.04em]">Getting started</h2>
          <ol className="list-decimal list-inside space-y-2 text-zinc-400">
            <li>Create a chatbot</li>
            <li>Add URLs or text to train it</li>
            <li>Copy the embed code to your website</li>
          </ol>
        </div>
      </Reveal>
    </>
  );
}
