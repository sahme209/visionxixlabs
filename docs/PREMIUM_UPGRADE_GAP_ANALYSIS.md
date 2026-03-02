# Premium SaaS Visual Upgrade — Gap Analysis & Completion Checklist

## Reference Video Patterns — Before vs After

| # | Pattern | Before | After | File(s) |
|---|---------|--------|-------|---------|
| 1 | Premium hero background (spotlight + vignette + glow) | ⚠️ mild | ✅ strong | `SectionBackground.tsx` |
| 2 | Staggered hero intro (badge → headline → subtext → CTA) | ✅ | ✅ | `app/page.tsx` |
| 3 | Accent marker motif used consistently | ⚠️ partial | ✅ full | `AccentMarker.tsx`, `app/page.tsx` |
| 4 | Feature cards with dashboard visuals | ⚠️ 3 cards | ✅ 10+ cards | `MiniChart.tsx`, `MetricPill.tsx`, `GridBackdrop.tsx`, `app/page.tsx` |
| 5 | Strong hover (lift + border glow + shadow) | ⚠️ | ✅ | `HoverCard.tsx`, card classNames |
| 6 | Testimonials: carousel + split/two-tone | ❌ | ✅ | `TestimonialsCarousel.tsx` |
| 7 | Resources grid with thumbnail blocks | ⚠️ links | ✅ thumbnails | `app/page.tsx` Insights section |
| 8 | FAQ accordion on homepage | ❌ | ✅ | `app/page.tsx`, `FAQAccordion.tsx` |
| 9 | Global scroll reveal + stagger | ⚠️ mix | ✅ Reveal/AnimateOnScroll | `app/page.tsx` |

## Files Changed

- `app/page.tsx` — Hero, outcome cards, AI capabilities, Solutions, Insights, About, Testimonials, FAQ
- `components/ui/SectionBackground.tsx` — Stronger hero-light gradient
- `components/ui/AccentMarker.tsx` — (no change)
- `components/ui/MiniChart.tsx` — Added indigo, orange
- `components/ui/MetricPill.tsx` — NEW
- `components/ui/GridBackdrop.tsx` — NEW
- `components/TestimonialsCarousel.tsx` — NEW
- `components/FAQAccordion.tsx` — prefers-reduced-motion support
- `lib/cloudContent.ts` — (import only)
- `docs/PREMIUM_UPGRADE_GAP_ANALYSIS.md` — This file

## Tweak Intensity

- **Hero glow**: In `SectionBackground.tsx` hero-light, adjust opacity values (e.g. `opacity-90` → `opacity-70` for subtler)
- **Animation duration**: `lib/motion/tokens.ts` — `motionDurations.medium` (default 0.4s)
- **Hover lift**: `HoverCard.tsx` — `whileHover.y: -4` → `-6` for more lift
- **Border glow**: Card `hover:border-violet-300/80` → `/100` for stronger
