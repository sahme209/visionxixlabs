# Baseline visual audit — round 1 (2026-11-08)

Source: CI isolated website acceptance run `42493837772` at commit `f7680f2c`, real Chromium. Six sanitized captures: home demo section (desktop), product (mobile 320, normal + reduced motion), agent review and Terraform demos (desktop), approval-workflow docs (desktop). The harness also passed: no horizontal overflow at 360 px, keyboard previous/next, reduced-motion static step, timers stop off-screen and in hidden tabs, sample approve/reject, and a real documentation link destination.

Caveat: captures are cropped to sections, so edge spacing may be a crop artifact. Only issues visible inside a capture are listed.

## Findings

| # | Severity | Where | Finding |
|---|---|---|---|
| 1 | **High** (usability) | Product, mobile | The floating **"Privacy choices"** button covers the demo's Branch selector ("feature/timeout" reads as "…out"). Persistent floating controls overlap interactive content. |
| 2 | Medium | Docs (approval workflow), desktop | The floating **"Ask"** assistant chip overlaps the body text column. |
| 3 | Medium (B2/B4) | Docs | Long text-only pages: **no diagrams, screenshots or demo media**. The ideas (risk tiers, approve/reject, execution/recovery, audit) are exactly what a visual flow would explain faster. |
| 4 | Medium (B2) | Home demo | Strong honesty labels ("Scripted preview", "no live actions"), but the demo is the *first* content in the capture. The plan's first-screen message (who can do what, review, verified result, recovery) needs checking against the actual hero, which wasn't captured. |
| 5 | Low | All | Much small grey secondary text (captions, "Illustrated navigation", footers); contrast needs measuring against the 4.5:1 rule. |
| 6 | Low | Docs | Trust Q&A cards use the same green check icon for "No" answers ("Does approval prove success? No."), which visually reads as "yes/OK". |

## Not yet covered (needs more captures)

Home hero, Pricing, Download, Security/Trust, Docs index, Support, nav "More" menu open, footer. Next round adds these to the harness or uses local preview once npm works.
