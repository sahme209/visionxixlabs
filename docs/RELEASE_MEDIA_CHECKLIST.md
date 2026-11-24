# Release Media Checklist

Lightweight checklist for any screenshot, recording, or demo component shown on the
public site or in product marketing. Run this before publishing anything new, and
re-run it whenever the underlying UI or product claims change materially enough
that existing media could now be misleading.

Never skip to "looks fine" — every item below exists because a prior pass on this
site found a real, specific violation of it.

## Before publishing any screenshot, demo, or copy

1. **Matches the deployed version.** The screen, copy, and states shown exist in
   the version currently live on `main` — not a feature branch, not a planned
   redesign, not an older build. If the UI has changed since the media was
   captured, recapture or pull it down.
2. **Every status/capability shown is real or clearly labeled.** A "healthy",
   "verified", "connected", "applied", or similar state in a screenshot must
   correspond to something the product can actually produce today. If the
   workflow isn't live yet, label it explicitly as **preview**, **planned
   capability**, or **illustrative mock** — in the image/caption itself, not
   only in surrounding page copy a reader might not scroll to.
3. **Data is sanitized.** No secrets, API keys, tokens, real customer names,
   real organization IDs, real repository names, real cloud account IDs,
   internal-only repository content, or production evidence appears anywhere
   in the frame — including in background browser tabs, URL bars, or window
   titles.
4. **Desktop and mobile presentation both checked.** Confirm the asset reads
   correctly at both a typical desktop width and a phone width before
   publishing — this includes checking that captions/labels don't get clipped
   on mobile.
5. **Supports the governance story, not a generic feature screenshot.** Every
   piece of release media should visibly connect to the Playbook stages
   (Request → Readiness → Playbook → Risk → Approval → Execution → Validation
   → Evidence → Closure) or another real, named Axiom capability — not a
   decorative UI shot with no narrative purpose.

## Never

- Stock screenshots, fake dashboards, or invented UI states presented as real.
- Fake customer logos or invented testimonials.
- A simulated/mock product state shown without an explicit "preview" /
  "illustrative" / "planned" label.
- Secrets, real customer data, internal repositories, credentials, or cloud
  identifiers in any frame.

## Accessibility baseline for any demo media

- Captions or a text transcript for any video/animated sequence.
- Respects `prefers-reduced-motion` — looping/auto-advancing content must have
  a static or user-controlled equivalent (see
  `components/marketing/DeploymentLifecycleDemo.tsx` for the established
  pattern: `useEffect` checks `matchMedia("(prefers-reduced-motion: reduce)")`
  and disables auto-advance when true).
- Descriptive `aria-label`/`alt` text — not "screenshot1.png" or "image".
- Verified readable and operable on a phone-width viewport, not just desktop.

## Re-run this checklist when

- The UI shown materially changes (new layout, renamed stage, changed status
  vocabulary).
- A capability shown as "preview" ships for real, or a "live" capability is
  pulled back to preview.
- A new release-media asset is added anywhere on the public site or in
  marketing material.

## Current release-media inventory

| Asset | Location | Status |
|---|---|---|
| `CinematicAxiomDemo` interactive tour | Homepage workspace preview and `/demo` | Scripted sample data with user-selected stages and reduced-motion support. |
| "Your first five minutes" step sequence | `app/download/page.tsx` | Text-based description of the real pairing flow (install → sign in → authorize → restricted workspace → next steps) — not a screenshot sequence; explicitly states this in the copy. |

**Known gap, not yet closed:** this checklist exists to govern real screenshots
of the browser companion and desktop app once they're captured. No such
screenshots exist in the repo today — capturing them requires a running app
with seeded, sanitized demo-workspace data (not available in this sandbox: no
database connection, no authenticated session, no screen-recording/video
pipeline). Until that capture work happens, the homepage/download media above
remain the only release media, and both are illustrative-labeled or
text-based by design rather than real screenshots standing in as real ones.

## Reviewing website previews and releasing workspace media

`scripts/capture-homepage-media.mjs` captures the website for review. It writes to
`work/homepage-media-preview/` by default and refuses output anywhere under
`public/`. Website preview captures do not feed the homepage workspace player.

After B3 native qualification, use a sanitized recording of a specific installed
V19 build. In `lib/marketing/homepage-media.json`, replace `null` only in the same
reviewed change as the published media. Record the title, exact release tag
(`version`), `platform` (`macos`, `windows` or `linux`), full source commit
(`sourceCommit`), duration in whole seconds (`durationSeconds`) and a readable plain
text `transcript`. Compare the build and tag with the release evidence before
reviewing the recording. Include the following files under
`public/media/workspace/<version>/<platform>/`:

- `poster.webp` with a readable preview of the actual recorded workflow.
- `walkthrough.webm` for the user-controlled player.
- `captions.vtt` with synchronized English captions.

Supply the transcript and all three assets. The homepage retains its scripted tour
until the complete entry is present. Review the poster, keyboard playback,
captions, transcript and still view at desktop and mobile widths, and recheck the
exact deployed build at the release gate.
