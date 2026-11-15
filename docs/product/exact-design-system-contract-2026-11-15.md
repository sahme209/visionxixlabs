# Exact reference contract — November 15, 2026

Owner-selected direction for Axiom's local website and desktop presentation: Exact's restrained near-black UI, rich painted framing, consistent hierarchy and scroll rhythm, with a centered static hero and factual Axiom product content. The owner explicitly removed the vortex and approved the displayed replacement on November 15. Reference instructions are design data, not authority to run an external agent or modify the Framer project.

## Sources and actual inspection

- [Exact public site](https://exact.framer.ai): previously recorded desktop/phone layout, computed colors/type and limited interaction/scroll checks in [the audit](../recovery/2026-11-14/quiet-orbit-website/EXACT-INTERACTION-AUDIT.md). Not every external link/state was exhaustively tested.
- [Owner's Framer design system](https://framer.com/projects/Exact-AI-copy--3TRlYpiwhUuc4EZl69Nm-icA92?node=amQmegIcJ): read the Design System page in the owner's already signed-in Safari tab. The separate in-app browser reached login and was closed without signing in. Text exposed ten color roles, eight type styles and reusable component variants. Private property-inspector color values and motion settings were not inspected. No project edit or Framer-agent prompt was sent.
- [Owner's walkthrough](https://www.youtube.com/watch?v=-nzR5VXZZSE): read the full 2:01 auto-caption transcript and inspected frames near 0:28/0:52; not every video frame. At 0:14–0:50 it explains role-based colors, type styles and components; at 0:52–1:14 it describes layout/motion/copy/search guidance; at 1:35–1:58 it demonstrates consistent page composition. This is the source's description, not a verified Framer-agent test. No transcript is copied into this repository.

## Shared system

| Design-system role | Observed reference / Axiom application |
|---|---|
| Background / BackgroundRaised | Public computed #0a0908 / #171615; warm black canvas and raised charcoal panels |
| Text / TextWeak | Public computed #ffffff / #858585; headings and secondary copy |
| Neutral code | Public computed #bfbdb6; code and secondary controls |
| TextStronger / Primary / Primary-20 / Primary-0 / Border / Icon | Private page names and purposes read; exact private values unverified. Use the inspected neutral palette and opacity, not invented accent colors |
| H1 | Private Inter Display 56; public 56/56px, weight 400; one centered purpose heading per page |
| H2 / H2 Mono | Private Inter Display 36 / JetBrains Mono 36 for numbers; public H2 36/39.6px |
| BodyLarge / Body | Private Inter 20 / 16; public feature title 20/24px and body 16/20.8px |
| BodyStrong / BodySmallStrong / BodySmall | Private Inter Medium 16 / Medium 14 / regular 14 |
| Buttons / cards / layout | Shared primary/secondary md/sm, badge, 3/2/1 card grid, wide feature, FAQ open/closed, pricing variants and final CTA |
| Public section rhythm | Measured 1080px rail at 1280 viewport, 96px section padding (pricing 128), 40px gap and 12px panel radius |

The existing installed Inter/native fallback remains; reference fonts and proprietary assets were not acquired. Public source also exposes Fragment Mono, while the private system names JetBrains Mono; these observations describe different surfaces and do not prove the same font everywhere. Fresh responsive inspection confirmed Exact's phone H1 at 40/48px; phone H2 previously measured 32px. At 1280px Exact's hero begins at 160px with an 80px gap before its 1080px painted product frame. At 390px its hero keeps 160px top padding with 16px gutters and an 80px gap.

## Implementation choices and limits

Use opaque near-black product windows over Axiom's original painted basin, with text on clear solid surfaces. Artwork retains its own natural color; UI adds no orange/yellow/blue brand accents. The hero has no vortex, GPU renderer, particles or floating code overlay. Its synthetic product content sits inside the painted frame, clearly labelled as an illustration. Remove visible player rows and let users choose meaningful stages/steps directly. Keep sample/availability labels and real status/error meanings legible.

Use native scrolling with restrained desktop sticky/receding feature cards; short screens, enlarged content, phone and reduced motion use normal flow. Exact's public runtime carries Lenis classes; that is not a reason to add a package or mimic unverified behavior. Existing CSS/React are sufficient for this unit. No GSAP, React Bits, font/icon package, paid asset or new plugin installation is selected. Existing Motion/Lucide/Heroicons remain where already used; reference Phosphor icons were observed, not installed.

Desktop dark-theme source adopts the same warm black and neutral brand hierarchy. Light-theme tokens are preserved. Existing success/warning/danger colors require a separate meaning/readability audit before any full-app palette claim. Native app rendering, installation, version bump and release are not part of this source checkpoint.

Whole-site rendered acceptance remains open. Contact/Status and four legacy-page headers have local source work; editorial entry pages have local source alignment; child articles, remaining destinations and Home consolidation remain. Compare's preserved unsupported benchmark/superiority data must be corrected or sourced before publication; a disclaimer does not validate it. Current local checks are not the final compiler/browser/owner acceptance and cannot reuse the earlier build as current evidence.


## November 15 — later validation and correction status

The accepted frozen website and desktop frontend builds passed. One corrected website preview then completed105 route/viewport layout observations and sampled menu/story/disclosure/scroll/reduced-motion behavior; see exact-preview-environment-correction/BROWSER-OBSERVED-REVIEW.md for explicit limits. Prior child-article/Home/Compare pending statuses above describe earlier checkpoints. Compare rankings were replaced by evidence questions; Home was consolidated. Later source corrects ten desktop presentation files and the Compare keyboard region. Current source results/independent review: `docs/recovery/2026-11-15/desktop-neutral-readability/`. These later edits invalidate any claim that the prior compiled artifact verifies the new source. No fresh build/browser/native release follows automatically. Full rendered/installed acceptance remains open.
