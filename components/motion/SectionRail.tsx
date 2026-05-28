"use client";

/**
 * SectionRail — fixed-position floating dot navigator for long pages.
 *
 * Renders a vertical column of small dots on the right edge of the
 * viewport. Each dot corresponds to a section anchored by id; the
 * dot for the currently-visible section grows + turns coral. Click
 * any dot to scroll to that section.
 *
 * Huly.io signature element — gives the reader a visual sense of
 * progress through a long-form page without taking up content width.
 *
 * Hidden under lg (mobile) where there isn't room.
 */

import { useEffect, useRef, useState } from "react";

export interface SectionRailItem {
  /** DOM id to anchor to. Section should set `id={item.id}`. */
  id: string;
  /** Short label shown on hover (tooltip). */
  label: string;
  /** Optional numeric prefix shown next to the dot. */
  num?: string;
}

export function SectionRail({ items }: { items: readonly SectionRailItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || items.length === 0) return;

    // Track which section is most prominently in the viewport.
    const visibleSections = new Map<string, number>();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            visibleSections.set(entry.target.id, entry.intersectionRatio);
          } else {
            visibleSections.delete(entry.target.id);
          }
        }
        // Pick the section with the highest intersection ratio.
        let bestId = activeId;
        let bestRatio = 0;
        for (const [id, ratio] of visibleSections) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId && bestId !== activeId) setActiveId(bestId);
      },
      {
        // Sections become "active" once their top crosses 40% of viewport.
        rootMargin: "-40% 0px -55% 0px",
        threshold: [0, 0.1, 0.5, 1],
      },
    );

    for (const item of items) {
      const el = document.getElementById(item.id);
      if (el) observerRef.current.observe(el);
    }

    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  const onClick = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 100;
    window.scrollTo({ top, behavior: "smooth" });
  };

  return (
    <nav
      aria-label="Section navigation"
      className="hidden lg:flex fixed top-1/2 right-6 xl:right-10 -translate-y-1/2 z-40 flex-col items-end gap-2.5"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onClick(item.id)}
            className="group relative flex items-center gap-2 cursor-pointer"
            aria-label={`Jump to ${item.label}`}
          >
            {/* Hover-revealed label (right-aligned, so it doesn't shift the dot) */}
            <span
              className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 mono-label text-[9.5px] ${
                active ? "text-brand-coral/95" : "text-zinc-400"
              } whitespace-nowrap`}
            >
              {item.num && <span className="text-brand-coral/85 mr-2 tabular-nums">{item.num}</span>}
              {item.label}
            </span>
            {/* The dot */}
            <span
              className={`shrink-0 rounded-full transition-all duration-300 ${
                active
                  ? "w-2.5 h-2.5 bg-brand-coral shadow-[0_0_12px_rgba(244,114,182,0.55)]"
                  : "w-1.5 h-1.5 bg-zinc-600 group-hover:bg-brand-coral/75"
              }`}
            />
          </button>
        );
      })}
    </nav>
  );
}
