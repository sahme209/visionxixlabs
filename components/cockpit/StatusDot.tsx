import { TONE_DOT, TONE_TEXT, type StatusTone } from "@/lib/cockpit/statusTone";

/** A coloured dot with its text label. Colour is never the only signal. */
export function StatusDot({ tone, label, className = "" }: { tone: StatusTone; label: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] ${TONE_TEXT[tone]} ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      {label}
    </span>
  );
}
