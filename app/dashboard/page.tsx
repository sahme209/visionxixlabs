"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  PlusIcon,
  ChatBubbleLeftRightIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your chatbots</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Create chatbots, train them on your site, and embed them on your website.
        </p>
        {usage && limits && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Plan: <span className="font-medium capitalize">{plan}</span> — {usage.messages} / {limits.messages} messages · {usage.pages} / {limits.pages} pages · {usage.bots} / {limits.bots} chatbots
          </p>
        )}
      </div>

      <button
        onClick={createBot}
        disabled={creating}
        className="mb-8 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
      >
        <PlusIcon className="h-5 w-5" />
        {creating ? "Creating..." : "Create chatbot"}
      </button>

      <div className="space-y-4">
        {bots.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-12 text-center">
            <ChatBubbleLeftRightIcon className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">No chatbots yet</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-sm mx-auto">
              Create your first chatbot and train it on your website or documents.
            </p>
            <button
              onClick={createBot}
              disabled={creating}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              <PlusIcon className="h-5 w-5" />
              Create chatbot
            </button>
          </div>
        ) : (
          bots.map((bot) => (
            <div
              key={bot.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{bot.name}</h2>
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-slate-500">
                    <span>{(bot.sources ?? []).length} sources</span>
                    <span>{bot.messageCount} messages</span>
                    <span>{bot.pageCount} pages</span>
                  </div>
                </div>
                <Link
                  href={`/dashboard/bots/${bot.id}`}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Manage
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-12 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Getting started</h2>
        <ol className="list-decimal list-inside space-y-2 text-slate-600 dark:text-slate-400">
          <li>Create a chatbot</li>
          <li>Add URLs or text to train it</li>
          <li>Copy the embed code to your website</li>
        </ol>
      </div>
    </>
  );
}
