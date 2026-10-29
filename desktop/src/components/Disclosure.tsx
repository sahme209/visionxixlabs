import { useId, useState, type ReactNode } from "react";

/** An explicit native-accessible button; collapsing retains existing form state. */
export function Disclosure({ label, children, className = "", buttonClassName = "" }: {
  label: ReactNode; children: ReactNode; className?: string; buttonClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const contentId = useId();
  return <section className={className}>
    <button type="button" aria-expanded={expanded} aria-controls={contentId}
      onClick={() => setExpanded(current => !current)}
      className={`flex w-full items-center gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-orange-300 ${buttonClassName}`}>
      <span aria-hidden="true" className="inline-block w-3 shrink-0">{expanded ? "▾" : "▸"}</span>
      <span>{label}</span>
    </button>
    <div id={contentId} hidden={!expanded}>{children}</div>
  </section>;
}
