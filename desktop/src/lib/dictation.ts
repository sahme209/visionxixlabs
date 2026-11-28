/**
 * Voice dictation (pure parts). Speech becomes text in the input for the person to review; it is never
 * sent automatically. Recognition uses the browser's built-in speech service where one exists; where it
 * does not, the button is hidden and the system's own dictation still works in any text field.
 */

/** Adds a finished phrase to the current draft, separated by one space, with surrounding space trimmed. */
export function appendTranscript(current: string, phrase: string, maxLength = 8000): string {
  const p = phrase.replace(/\s+/g, " ").trim();
  if (!p) return current;
  const joined = current && !/\s$/.test(current) ? `${current} ${p}` : `${current}${p}`;
  return joined.slice(0, maxLength);
}

export type DictationError = "unsupported" | "denied" | "no_microphone" | "unavailable" | "no_speech";

/** Maps a speech-recognition error code to a short, plain message. */
export function dictationErrorMessage(code: string): { kind: DictationError; message: string } {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return { kind: "denied", message: "Microphone access is off. Allow it in your browser or system settings, or use your system dictation." };
    case "audio-capture":
      return { kind: "no_microphone", message: "No microphone was found." };
    case "no-speech":
      return { kind: "no_speech", message: "No speech was heard. Try again." };
    case "network":
      return { kind: "unavailable", message: "Speech recognition is unavailable here. Use your system dictation instead (Fn twice on a Mac, Windows key + H on Windows)." };
    default:
      return { kind: "unavailable", message: "Dictation stopped. You can try again or type instead." };
  }
}

/** Minimal shape of the browser speech-recognition object that dictation relies on. */
export interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export type RecognitionConstructor = new () => RecognitionLike;

/** The browser's speech-recognition constructor, or null where dictation is not offered. */
export function recognitionConstructor(scope: unknown = typeof window === "undefined" ? undefined : window): RecognitionConstructor | null {
  if (!scope || typeof scope !== "object") return null;
  const s = scope as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
  const ctor = s.SpeechRecognition ?? s.webkitSpeechRecognition;
  return typeof ctor === "function" ? (ctor as RecognitionConstructor) : null;
}

/** Final phrases in a result event, in order. Interim results are ignored. */
export function finalPhrases(event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }): string[] {
  const out: string[] = [];
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const r = event.results[i];
    if (r?.isFinal && r[0]?.transcript) out.push(r[0].transcript);
  }
  return out;
}
