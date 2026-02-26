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

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  feedback?: "up" | "down";
}

const suggestions = [
  "How can Vision XIX Labs help us productionize AI in AWS?",
  "Do you build internal AI assistants on top of our own data?",
  "What does a Free Cloud & AI Review include?",
  "How do you think about RAG vs fine-tuning for LLMs?",
  "What makes Vision XIX Labs AI different?",
];

const QUICK_ACTIONS = [
  { label: "Request demo", href: `mailto:${SUPPORT_EMAIL}?subject=Vision XIX Labs AI - Demo Request`, icon: CalendarDaysIcon },
  { label: "Get pricing", href: `mailto:${SUPPORT_EMAIL}?subject=Vision XIX Labs AI - Pricing`, icon: CurrencyDollarIcon },
  { label: "Talk to engineer", href: `mailto:${SUPPORT_EMAIL}`, icon: ChatBubbleBottomCenterTextIcon },
];

export default function VisionXIXAIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadModalOpen, setLeadModalOpen] = useState(false);
  const [leadEmail, setLeadEmail] = useState("");
  const [leadName, setLeadName] = useState("");
  const [leadStatus, setLeadStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

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
        body: JSON.stringify({
          messages: history,
          botId: "demo",
        }),
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
    } catch (e) {
      setError("Network error. Please check your connection and try again.");
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
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, feedback } : m))
    );
  };

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
          source: "ai-assistant-demo",
        }),
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
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-[0.14em] mb-1">
              Vision XIX Labs
            </p>
            <h1 className="text-xl sm:text-2xl font-semibold text-[var(--text-primary)]">
              Site Assistant — Cloud & AI
            </h1>
            <p className="text-sm text-[var(--text-secondary)] mt-1 max-w-2xl">
              Ask how we design, automate, and secure cloud platforms, or how we build production AI systems
              (internal assistants, RAG, and more) inside your AWS, Azure, or GCP environment.
            </p>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                return (
                  <a
                    key={action.label}
                    href={action.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-color)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--uscis-blue)]/50 hover:text-[var(--uscis-blue)]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {action.label}
                  </a>
                );
              })}
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Free Cloud & AI Review`}
              className="inline-flex items-center justify-center rounded-full bg-[var(--uscis-blue)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--uscis-blue-dark)]"
            >
              Request a Cloud & AI Review
            </a>
            <button
              onClick={() => setLeadModalOpen(true)}
              className="text-[11px] text-[var(--uscis-blue)] hover:underline"
            >
              Get personalized demo →
            </button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0 bg-gradient-to-b from-[var(--bg-primary)] to-[var(--bg-surface-alt)]"
      >
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--bg-surface)] shadow-[var(--shadow-md)] border border-[var(--border-subtle)] mb-6">
              <ChatBubbleLeftRightIcon className="w-8 h-8 text-[var(--uscis-blue)]" />
            </div>
            <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
              Ask the Vision XIX Labs Site Assistant
            </h2>
            <p className="text-[var(--text-secondary)] text-sm mb-8 max-w-xl mx-auto">
              Learn how we approach cloud foundations, CI/CD, security, FinOps, and production AI systems —
              without the buzzwords. Ask about RAG vs fine-tuning, internal assistants, or how we would work with your team.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-4 py-3 text-left text-sm text-[var(--text-secondary)] bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl hover:border-[var(--uscis-blue)]/50 hover:text-[var(--text-primary)] transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-6">
              Vision XIX Labs · Cloud & AI Engineering
            </p>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4 pb-10">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] px-4 py-3 rounded-2xl ${
                    m.role === "user"
                      ? "bg-[var(--uscis-blue)] text-white rounded-br-xl shadow-[var(--shadow-md)]"
                      : "bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)] rounded-bl-xl shadow-[var(--shadow-sm)]"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--uscis-blue)]/10 text-[var(--uscis-blue)] text-[10px] font-semibold">
                          VX
                        </span>
                        <span className="text-xs font-medium text-[var(--text-tertiary)]">
                          Vision XIX Labs Site Assistant
                        </span>
                      </div>
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => navigator.clipboard?.writeText(m.content)}
                          aria-label="Copy"
                          className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--border-color)] hover:text-[var(--text-primary)]"
                        >
                          <ClipboardDocumentIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setFeedback(m.id, "up")}
                          aria-label="Helpful"
                          className={`rounded p-1 ${m.feedback === "up" ? "text-[var(--uscis-green)]" : "text-[var(--text-tertiary)] hover:text-[var(--uscis-green)]"}`}
                        >
                          <HandThumbUpIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setFeedback(m.id, "down")}
                          aria-label="Not helpful"
                          className={`rounded p-1 ${m.feedback === "down" ? "text-[var(--uscis-red)]" : "text-[var(--text-tertiary)] hover:text-[var(--uscis-red)]"}`}
                        >
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
                <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                  <div className="flex items-center gap-2 text-[var(--text-tertiary)]">
                    <span className="w-2 h-2 rounded-full bg-[var(--uscis-blue)] animate-pulse" />
                    <span className="w-2 h-2 rounded-full bg-[var(--uscis-blue)] animate-pulse [animation-delay:0.2s]" />
                    <span className="w-2 h-2 rounded-full bg-[var(--uscis-blue)] animate-pulse [animation-delay:0.4s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-surface)]">
        <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-4 max-w-2xl">
          {error && (
            <p className="text-sm text-[var(--uscis-red)] mb-2">{error}</p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about our cloud & AI engineering, RAG, assistants, or security..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] disabled:opacity-60"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-4 py-3 bg-[var(--uscis-blue)] text-white rounded-xl hover:bg-[var(--uscis-blue-dark)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] text-[var(--text-tertiary)]">
            <p>Vision XIX Labs · Cloud & AI engineering for AWS, Azure, and GCP.</p>
            <div className="flex items-center gap-4">
              <Link href="/visionxix-ai" className="hover:text-[var(--uscis-blue)]">Product & pricing</Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="inline-flex items-center gap-1 hover:text-[var(--uscis-blue)]"
              >
                <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" />
                Talk to an engineer
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Lead capture modal */}
      {leadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Get a personalized demo</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Leave your details and we&apos;ll show you how Vision XIX Labs AI can convert more visitors into leads.
            </p>
            <form onSubmit={submitLead} className="space-y-3">
              <input
                type="text"
                placeholder="Name"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
              />
              <input
                type="email"
                placeholder="Email *"
                required
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeadModalOpen(false)}
                  className="flex-1 rounded-xl border border-[var(--border-color)] py-2.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-surface-alt)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={leadStatus === "loading"}
                  className="flex-1 rounded-xl bg-[var(--uscis-blue)] py-2.5 text-sm font-semibold text-white hover:bg-[var(--uscis-blue-dark)] disabled:opacity-60"
                >
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

