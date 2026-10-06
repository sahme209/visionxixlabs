"use client";

/**
 * FeedbackWidget — opens a slim modal with 3-sentiment + message.
 * Fire-and-forget POST to /api/feedback. Renders alongside the help
 * bubble. Auto-dismisses 2 seconds after success.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  CheckCircleIcon,
  FaceSmileIcon,
  FaceFrownIcon,
  MinusCircleIcon,
} from "@heroicons/react/24/outline";

type Sentiment = "happy" | "neutral" | "frustrated";

const SENTIMENTS: Array<{ key: Sentiment; label: string; icon: typeof FaceSmileIcon; tone: string }> = [
  { key: "happy",      label: "Happy",      icon: FaceSmileIcon,  tone: "border-emerald-500/30 hover:bg-emerald-500/[0.08] text-emerald-300" },
  { key: "neutral",    label: "Neutral",    icon: MinusCircleIcon, tone: "border-amber-500/30 hover:bg-amber-500/[0.08] text-amber-300" },
  { key: "frustrated", label: "Frustrated", icon: FaceFrownIcon,  tone: "border-rose-500/30 hover:bg-rose-500/[0.08] text-rose-300" },
];

export function FeedbackWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        reset();
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function reset() {
    setSentiment(null);
    setMessage("");
    setSubmitted(false);
    setError(null);
  }

  async function send() {
    if (!sentiment || !message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sentiment, message: message.trim(), pagePath: pathname }),
      });
      const j = (await r.json()) as { ok?: boolean; error?: { userMessage?: string } };
      if (j.ok) {
        setSubmitted(true);
        setTimeout(() => {
          setOpen(false);
          reset();
        }, 2000);
      } else {
        setError(j.error?.userMessage ?? "Could not send feedback.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed bottom-5 right-20 z-40">
      {open && (
        <div role="dialog" aria-label="Send feedback" className="mb-2 w-[300px] rounded-2xl border border-white/[0.08] bg-zinc-950/95 backdrop-blur shadow-2xl p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <p className="text-[10px] font-mono text-fuchsia-300/80 uppercase tracking-wider">// feedback</p>
            <button onClick={() => { setOpen(false); reset(); triggerRef.current?.focus(); }} className="text-zinc-400 hover:text-white">
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>

          {submitted ? (
            <div role="status" aria-live="polite" className="text-center py-4">
              <CheckCircleIcon className="h-8 w-8 text-emerald-300 mx-auto mb-2" />
              <p className="text-[13px] font-semibold text-white">Thanks — that landed.</p>
              <p className="text-[11px] text-zinc-400 mt-1">It pings the team Slack so we see it within minutes.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {SENTIMENTS.map((s) => {
                  const SIcon = s.icon;
                  const selected = sentiment === s.key;
                  return (
                    <button
                      key={s.key}
                      onClick={() => setSentiment(s.key)}
                      className={`flex flex-col items-center gap-1 rounded-lg border p-2 transition ${s.tone} ${
                        selected ? "bg-white/[0.05] ring-2 ring-white/30" : "bg-black/20"
                      }`}
                    >
                      <SIcon className="h-4 w-4" />
                      <span className="text-[10px] font-mono">{s.label}</span>
                    </button>
                  );
                })}
              </div>

              <textarea
                aria-label="Feedback message"
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 2000))}
                rows={4}
                maxLength={2000}
                placeholder="What's working? What's not?"
                className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-[12px] text-white focus:border-fuchsia-400/60 focus:outline-none resize-none"
              />

              {error && <p role="alert" aria-live="assertive" className="text-[11px] text-rose-300 mt-2">{error}</p>}

              <button
                onClick={send}
                disabled={busy || !sentiment || !message.trim()}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-lg bg-fuchsia-500/15 text-fuchsia-200 border border-fuchsia-500/30 hover:bg-fuchsia-500/20 disabled:opacity-50"
              >
                {busy ? "Sending…" : "Send"}
              </button>
            </>
          )}
        </div>
      )}

      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        aria-label="Send feedback"
        aria-expanded={open}
        className="rounded-full bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/40 hover:bg-fuchsia-500/30 p-2 shadow-lg backdrop-blur transition"
      >
        <ChatBubbleLeftRightIcon className="h-5 w-5" />
      </button>
    </div>
  );
}
