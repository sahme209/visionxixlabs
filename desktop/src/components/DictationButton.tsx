import { useEffect, useRef, useState } from "react";
import { dictationErrorMessage, finalPhrases, recognitionConstructor, type RecognitionLike } from "../lib/dictation";

/**
 * Microphone button for the Agent composer. Each finished phrase goes to `onPhrase`, which adds it to the
 * draft for review; nothing is sent automatically. Hidden where the system web view has no speech
 * recognition (system dictation still works in the text field).
 */
export function DictationButton({ onPhrase, disabled = false }: { onPhrase: (phrase: string) => void; disabled?: boolean }) {
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
    r.lang = navigator.language || "en-US";
    r.onresult = (event) => { for (const p of finalPhrases(event)) onPhraseRef.current(p); };
    r.onerror = (event) => { if (event.error !== "aborted") setError(dictationErrorMessage(event.error).message); };
    r.onend = () => { setListening(false); rec.current = null; };
    rec.current = r;
    setError(null);
    try { r.start(); setListening(true); } catch { setError(dictationErrorMessage("unknown").message); rec.current = null; }
  }

  return (
    <span className="relative inline-flex self-end">
      <button data-help-id="agent.workspace.dictate" type="button" onClick={toggle} disabled={disabled} aria-pressed={listening} aria-label={listening ? "Stop dictation" : "Dictate"} title={listening ? "Stop dictation" : "Dictate (text appears for you to review)"}
        className={`mb-2 mr-1 inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm transition-colors disabled:opacity-40 ${listening ? "border-red-400/50 bg-red-500/15 text-red-200" : "border-white/10 text-zinc-400 hover:text-white"}`}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
      </button>
      <span role="status" aria-live="polite" className="sr-only">{listening ? "Listening" : ""}</span>
      {error && <span role="alert" className="absolute bottom-full right-0 mb-2 w-64 rounded-lg border border-white/10 bg-zinc-900 p-2 text-xs text-zinc-300 shadow-lg">{error}</span>}
    </span>
  );
}
