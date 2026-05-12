"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  PaperAirplaneIcon,
  ClipboardDocumentIcon,
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

export default function BotManagePage() {
  const params = useParams();
  const router = useRouter();
  const botId = params.botId as string;

  const [bot, setBot] = useState<Bot | null>(null);
  const [usage, setUsage] = useState<{ messages: number; pages: number } | null>(null);
  const [limits, setLimits] = useState<{ messages: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [training, setTraining] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const loadData = () =>
    fetch("/api/bots")
      .then((r) => r.json())
      .then((data) => {
        const b = (data.bots || []).find((x: Bot) => x.id === botId);
        setBot(b || null);
        setUsage(data.usage ?? null);
        setLimits(data.limits ?? null);
      });

  useEffect(() => {
    loadData().finally(() => setLoading(false));
  }, [botId]);

  const train = async (type: "url" | "text") => {
    setError("");
    setTraining(true);
    try {
      const body = type === "url" ? { botId, url: url.trim() } : { botId, text: text.trim() };
      const res = await fetch("/api/bots/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to train");
        return;
      }
      setUrl("");
      setText("");
      await loadData();
    } finally {
      setTraining(false);
    }
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://visionxixlabs.com";
  const embedCode = `<script src="${baseUrl}/embed.js" data-bot-id="${botId}"></script>`;

  const copyEmbed = () => {
    navigator.clipboard?.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400">Bot not found.</p>
        <Link href="/dashboard" className="mt-4 inline-flex items-center gap-2 text-indigo-600 hover:underline">
          <ArrowLeftIcon className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-zinc-400 hover:text-indigo-600">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to dashboard
      </Link>

      <h1 className="text-2xl font-bold text-white">{bot.name}</h1>
      <p className="text-zinc-400">
        {(bot.sources ?? []).length} sources
        {usage && limits && (
          <> · {usage.messages} / {limits.messages} messages · {usage.pages} / {limits.pages} pages</>
        )}
      </p>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <DocumentTextIcon className="h-5 w-5 text-indigo-600" />
          Add training content
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Website URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => train("url")}
                disabled={!url.trim() || training}
                className="rounded-xl bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {training ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Raw text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste text content..."
              rows={4}
              className="w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            <button
              onClick={() => train("text")}
              disabled={!text.trim() || training}
              className="mt-2 rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {training ? "Adding..." : "Add text"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {(bot.sources ?? []).length > 0 && (
            <div className="mt-4 pt-4 border-t border-white/[0.06]">
              <p className="text-sm font-medium text-zinc-300 mb-2">Sources</p>
              <ul className="space-y-1 text-sm text-zinc-400">
                {(bot.sources ?? []).map((s) => (
                  <li key={s.id}>
                    {s.type === "url" ? s.url : `Text (${s.type})`}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <CodeBracketIcon className="h-5 w-5 text-indigo-600" />
          Embed on your site
        </h2>
        <p className="text-sm text-zinc-400 mb-3">
          Add this code before the closing &lt;/body&gt; tag on your website.
        </p>
        <div className="relative rounded-xl bg-slate-900 p-4 overflow-x-auto">
          <pre className="text-sm text-emerald-400 font-mono">{embedCode}</pre>
          <button
            onClick={copyEmbed}
            className="absolute top-2 right-2 rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600 flex items-center gap-1"
          >
            <ClipboardDocumentIcon className="h-4 w-4" />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          <Link href={`/embed/${botId}`} target="_blank" className="text-indigo-600 hover:underline">
            Preview chatbot
          </Link>
        </p>
      </div>
    </div>
  );
}
