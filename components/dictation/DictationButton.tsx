"use client";

import { useEffect, useRef, useState } from "react";
import { dictationErrorMessage, finalPhrases, recognitionConstructor, type RecognitionLike } from "@/lib/dictation/dictation";

/**
 * Microphone button that dictates into a text input. Each finished phrase is passed to `onPhrase`; the
 * caller appends it to the draft. Nothing is ever sent automatically. Hidden where the browser has no
 * speech recognition. Stops when unmounted or disabled.
 */
export function DictationButton({ onPhrase, disabled = false, className = "" }: { onPhrase: (phrase: string) => void; disabled?: boolean; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const onPhraseRef = useRef(onPhrase);
  onPhraseRef.current = onPhrase;

  useEffect(() => { setSupported(recognitionConstructor() !== null); return () => rec.current?.abort(); }, []);
  useEffect(() => { if (disabled) rec.current?.stop(); }, [disabled]);

  if (!supported) return null;

  function toggle() {
    if (listening) { rec.current?.stop(); return; }
    const Ctor = recognitionConstructor();
    if (!Ctor) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = false;
    r.lang = typeof navigator !== "undefined" && navigator.language ? navigator.language : "en-US";
    r.onresult = (event) => { for (const p of finalPhrases(event)) onPhraseRef.current(p); };
    r.onerror = (event) => { if (event.error !== "aborted") setError(dictationErrorMessage(event.error).message); };
    r.onend = () => { setListening(false); rec.current = null; };
    rec.current = r;
    setError(null);
    try { r.start(); setListening(true); } catch { setError(dictationErrorMessage("unknown").message); rec.current = null; }
  }

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={toggle}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? "Stop dictation" : "Dictate"}
        title={listening ? "Stop dictation" : "Dictate (text appears for you to review)"}
        className={`inline-flex items-center justify-center rounded-xl border px-3 py-2.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${listening ? "border-red-400/50 bg-red-500/15 text-red-200" : "border-white/10 bg-white/3 text-zinc-300 hover:text-white"} ${className}`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${listening ? "motion-safe:animate-pulse" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
      </button>
      <span role="status" aria-live="polite" className="sr-only">{listening ? "Listening" : ""}</span>
      {error && <span role="alert" className="absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-300 shadow-lg">{error}</span>}
    </span>
  );
}
