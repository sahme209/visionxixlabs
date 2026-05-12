"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { PaperAirplaneIcon } from "@heroicons/react/24/outline";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export default function EmbedChatPage() {
  const params = useParams();
  const botId = params.botId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || !botId) return;

    setInput("");
    setError(null);
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    const history = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId, messages: history }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Something went wrong.");
        return;
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message ?? "",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Network error. Please try again.");
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
    <div className="flex flex-col h-[500px] bg-[#09090b] rounded-t-2xl overflow-hidden border border-white/[0.06] shadow-xl">
      {/* Header with gradient */}
      <div className="shrink-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3">
        <h2 className="font-semibold text-white tracking-[-0.04em]">Chat</h2>
        <p className="text-xs text-violet-200">Vision XIX AI</p>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-dots">
        {messages.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-8">Ask a question. I&apos;m trained on your content.</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                m.role === "user"
                  ? "bg-violet-600 text-white rounded-br-md"
                  : "glass-card text-white rounded-bl-md"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-2 rounded-2xl rounded-bl-md glass-card">
              <span className="inline-flex gap-1">
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse [animation-delay:0.4s]" />
              </span>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4 border-t border-white/[0.06] bg-white/[0.02]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 placeholder:text-zinc-500 disabled:opacity-60"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="btn-huly rounded-xl bg-violet-600 p-2.5 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
