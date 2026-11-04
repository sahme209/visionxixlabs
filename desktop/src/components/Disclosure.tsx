import { useId, useState, type ReactNode } from "react";

/** An explicit native-accessible button; collapsing retains existing form state. */
export function Disclosure({ label, children, className = "", buttonClassName = "" }: {
  label: ReactNode; children: ReactNode; className?: string; buttonClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return <section className={className}>
    <button data-help-id="shared.disclosure-toggle" type="button" aria-expanded={expanded} aria-controls={contentId}
      onClick={() => setExpanded(current => !current)}
      className={`flex w-full items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-400 ${buttonClassName}`}>
      <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12" className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m6 3 5 5-5 5"/></svg>
      <span>{label}</span>
    </button>
    <div id={contentId} hidden={!expanded}>{children}</div>
  </section>;
}
