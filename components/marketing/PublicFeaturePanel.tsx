import Link from "next/link";
import type { ReactNode } from "react";

/** Public editorial presentation. Artwork is static; keep interactive controls in reading order. */
export function PublicFeaturePanel({ eyebrow, title, copy, visual, reverse = false, action, titleId, headingLevel = "h3", children, visualLabel = "Illustrated record · sample data" }: {
  eyebrow: string;
  title: string;
  copy: string;
  visual: ReactNode;
  reverse?: boolean;
  action?: { href: string; label: string };
  titleId?: string;
  headingLevel?: "h2" | "h3";
  children?: ReactNode;
  visualLabel?: string;
}) {
  const Heading = headingLevel;
  return <article className={`public-feature-panel${reverse ? " public-feature-panel--reverse" : ""}`}>
    <div className="public-feature-copy">
      <p className="public-feature-eyebrow">{eyebrow}</p>
      <Heading id={titleId}>{title}</Heading>
      <p>{copy}</p>
      {children}
      {action && <Link className="public-feature-action" href={action.href}>{action.label}<span aria-hidden="true">↗</span></Link>}
    </div>
    <div className="public-feature-art">
      <p className="public-feature-label">{visualLabel}</p>
      {visual}
    </div>
  </article>;
}
