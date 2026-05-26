"use client";

/**
 * FeatureRow — the huly.io section pattern.
 *
 * Each row is one big horizontal slab:
 *   - Two columns on lg, single column stacked on mobile.
 *   - One side is a kicker + display headline + body paragraph + a
 *     short bullet list with icons.
 *   - The other side is a media slot — typically a screenshot or
 *     illustration framed in a SpotlightCard with .glow-edge.
 *   - `mediaSide` swaps left/right so rows can alternate down the
 *     page like huly does ("Work together. Like in the office."
 *     followed by "Sync with GitHub.").
 *
 * No bordered cards on the text side. Clean type, generous space.
 */

import type { ReactNode } from "react";
import { SpotlightCard } from "@/components/motion/SpotlightCard";

type FeatureBullet = {
  /** Optional inline icon node (heroicon, SVG). */
  icon?: ReactNode;
  /** Short bold label */
  label: string;
  /** Optional secondary description after the label */
  description?: string;
};

export function FeatureRow({
  kicker,
  headline,
  body,
  bullets,
  media,
  mediaSide = "right",
  className,
}: {
  /** Tiny mono uppercase label above the headline. ReactNode so callers can prefix a numbered Huly-style marker. */
  kicker: ReactNode;
  /** The big section headline. */
  headline: ReactNode;
  /** Lede paragraph. */
  body: ReactNode;
  /** Optional bullet list shown under the body. */
  bullets?: ReadonlyArray<FeatureBullet>;
  /** Media slot — screenshot, illustration, or anything visual. */
  media: ReactNode;
  /** Which side the media lives on at lg. Default 'right'. */
  mediaSide?: "left" | "right";
  className?: string;
}) {
  const textCol = (
    <div className="max-w-xl">
      <p className="kicker-mono">{kicker}</p>
      <h2 className="display-headline text-white mt-5">{headline}</h2>
      <div className="body-lede text-zinc-400 mt-6">{body}</div>
      {bullets && bullets.length > 0 ? (
        <ul className="mt-8 space-y-4">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3">
              {b.icon ? (
                <span className="mt-0.5 flex-shrink-0 text-zinc-400">{b.icon}</span>
              ) : (
                <span aria-hidden className="mt-2 w-1 h-1 rounded-full bg-white/40 flex-shrink-0" />
              )}
              <div className="flex-1">
                <p className="text-[14px] text-zinc-100 font-medium leading-snug">{b.label}</p>
                {b.description ? (
                  <p className="text-[13px] text-zinc-500 leading-relaxed mt-1">{b.description}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const mediaCol = (
    <SpotlightCard className="glow-edge rounded-2xl border border-white/[0.06] bg-white/[0.012] overflow-hidden">
      {media}
    </SpotlightCard>
  );

  return (
    <section className={`py-24 px-4 sm:px-6 lg:px-8 ${className ?? ""}`}>
      <div className="max-w-6xl mx-auto">
        <div className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${
          mediaSide === "left" ? "lg:[direction:rtl]" : ""
        }`}>
          {/* RTL trick reverses the visual order at lg without
              affecting reading order. Reset direction on children. */}
          <div className="lg:[direction:ltr]">{textCol}</div>
          <div className="lg:[direction:ltr]">{mediaCol}</div>
        </div>
      </div>
    </section>
  );
}
