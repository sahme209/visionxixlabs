"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  ChatBubbleBottomCenterTextIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";
import { SUPPORT_EMAIL } from "@/lib/constants/company";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const MSG_KEY = "visionxix-ai-widget-messages";

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MSG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: string; role: "user" | "assistant"; content: string; timestamp: string }[];
    return parsed.slice(-30).map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  if (typeof window === "undefined") return;
  try {
    const toSave = msgs.slice(-30).map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
    localStorage.setItem(MSG_KEY, JSON.stringify(toSave));
  } catch {}
}

const SUGGESTIONS = [
  "How can Vision XIX Labs help us productionize AI in AWS?",
  "Do you build internal AI assistants on our own data?",
  "What does a Free Cloud & AI Review include?",
  "What makes Vision XIX Labs AI different?",
];

export default function AIChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  useEffect(() => {
    if (mounted) setMessages(loadMessages());
  }, [mounted]);
  useEffect(() => {
    if (mounted && messages.length > 0) saveMessages(messages);
  }, [mounted, messages]);
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Don't show Vision XIX Labs widget inside embed iframe — only show the customer's bot
  if (pathname?.startsWith("/embed/")) return null;
  // Hide "Let's Chat" on cloud-operator — Ask Axiom provides chat there; avoids overlap
  if (pathname?.startsWith("/cloud-operator")) return null;

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history = [...messages, userMsg].map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    try {
      const res = await fetch("/api/visionxix-ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        return;
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message ?? "",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyResponse = (text: string) => {
    navigator.clipboard?.writeText(text);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open Vision XIX Labs AI Assistant"
        className="fixed right-4 z-[9998] flex items-center gap-2 rounded-full bg-white dark:bg-slate-800 px-4 py-3 text-slate-900 dark:text-slate-100 shadow-lg border-2 border-slate-200 dark:border-slate-600 hover:border-violet-400 dark:hover:border-violet-500 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 transition-all hover:scale-[1.02] active:scale-[0.98] bottom-[5.5rem] md:bottom-6"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/50">
          <ChatBubbleLeftRightIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <span className="text-sm font-semibold pr-1">Let&apos;s chat</span>
      </button>

      {open && (
        <div
          className="fixed right-4 left-4 md:right-6 md:left-auto md:w-[420px] z-[9999] flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl bottom-[5.5rem] md:bottom-6 max-h-[calc(100vh-8rem)]"
          role="dialog"
          aria-label="Vision XIX Labs AI chat"
        >
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 bg-indigo-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Vision XIX Labs AI</h2>
                <p className="text-xs text-white/90">Cloud & AI assistant</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-lg p-1.5 text-white/80 hover:bg-white/20 hover:text-white"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex max-h-[320px] min-h-[240px] flex-1 flex-col overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800/50"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <ChatBubbleLeftRightIcon className="h-6 w-6 text-indigo-600" />
                </div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Hi, I&apos;m Vision XIX Labs AI</p>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Ask about cloud, AI, or our services.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-left text-xs text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-indigo-600 text-white rounded-br-xl"
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-xl"
                      }`}
                    >
                      {m.role === "assistant" && (
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-slate-500">Vision XIX Labs AI</span>
                          <button
                            onClick={() => copyResponse(m.content)}
                            aria-label="Copy"
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700"
                          >
                            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex gap-1 rounded-2xl rounded-bl-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600 [animation-delay:0.2s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-600 [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 hover:text-indigo-600"
            >
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
              Talk to support
            </a>
          </div>

          <div className="border-t border-slate-200 dark:border-slate-700 p-3">
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about cloud, AI..."
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-indigo-600 px-3 py-2.5 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            <Link
              href="/visionxix-ai-assistant"
              className="mt-2 block text-center text-[10px] text-slate-500 hover:text-indigo-600"
            >
              Open full AI assistant
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
