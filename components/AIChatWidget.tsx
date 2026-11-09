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
import { classifySupportAction, SUPPORT_ACTION_INFO, type SupportAction } from "@/lib/support/supportActions";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** Cited public sources for grounded answers. */
  sources?: { title: string; href: string }[];
  /** The question this answer responds to (lets the person ask for an AI answer). */
  question?: string;
  mode?: "grounded" | "ai";
  /** No confident docs answer: offer a hand-off to support. */
  unsure?: boolean;
  /** Signed-in member asked for more access: show the request form. */
  accessForm?: boolean;
  /** Signed-in member asked for something Ask Axiom can do: offer that one governed action. */
  supportAction?: SupportAction;
}

const MSG_KEY = "visionxix-ai-widget-messages";

function loadMessages(): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MSG_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: string; role: "user" | "assistant"; content: string; timestamp: string; sources?: { title: string; href: string }[] }[];
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
  "Can Axiom govern Cursor or Claude Code?",
  "What happens before Axiom can deploy to production?",
  "How does AI pricing work?",
  "Are credentials stored?",
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

  if (pathname?.startsWith("/operator/onboarding")) return null;
  if (["/dashboard", "/control", "/account", "/auth"].some(prefix => pathname?.startsWith(prefix))) return null;

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

    try {
      // Grounded support answers: public docs only, always cited, no AI model call.
      const res = await fetch("/api/support/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      const data = await res.json();

      if (!res.ok || !data?.ok) {
        setError(data?.error === "rate_limited" ? "Too many questions. Please wait a minute." : "Something went wrong. Please try again.");
        return;
      }
      // Never keep a message that looked like a secret, not even in this browser.
      if (data.guard === "secret_pasted") setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? { ...m, content: "[removed: looked like a secret]" } : m)));
      // Signed in? Questions about this workspace get a read-only answer from it.
      // Anonymous visitors get 401 before any data is read; secrets never go further.
      if (data.guard !== "secret_pasted") {
        const acct = await fetch("/api/support/account-answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (acct?.ok && acct.answered) { data.answer = acct.answer; data.sources = acct.sources; data.accessForm = acct.intent === "access_request"; }
        // Offering is not permission: the server re-checks role and exact confirmation.
        if (acct?.ok) data.supportAction = classifySupportAction(text) ?? undefined;
      }

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer ?? "",
        timestamp: new Date(),
        sources: Array.isArray(data.sources) ? data.sources.slice(0, 3).map((x: { title: string; href: string }) => ({ title: String(x.title), href: String(x.href) })) : [],
        question: data.guard ? undefined : text,
        mode: "grounded",
        unsure: data.status === "suggestions" && !data.accessForm,
        accessForm: Boolean(data.accessForm),
        supportAction: data.supportAction,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  /** Explicit, per-click AI answer from the cited docs (signed-in, prepaid credits). */
  const askAi = async (question: string) => {
    if (loading) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/support/ai-answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question }) });
      if (res.status === 401) { setError("Sign in to your workspace to use AI answers."); return; }
      const data = await res.json().catch(() => null);
      if (!data?.ok && data?.error === "workspace_ai_disabled") { setError("AI is turned off for this workspace. An admin can turn it on in settings."); return; }
      if (!data?.ok && data?.error === "workspace_ai_credit_pool_exhausted") { setError("No prepaid AI credit is available for this workspace."); return; }
      if (!data?.answer) { setError("Could not get an AI answer. The docs answer above still applies."); return; }
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.answer, timestamp: new Date(), sources: Array.isArray(data.sources) ? data.sources.slice(0, 3) : [], mode: data.mode === "ai" ? "ai" : "grounded" }]);
    } catch { setError("Network error. Please check your connection."); } finally { setLoading(false); }
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
        aria-label="Open Axiom Assistant"
        className="fixed bottom-6 right-6 z-[9998] hidden min-h-11 items-center gap-2.5 rounded-full border border-white/[0.08] bg-[#171717]/90 px-3.5 py-2 text-zinc-200 shadow-[0_14px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl transition-all hover:border-white/[0.16] hover:bg-[#1a1a1a] hover:text-white focus:outline-none focus:ring-2 focus:ring-brand-coral/50 md:flex"
      >
        <div className="relative flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.07] bg-white/[0.035]">
          <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-zinc-300" />
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-300 ring-2 ring-[#171717]" />
        </div>
        <span className="pr-1 text-[12px] font-medium tracking-[-0.01em]">Ask Axiom</span>
      </button>

      {open && (
        <div
          className="fixed right-6 left-auto w-[420px] z-[9999] hidden md:flex flex-col overflow-hidden rounded-2xl glass-dark shadow-xl bottom-6 max-h-[calc(100vh-8rem)]"
          role="dialog"
          aria-label="Ask Axiom support chat"
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-zinc-600 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                <SparklesIcon className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-white">Axiom Assistant</h2>
                <p className="text-xs text-white/90">Ask about cloud operations</p>
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
            className="flex max-h-[320px] min-h-[240px] flex-1 flex-col overflow-y-auto p-4 bg-white/[0.02]"
          >
            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                  <ChatBubbleLeftRightIcon className="h-6 w-6 text-zinc-600" />
                </div>
                <p className="text-sm font-medium text-white">Ask Axiom</p>
                <p className="mt-1 text-xs text-zinc-400">Answers from Axiom&apos;s public docs, with sources. Never share passwords or keys here.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.slice(0, 4).map((s) => (
                    <button
                      key={s}
                      onClick={() => setInput(s)}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-left text-xs text-zinc-400 hover:border-zinc-400 hover:text-zinc-600"
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
                    className={`flex chat-msg-enter ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-zinc-600 text-white rounded-br-xl"
                          : "bg-white/[0.02] border border-white/[0.06] text-white rounded-bl-xl"
                      }`}
                    >
                      {m.role === "assistant" && (
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[10px] font-medium text-slate-500">{m.mode === "ai" ? "Ask Axiom · AI answer from the cited docs" : "Ask Axiom · from the docs"}</span>
                          <button
                            onClick={() => copyResponse(m.content)}
                            aria-label="Copy"
                            className="rounded p-0.5 text-slate-400 hover:bg-white/[0.06] hover:text-slate-700"
                          >
                            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                      {m.role === "assistant" && m.accessForm && <AccessRequestForm />}
                      {m.role === "assistant" && m.supportAction && <SupportActionCard action={m.supportAction} />}
                      {m.role === "assistant" && m.mode === "grounded" && m.question && m.unsure && (
                        <a href={`/contact?topic=ask-axiom&question=${encodeURIComponent(m.question.slice(0, 500))}`} className="mt-2 mr-3 inline-block text-[11px] text-zinc-300 underline underline-offset-2 hover:text-white">Send this question to support</a>
                      )}
                      {m.role === "assistant" && m.mode === "grounded" && m.question && (
                        <button type="button" onClick={() => void askAi(m.question!)} disabled={loading} className="mt-2 text-[11px] text-zinc-400 underline underline-offset-2 hover:text-white disabled:opacity-50">Get a fuller AI answer (signed-in workspaces; uses prepaid credits)</button>
                      )}
                      {m.role === "assistant" && m.sources && m.sources.length > 0 && (
                        <ul aria-label="Sources" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2 text-[11px]">
                          {m.sources.map((src) => src.href.startsWith("/") ? <li key={src.href + src.title}><Link href={src.href} className="text-zinc-400 underline underline-offset-2 hover:text-white">{src.title}</Link></li> : null)}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="flex gap-1 rounded-2xl rounded-bl-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-600" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-600 [animation-delay:0.2s]" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-600 [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t border-white/[0.06] px-4 py-2">
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-zinc-600"
            >
              <ChatBubbleBottomCenterTextIcon className="h-4 w-4" />
              Talk to support
            </a>
          </div>

          <div className="border-t border-white/[0.06] p-3">
            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about setup, security, pricing…"
                disabled={loading}
                className="flex-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500/50 transition-all duration-300 disabled:opacity-60"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-orange-600 px-3 py-2.5 text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                aria-label="Send"
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </div>
            <Link
              href="/product"
              className="mt-2 block text-center text-[10px] text-slate-500 hover:text-zinc-600"
            >
              Learn about Axiom Agent
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

/** Sends a role request to workspace admins. It never grants anything; admins decide on Members. */
function AccessRequestForm() {
  const [role, setRole] = useState("operator"); const [reason, setReason] = useState(""); const [state, setState] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const r = await fetch("/api/support/access-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestedRole: role, reason }) }).then((x) => x.json()).catch(() => null);
    setState(r?.ok ? r.message : r?.error === "already_has_role" ? "You already have that role or a higher one." : r?.error === "reason_required" ? "Add a short reason." : "Could not send the request.");
    setBusy(false);
  }
  if (state && state.startsWith("Sent")) return <p role="status" className="mt-2 text-[11px] text-emerald-300">{state}</p>;
  return (
    <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2 text-[11px]">
      <label className="block text-zinc-400" htmlFor="ask-axiom-role">Role you need</label>
      <select id="ask-axiom-role" value={role} onChange={(e) => setRole(e.target.value)} className="w-full rounded border border-white/10 bg-black/30 px-2 py-1">{["operator", "security_reviewer", "finance_viewer", "admin"].map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}</select>
      <label className="block text-zinc-400" htmlFor="ask-axiom-reason">Why</label>
      <input id="ask-axiom-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="w-full rounded border border-white/10 bg-black/30 px-2 py-1" placeholder="e.g. I approve staging releases for the web team" />
      <button type="button" disabled={busy} onClick={() => void send()} className="rounded bg-zinc-100 px-2 py-1 font-medium text-zinc-950 disabled:opacity-50">Ask an admin</button>
      {state && <p role="alert" className="text-rose-300">{state}</p>}
    </div>
  );
}

const ACTION_ERRORS: Record<string, string> = {
  role_not_allowed: "Your role cannot run this. Ask a workspace admin.",
  rate_limited: "Too many requests. Please wait a minute.",
  seal_conflict: "Another seal finished at the same moment. Try again.",
};

/** One governed action, shown with exactly what it does; runs only after the person confirms it. */
function SupportActionCard({ action }: { action: SupportAction }) {
  const info = SUPPORT_ACTION_INFO[action];
  const [confirming, setConfirming] = useState(false); const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  async function run() {
    setBusy(true);
    const r = await fetch("/api/support/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, confirmed: action }) }).then((x) => x.json()).catch(() => null);
    setResult(r?.ok ? { ok: true, text: String(r.message) } : { ok: false, text: ACTION_ERRORS[r?.error] ?? "Could not run this action." });
    setBusy(false); setConfirming(false);
  }
  if (result) return <p role={result.ok ? "status" : "alert"} className={`mt-2 text-[11px] ${result.ok ? "text-emerald-300" : "text-rose-300"}`}>{result.text}{result.ok && <> <Link href="/control/trust-tools" className="underline">Trust tools</Link></>}</p>;
  return (
    <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2 text-[11px]">
      {!confirming ? (
        <button type="button" onClick={() => setConfirming(true)} className="rounded border border-white/15 px-2 py-1 font-medium text-zinc-100 hover:bg-white/5">{info.label}</button>
      ) : (
        <>
          <p className="text-zinc-300">{info.confirmText}</p>
          <div className="flex gap-1.5">
            <button type="button" disabled={busy} onClick={() => void run()} className="rounded bg-zinc-100 px-2 py-1 font-medium text-zinc-950 disabled:opacity-50">Confirm: {info.label.toLowerCase()}</button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded px-2 py-1 text-zinc-400 hover:text-zinc-200">Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
