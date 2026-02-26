"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { SUPPORT_EMAIL } from "@/lib/constants/company";
import {
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  ClipboardDocumentIcon,
  ChatBubbleBottomCenterTextIcon,
  HandThumbUpIcon,
  HandThumbDownIcon,
  CalendarDaysIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline";
import { Navigation } from "@/components/Navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  feedback?: "up" | "down";
}

const MSG_KEY = "visionxix-ai-assistant-messages";

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MSG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: string; role: "user" | "assistant"; content: string; timestamp: string }[];
    return parsed.slice(-50).map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[]) {
  if (typeof window === "undefined") return;
  try {
    const toSave = msgs.slice(-50).map((m) => ({ ...m, timestamp: m.timestamp.toISOString() }));
    localStorage.setItem(MSG_KEY, JSON.stringify(toSave));
  } catch {}
}

const suggestions = [
  "How can Vision XIX Labs help us productionize AI in AWS?",
  "Do you build internal AI assistants on our own data?",
  "What does a Free Cloud & AI Review include?",
  "How do you think about RAG vs fine-tuning?",
  "What makes Vision XIX Labs AI different?",
];

const QUICK_ACTIONS = [
  { label: "View pricing", href: "/visionxix-ai/pricing", icon: CurrencyDollarIcon },
  { label: "Request demo", href: `mailto:${SUPPORT_EMAIL}?subject=Vision XIX Labs AI - Demo`, icon: CalendarDaysIcon },
  { label: "See features", href: "/visionxix-ai/features", icon: ChatBubbleBottomCenterTextIcon },
  { label: "Calculate ROI", href: "/visionxix-ai#roi", icon: CurrencyDollarIcon },
  { label: "Talk to engineer", href: `mailto:${SUPPORT_EMAIL}`, icon: ChatBubbleBottomCenterTextIcon },
  { label: "Free Cloud & AI Review", href: `mailto:${SUPPORT_EMAIL}?subject=Free Cloud & AI Review`, icon: CalendarDaysIcon },
];

export default function VisionXIXAIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setError(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

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

      const assistantMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: data.message ?? "", timestamp: new Date() };
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

  const setFeedback = (msgId: string, feedback: "up" | "down") => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedback } : m)));
  };

  const submitLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadEmail.trim()) return;
    setLeadStatus("loading");
    try {
      const res = await fetch("/api/visionxix-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: leadEmail.trim(), name: leadName.trim() || undefined, source: "ai-assistant-demo" }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setLeadStatus("success");
        setLeadEmail("");
        setLeadName("");
        setTimeout(() => setLeadModalOpen(false), 1500);
      } else setLeadStatus("error");
    } catch {
      setLeadStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 flex flex-col">
      <Navigation />

      <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 pt-24">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">Vision XIX Labs · Part of the Axiom ecosystem</p>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100">Site Assistant — Cloud & AI</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
              Ask how we design, automate, and secure cloud platforms, or how we build production AI (internal assistants, RAG, more).
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <a key={action.label} href={action.href} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:border-indigo-400 hover:text-indigo-600">
                    <Icon className="h-3.5 w-3.5" />
                    {action.label}
                  </a>
                );
              })}
            </div>
            <a href="/cloud-operator" className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
              Run Axiom for Infrastructure Intelligence
            </a>
            <button onClick={() => setLeadModalOpen(true)} className="text-[11px] text-indigo-600 hover:underline">
              Get personalized demo →
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 bg-gradient-to-b from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/50">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md mb-6">
              <ChatBubbleLeftRightIcon className="w-8 h-8 text-indigo-600" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">Ask the Vision XIX Labs Site Assistant</h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 max-w-xl mx-auto">
              Learn how we approach cloud foundations, CI/CD, security, FinOps, and production AI. Ask about RAG vs fine-tuning or how we work with your team.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
              {suggestions.map((s) => (
                <button key={s} onClick={() => setInput(s)} className="px-4 py-3 text-left text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl hover:border-indigo-400 hover:text-indigo-600">
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 pb-10">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] sm:max-w-[80%] px-4 py-3 rounded-2xl ${m.role === "user" ? "bg-indigo-600 text-white rounded-br-xl shadow-md" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-bl-xl"}`}>
                  {m.role === "assistant" && (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 text-[10px] font-semibold">VX</span>
                        <span className="text-xs font-medium text-slate-500">Vision XIX Labs Site Assistant</span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button onClick={() => navigator.clipboard?.writeText(m.content)} aria-label="Copy" className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 hover:text-slate-700">
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setFeedback(m.id, "up")} aria-label="Helpful" className={`rounded p-1 ${m.feedback === "up" ? "text-emerald-500" : "text-slate-400 hover:text-emerald-500"}`}>
                          <HandThumbUpIcon className="w-4 h-4" />
                        </button>
                        <button onClick={() => setFeedback(m.id, "down")} aria-label="Not helpful" className={`rounded p-1 ${m.feedback === "down" ? "text-red-500" : "text-slate-400 hover:text-red-500"}`}>
                          <HandThumbDownIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2 text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about cloud, AI, RAG, assistants..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 disabled:opacity-60"
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading} className="px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Send">
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-slate-500">
            <p>Vision XIX Labs · Cloud & AI engineering</p>
            <div className="flex items-center gap-4">
              <Link href="/visionxix-ai" className="hover:text-indigo-600">Product</Link>
              <Link href="/visionxix-ai/pricing" className="hover:text-indigo-600">Pricing</Link>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="inline-flex items-center gap-1 hover:text-indigo-600">
                <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" />
                Talk to an engineer
              </a>
            </div>
          </div>
        </div>
      </div>

      {leadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Get a personalized demo</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Leave your details and we&apos;ll show you how Vision XIX Labs AI can convert more visitors into leads.</p>
            <form onSubmit={submitLead} className="space-y-3">
              <input type="text" placeholder="Name" value={leadName} onChange={(e) => setLeadName(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800" />
              <input type="email" placeholder="Email *" required value={leadEmail} onChange={(e) => setLeadEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 dark:border-slate-600 px-4 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-800" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setLeadModalOpen(false)} className="flex-1 rounded-xl border border-slate-200 dark:border-slate-600 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800">
                  Cancel
                </button>
                <button type="submit" disabled={leadStatus === "loading"} className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
                  {leadStatus === "loading" ? "Sending..." : leadStatus === "success" ? "Sent ✓" : "Request demo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
