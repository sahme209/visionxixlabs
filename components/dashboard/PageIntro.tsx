/**
 * PageIntro — the recurring "explain this page" stanza at the top
 * of every major dashboard route.
 *
 * Spec from the product directive: every dashboard page should
 * answer, before showing any data:
 *   - what is this page
 *   - one sentence on what it helps you do
 *   - what to connect / set up first
 *   - which AI engineers operate here
 *   - what requires approval
 *   - the primary action
 *
 * Used at the top of /dashboard/multi-cloud, /dashboard/connectors,
 * /dashboard/security, /dashboard/billing, etc. Replaces the ad-hoc
 * <h1>+<p> openers that varied page-to-page.
 *
 * Uses the calm huly.io vocabulary already defined in globals.css:
 *   .kicker-mono       small mono uppercase eyebrow
 *   .display-headline  responsive section/page heading
 *   .body-lede         zinc-400 lede paragraph
 *   .hairline-divider  fade-at-edges section break
 */

import Link from "next/link";
import type { ReactNode } from "react";

export interface PageIntroAction {
  label: string;
  href: string;
  /**
   * 'primary' renders a white pill matching the public CTAs.
   * 'secondary' renders a calm text link with a soft underline.
   * Defaults to 'primary' for the first action, 'secondary' for any
   * subsequent ones.
   */
  variant?: "primary" | "secondary";
  /** When true, opens in a new tab. */
  external?: boolean;
}

export function PageIntro({
  kicker,
  title,
  description,
  helps,
  connectFirst,
  engineers,
  requiresApproval,
  actions,
  safetyNote,
  className,
}: {
  /** Tiny mono uppercase eyebrow above the title. */
  kicker: string;
  /** Page title. */
  title: ReactNode;
  /** One-sentence description of what the page does. */
  description: ReactNode;
  /** Optional "what this helps you do" bullet. */
  helps?: ReactNode;
  /** Optional "connect this first" callout. */
  connectFirst?: ReactNode;
  /** Optional comma-separated list of AI engineers that operate here. */
  engineers?: ReadonlyArray<string>;
  /** Optional "what requires approval" note. */
  requiresApproval?: ReactNode;
  /** Optional CTA cluster at the bottom of the intro. */
  actions?: ReadonlyArray<PageIntroAction>;
  /** Optional safety/scope reminder rendered after the actions. */
  safetyNote?: ReactNode;
  className?: string;
}) {
  const hasMeta = Boolean(helps || connectFirst || (engineers && engineers.length > 0) || requiresApproval);

  return (
    <header className={`relative ${className ?? ""}`}>
      <p className="kicker-mono">{kicker}</p>
      <h1 className="display-headline text-white mt-4">{title}</h1>
      <p className="body-lede text-zinc-400 mt-5 max-w-2xl">{description}</p>

      {hasMeta && (
        <dl className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-4 max-w-3xl">
          {helps && (
            <div>
              <dt className="kicker-mono">What this helps you do</dt>
              <dd className="mt-1.5 text-[13.5px] text-zinc-300 leading-relaxed">{helps}</dd>
            </div>
          )}
          {connectFirst && (
            <div>
              <dt className="kicker-mono">Connect first</dt>
              <dd className="mt-1.5 text-[13.5px] text-zinc-300 leading-relaxed">{connectFirst}</dd>
            </div>
          )}
          {engineers && engineers.length > 0 && (
            <div>
              <dt className="kicker-mono">AI engineers active here</dt>
              <dd className="mt-1.5 flex flex-wrap gap-2">
                {engineers.map((name) => (
                  <span key={name} className="tag-pill">{name}</span>
                ))}
              </dd>
            </div>
          )}
          {requiresApproval && (
            <div>
              <dt className="kicker-mono">Requires approval</dt>
              <dd className="mt-1.5 text-[13.5px] text-zinc-300 leading-relaxed">{requiresApproval}</dd>
            </div>
          )}
        </dl>
      )}

      {actions && actions.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          {actions.map((a, i) => {
            const variant = a.variant ?? (i === 0 ? "primary" : "secondary");
            const cls =
              variant === "primary"
                ? "magnetic-sheen inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white text-zinc-950 text-[14px] font-medium hover:bg-zinc-100 transition-colors"
                : "link-underline-soft text-[14px] text-zinc-400 hover:text-white transition-colors";
            return a.external ? (
              <a key={a.href} href={a.href} target="_blank" rel="noopener noreferrer" className={cls}>
                {a.label}
              </a>
            ) : (
              <Link key={a.href} href={a.href} className={cls}>
                {a.label}
              </Link>
            );
          })}
        </div>
      )}

      {safetyNote && (
        <p className="mt-6 text-[12.5px] text-zinc-500 leading-relaxed max-w-2xl">
          {safetyNote}
        </p>
      )}

      <div className="mt-10 hairline-divider" />
    </header>
  );
}
