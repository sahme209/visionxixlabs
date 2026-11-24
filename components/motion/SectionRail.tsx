"use client";

/**
 * SectionRail — fixed-position floating dot navigator for long pages.
 *
 * Renders a vertical column of small dots on the right edge of the
 * viewport. Each dot corresponds to a section anchored by id; the
 * dot for the currently-visible section grows + turns coral. Click
 * any dot to scroll to that section.
 *
 * Axiom.io signature element — gives the reader a visual sense of
 * progress through a long-form page without taking up content width.
 *
 * Hidden under lg (mobile) where there isn't room.
 */

import { useEffect, useState } from "react";

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

  useEffect(() => {
    const sections = items.flatMap(({ id }) => {
      const section = document.getElementById(id);
      return section ? [section] : [];
    });
    if (!sections.length) return;

    let frame = 0;
    const update = () => {
      frame = 0;
      const readingLine = window.innerHeight * 0.4;
      let current = sections[0].id;
      for (const section of sections) {
        if (section.getBoundingClientRect().top <= readingLine) current = section.id;
      }
      setActiveId(current);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [items]);

  return (
    <nav
      aria-label="Section navigation"
      className="hidden lg:flex fixed top-1/2 right-6 xl:right-10 -translate-y-1/2 z-40 flex-col items-end gap-2.5"
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <a
            key={item.id}
            href={`#${item.id}`}
            aria-current={active ? "location" : undefined}
            className="group relative flex items-center gap-2 cursor-pointer"
            aria-label={`Jump to ${item.label}`}
          >
            {/* Revealed on hover or keyboard focus without shifting the dot. */}
            <span
              className={`opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity duration-200 mono-label text-[9.5px] ${
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
                  ? "w-2.5 h-2.5 bg-brand-coral shadow-[0_0_12px_rgba(255,120,61,0.55)]"
                  : "w-1.5 h-1.5 bg-zinc-600 group-hover:bg-brand-coral/75"
              }`}
            />
          </a>
        );
      })}
    </nav>
  );
}
