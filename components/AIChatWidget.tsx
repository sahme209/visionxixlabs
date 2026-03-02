"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  ClipboardDocumentIcon,
  ChatBubbleBottomCenterTextIcon,
  ArrowPathIcon,
  CheckIcon,
} from "@heroicons/react/24/outline";
import { SparklesIcon as SparklesIconSolid } from "@heroicons/react/24/solid";
import { MAILTO_SUPPORT } from "@/lib/constants/company";
import { ChatMessageContent } from "@/components/ChatMessageContent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS_BY_CATEGORY = [
  { label: "Tracking", items: ["How do I track my USCIS case?", "What does my case status mean?"] },
  { label: "Timelines", items: ["What is typical I-130 processing time?", "When might my case be approved?"] },
  { label: "Documents", items: ["What documents do I need for my interview?", "How can I expedite my case?"] },
];

const FOLLOW_UPS = [
  "Tell me more about processing times",
  "How do I check my status online?",
  "What if my case is delayed?",
  "What documents are needed?",
  "How can I expedite?",
];

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
      const res = await fetch("/api/ai-chat", {
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

  const copyResponse = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      {/* Microsoft-style floating chat bubble */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Need help? Let's chat"
        className="fixed bottom-20 right-4 z-[9998] flex items-center gap-2 rounded-2xl bg-[#0078D4] text-white px-4 py-3 shadow-md hover:shadow-lg hover:bg-[#106ebe] focus:outline-none focus:ring-2 focus:ring-[#0078D4] focus:ring-offset-2 transition-all"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/20">
          <ChatBubbleLeftRightIcon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium leading-tight">Need help?</p>
          <p className="text-xs text-white/90 leading-tight">Let&apos;s chat</p>
        </div>
      </button>

      {/* Expanded chat panel - teal/stone palette */}
      {open && (
        <div
          className="fixed bottom-4 right-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-stone-50 shadow-xl"
          role="dialog"
          aria-label="Vision XIX Labs AI chat"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-teal-800/30 bg-teal-700 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 border border-white/25">
                <SparklesIconSolid className="h-5 w-5 text-teal-200" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Vision XIX Labs AI</h2>
                <p className="text-xs text-white/85">USCIS & immigration assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearChat}
                  aria-label="New chat"
                  className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
                  title="New chat"
                >
                  <ArrowPathIcon className="h-5 w-5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label="Close chat"
                className="rounded-lg p-1.5 text-white/80 hover:bg-white/10 hover:text-white"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Chat area */}
          <div
            ref={scrollRef}
            className="flex max-h-[min(400px,70vh)] min-h-[260px] flex-1 flex-col overflow-y-auto p-4 bg-stone-100"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center px-2">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-md border border-stone-200">
                  <ChatBubbleLeftRightIcon className="h-7 w-7 text-teal-600" />
                </div>
                <p className="text-base font-semibold text-stone-900">Hi, I&apos;m your AI assistant</p>
                <p className="mt-2 text-sm text-stone-600 max-w-[280px]">
                  I can help with USCIS tracking, processing times, documents, and immigration questions.
                </p>
                <p className="mt-3 text-xs text-stone-500">Choose a topic to get started</p>
                <div className="mt-4 space-y-3 w-full max-w-[320px]">
                  {SUGGESTIONS_BY_CATEGORY.map((cat) => (
                    <div key={cat.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 mb-1.5 text-left">{cat.label}</p>
                      <div className="flex flex-wrap gap-2">
                        {cat.items.map((s) => (
                          <button
                            key={s}
                            onClick={() => setInput(s)}
                            className="rounded-full border border-stone-200 bg-white px-3 py-2 text-left text-xs text-stone-700 hover:border-teal-400 hover:bg-teal-50/50 hover:text-stone-900 shadow-sm transition-colors"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-smooth`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-teal-600 text-white rounded-br-xl shadow-md"
                          : "bg-white border border-stone-200 text-stone-900 rounded-bl-xl shadow-sm"
                      }`}
                    >
                      {m.role === "assistant" && (
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-stone-500">
                            Vision XIX Labs AI
                          </span>
                          <button
                            onClick={() => copyResponse(m.id, m.content)}
                            aria-label={copiedId === m.id ? "Copied" : "Copy response"}
                            className={`rounded p-0.5 transition-colors ${
                              copiedId === m.id ? "text-teal-600" : "text-stone-500 hover:bg-stone-200 hover:text-stone-900"
                            }`}
                          >
                            {copiedId === m.id ? <CheckIcon className="h-3.5 w-3.5" /> : <ClipboardDocumentIcon className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      )}
                      {m.role === "user" ? (
                        <p className="whitespace-pre-wrap leading-relaxed text-[15px]">{m.content}</p>
                      ) : (
                        <ChatMessageContent content={m.content} />
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start animate-fade-in-smooth">
                    <div className="flex items-center gap-2 rounded-2xl rounded-bl-xl border border-stone-200 bg-white px-4 py-2.5 shadow-sm">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500 [animation-delay:0.2s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-teal-500 [animation-delay:0.4s]" />
                      <span className="text-xs text-stone-500 ml-1">Thinking...</span>
                    </div>
                  </div>
                )}
                {!loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {FOLLOW_UPS.slice(0, 3).map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-left text-[11px] text-stone-600 hover:border-teal-400 hover:bg-teal-50/50 hover:text-stone-900 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Escalate to human */}
          <div className="border-t border-stone-200 px-4 py-2 bg-white">
            <a
              href={MAILTO_SUPPORT}
              className="flex items-center gap-2 text-xs text-stone-600 hover:text-teal-600"
            >
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
              Talk to support
            </a>
          </div>

          {/* Input */}
          <div className="border-t border-stone-200 p-3 bg-white">
            {error && (
              <p className="mb-2 text-xs text-red-600">{error}</p>
            )}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about cases, timelines..."
                disabled={loading}
                className="flex-1 rounded-xl border border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent disabled:opacity-60"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-teal-600 px-3 py-2.5 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Send"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            <Link
              href="/help/ai-assistant"
              className="mt-2 block text-center text-[10px] text-stone-500 hover:text-teal-600"
            >
              Open full AI assistant
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
