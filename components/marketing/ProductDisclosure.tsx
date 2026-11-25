"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function ProductDisclosure({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const summary = useRef<HTMLElement>(null);

  useEffect(() => {
    function openLinkedDisclosure() {
      const details = disclosure.current;
      if (!details || window.location.hash !== `#${id}`) return;
      details.open = true;
      summary.current?.focus({ preventScroll: true });
      details.scrollIntoView?.({ block: "start", behavior: "instant" });
    }
    openLinkedDisclosure();
    window.addEventListener("hashchange", openLinkedDisclosure);
    return () => window.removeEventListener("hashchange", openLinkedDisclosure);
  }, [id]);

  return <details id={id} ref={disclosure} className="public-model-disclosure">
    <summary ref={summary}>{title}</summary>
    {children}
  </details>;
}
