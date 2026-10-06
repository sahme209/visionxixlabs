/**
 * Real homepage screenshot + video showcase — renders only once the
 * real captured assets exist on disk. Checked server-side at request
 * time with fs.existsSync, the same "honest unavailable" pattern used
 * throughout this codebase (DataSourceState{available:false}) rather
 * than a Postgres row: never a fake placeholder image standing in for
 * a real one, and never a broken <video>/<img> src pointing at a file
 * that doesn't exist.
 *
 * Populate via scripts/capture-homepage-media.mjs — it writes directly
 * into public/media/, the exact paths this component checks. Once
 * those files exist, this section renders for real with zero code
 * change; until then, it renders nothing at all (not a stand-in).
 */

import { existsSync } from "node:fs";
import path from "node:path";
import type { ReactNode } from "react";

const PUBLIC_DIR = path.join(process.cwd(), "public", "media");

const DESKTOP_SCREENSHOT = "/media/homepage-desktop.png";
const VIDEO = "/media/homepage-walkthrough.webm";
const CAPTIONS = "/media/homepage-walkthrough.vtt";

export interface HomepageMediaShowcaseProps {
  /** Rendered instead when no real captured asset exists yet — e.g. the
   *  existing illustrative DeploymentLifecycleDemo. Keeps the homepage
   *  unchanged today; swaps to the real recording automatically the
   *  moment scripts/capture-homepage-media.mjs output lands in
   *  public/media/, with no further code change. */
  fallback: ReactNode;
}

export function HomepageMediaShowcase({ fallback }: HomepageMediaShowcaseProps) {
  const hasVideo = existsSync(path.join(PUBLIC_DIR, "homepage-walkthrough.webm"));
  const hasScreenshot = existsSync(path.join(PUBLIC_DIR, "homepage-desktop.png"));
  const hasCaptions = existsSync(path.join(PUBLIC_DIR, "homepage-walkthrough.vtt"));

  // Deliberately falls back — never a placeholder, skeleton, or
  // "coming soon" graphic standing in for a real asset — until a real
  // captured file exists. See docs/RELEASE_MEDIA_CHECKLIST.md before
  // ever populating these.
  if (!hasVideo && !hasScreenshot) return <>{fallback}</>;

  return (
    <div className="relative mt-14 overflow-hidden rounded-2xl border border-white/[0.12] bg-[#171714] shadow-2xl shadow-black/30">
      {hasVideo ? (
        <video
          className="w-full"
          autoPlay
          muted
          loop
          playsInline
          controls
          poster={hasScreenshot ? DESKTOP_SCREENSHOT : undefined}
          aria-label="Axiom Agent homepage walkthrough recording"
        >
          <source src={VIDEO} type="video/webm" />
          {hasCaptions ? <track kind="captions" src={CAPTIONS} srcLang="en" label="English" default /> : null}
        </video>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- static
        // public asset captured by scripts/capture-homepage-media.mjs,
        // not a remote/optimizable image.
        <img src={DESKTOP_SCREENSHOT} alt="Axiom Agent homepage, captured from the live site" className="w-full" />
      )}
    </div>
  );
}
