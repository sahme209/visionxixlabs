"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { MAILTO_SUPPORT } from "@/lib/constants/company";
import BackToHelpCenterLink from "@/components/BackToHelpCenterLink";
import { HERO_IMAGES } from "@/lib/images";
import { SparklesIcon, PaperAirplaneIcon, ChatBubbleLeftRightIcon, ClipboardDocumentIcon, ChatBubbleBottomCenterTextIcon, ArrowPathIcon, CheckIcon } from "@heroicons/react/24/outline";
import { SparklesIcon as SparklesIconSolid } from "@heroicons/react/24/solid";
import { ChatMessageContent } from "@/components/ChatMessageContent";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTIONS_BY_CATEGORY = [
  { label: "Tracking", items: ["How do I track my USCIS case status?", "What does my case status mean?"] },
  { label: "Timelines", items: ["What is the typical I-130 processing time?", "When might my case be approved?"] },
  { label: "Documents & Expedite", items: ["What documents do I need for my interview?", "How can I expedite my case?"] },
];

const FOLLOW_UPS = ["Tell me more about processing times", "How do I check my status online?", "What if my case is delayed?", "What documents are needed?"];

export default function AIAssistantPage() {
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

  const copyResponse = useCallback((id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-teal-700 border-b-2 border-teal-500 shrink-0">
        <div className="absolute inset-0 w-full">
          <Image
            src={HERO_IMAGES.documents}
            alt=""
            fill
            className="object-cover object-center opacity-20 w-full"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-teal-700/70" />
        </div>
        <div
          className="h-0.5 bg-gradient-to-r from-teal-500 via-teal-400 to-teal-500"
          aria-hidden="true"
        />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 text-teal-200">
              <SparklesIconSolid className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Vision XIX Labs AI</h1>
              <p className="text-sm text-white/90">Your VisaNova assistant — ask anything about cases, timelines, or immigration</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                aria-label="New chat"
                className="rounded-lg px-3 py-2 text-sm text-white/90 hover:bg-white/10 transition-colors"
              >
                <ArrowPathIcon className="h-5 w-5" />
              </button>
            )}
            <BackToHelpCenterLink className="text-sm text-white/80 hover:text-white inline-flex" />
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0 bg-gradient-to-b from-stone-100 to-stone-200"
      >
        {messages.length === 0 ? (
          <div className="max-w-2xl mx-auto text-center py-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-teal-100 text-teal-600 mb-6 shadow-sm">
              <ChatBubbleLeftRightIcon className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-semibold text-stone-900 mb-2">Hi, I&apos;m your Vision XIX Labs AI Assistant</h2>
            <p className="text-stone-600 text-sm mb-8 max-w-md mx-auto">
              I can help with USCIS case tracking, I-130/I-129F processing times, VisaNova features, and immigration questions.
            </p>
            <p className="text-xs font-medium text-stone-500 uppercase tracking-wider mb-4">Choose a topic</p>
            <div className="space-y-4 max-w-xl mx-auto">
              {SUGGESTIONS_BY_CATEGORY.map((cat) => (
                <div key={cat.label}>
                  <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2 text-left">{cat.label}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {cat.items.map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="px-4 py-3 text-left text-sm text-stone-600 bg-white border border-stone-200 rounded-xl hover:border-teal-400 hover:bg-teal-50/30 hover:text-stone-900 transition-colors shadow-sm"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mt-6">
              Powered by Vision XIX Labs · Not legal advice
            </p>
            <a
              href={MAILTO_SUPPORT}
              className="mt-3 inline-flex items-center gap-2 text-sm text-teal-600 hover:underline"
            >
              <ChatBubbleBottomCenterTextIcon className="w-4 h-4" />
              Talk to support
            </a>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-4 pb-10">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in-smooth`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[80%] px-4 py-3 rounded-2xl ${
                    m.role === "user"
                      ? "bg-teal-600 text-white rounded-br-md"
                      : "bg-white border border-stone-200 text-stone-900 rounded-bl-md shadow-sm"
                  }`}
                >
                  {m.role === "assistant" && (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <SparklesIcon className="w-4 h-4 text-teal-600" />
                        <span className="text-xs font-medium text-stone-500">Vision XIX Labs AI</span>
                      </div>
                      <button
                        onClick={() => copyResponse(m.id, m.content)}
                        aria-label={copiedId === m.id ? "Copied" : "Copy response"}
                        className={`rounded p-1 transition-colors ${copiedId === m.id ? "text-teal-600" : "text-stone-500 hover:bg-stone-200 hover:text-stone-900"}`}
                      >
                        {copiedId === m.id ? <CheckIcon className="w-4 h-4" /> : <ClipboardDocumentIcon className="w-4 h-4" />}
                      </button>
                    </div>
                  )}
                  {m.role === "user" ? (
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>
                  ) : (
                    <ChatMessageContent content={m.content} />
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-fade-in-smooth">
                <div className="max-w-[85%] px-4 py-3 rounded-2xl rounded-bl-md bg-white border border-stone-200 shadow-sm flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse [animation-delay:0.4s]" />
                  <span className="text-sm text-stone-500 ml-1">Thinking...</span>
                </div>
              </div>
            )}
            {!loading && messages.length > 0 && messages[messages.length - 1].role === "assistant" && (
              <div className="flex flex-wrap gap-2 pt-2">
                {FOLLOW_UPS.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm text-stone-600 hover:border-teal-400 hover:bg-teal-50/30 hover:text-stone-900 transition-colors shadow-sm"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t border-stone-200 bg-stone-50">
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
              placeholder="Ask about your case, timelines, or immigration..."
              disabled={loading}
              className="flex-1 px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-stone-900 placeholder:text-stone-500 disabled:opacity-60"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-4 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[10px] text-[var(--text-tertiary)] mt-2 text-center">
            By Vision XIX Labs · <Link href="/privacy" className="hover:underline">Privacy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
