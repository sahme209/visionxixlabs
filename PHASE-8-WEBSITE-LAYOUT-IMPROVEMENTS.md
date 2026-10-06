# Phase 8: Website & Companion Layout Improvements

**Objective:** Make Axiom feel calmer, clearer, more cinematic, coherent, premium, and trustworthy with proper responsive layout.

**Key Issue:** Website currently feels too narrow and boxed in. Need wider desktop canvas with better use of space.

---

## Layout Requirements

### Desktop Canvas (1280px+)
- [ ] Wider sections (currently max-w-6xl is limiting)
- [ ] Consistent outer gutters (not edge-hugging)
- [ ] Readable text measures within wider visuals
- [ ] Wider product previews and playbook timelines
- [ ] Better visual hierarchy

### Responsive Breakpoints
- **375px (Mobile):** Single column, full width with padding
- **768px (Tablet):** Two columns, wider gutters
- **1280px (Desktop):** Multi-column, wider canvas, premium spacing
- **1440px+ (Ultra-wide):** Optimal at desktop width, no excessive whitespace

### Typography
- [ ] No oversized type that breaks on mobile
- [ ] Readable line lengths (45-75 characters)
- [ ] Proper hierarchy maintained across breakpoints

### Spacing & Grids
- [ ] No narrow boxed sections
- [ ] Consistent padding (16px mobile, 24px+ tablet/desktop)
- [ ] Cards/sections have breathing room
- [ ] Remove faint grid noise if present

---

## Pages to Improve

### Public Pages (in order of impact)
1. `/` (Home) — Hero, editorial panels, evidence cards
2. `/product` — Workflow stages, feature descriptions
3. `/capabilities` — Feature details, visual sections
4. `/pricing` — Plan descriptions (must match real model)
5. `/resources` — Documentation/guides
6. `/architecture` — System diagram, visual explanation
7. `/security` — Trust/compliance information
8. `/docs` — Getting started guides
9. `/download` — Installer info, platform support
10. `/changelog` — Release history
11. `/faq` — Questions and answers
12. `/blog` or `/news` — Articles (if exists)

### Signed-in Pages
1. Companion shell/navigation
2. AI Settings
3. Integration status
4. Release playbook UI
5. GitHub installation flow
6. Settings/preferences

---

## Specific Improvements

### Homepage (`/`)
**Current issues:**
- Hero max-w-6xl constraining
- Editorial panels might be too narrow
- Stage boards limited to max-w-xl/2xl
- Evidence cards in rigid grid

**Improvements:**
- Increase hero max-w to something wider (7xl or 8xl)
- Let editorial panels breathe with wider section
- Keep text measure readable but expand visuals
- Wider spacing between sections

### Product Page (`/`)
**Current issues:**
- Workflow stages description narrow
- Feature boundaries might feel cramped
- Visual sections limited

**Improvements:**
- Wider stage descriptions
- Better visual + text balance
- Expand interactive elements

### Design System (for all pages)
**Pattern to implement:**

```
Desktop (1280px+):
- Container max-width: 1400px (from current 1280px)
- Gutter: 48px (from 20px)
- Text content max-width: 65ch (readable measure)
- Visuals expand to full section width
- Cards have 24px+ gaps

Tablet (768px):
- Container max-width: 900px
- Gutter: 32px
- Same text measure constraint

Mobile (375px):
- Container max-width: full-width
- Gutter: 16px
- Stack everything single-column
```

---

## Responsive Grid Strategy

### Current Pattern Issues
```tsx
// Too narrow
<div className="mx-auto max-w-6xl px-5">
  <h1>Title</h1>
  <p>Description limited to narrow width</p>
</div>
```

### Better Pattern
```tsx
// Wider desktop, responsive
<div className="mx-auto max-w-[1400px] px-5 sm:px-8 lg:px-12">
  <div className="grid lg:grid-cols-[2fr_1.5fr] gap-8 lg:gap-12">
    <div>
      <h1>Wider text area</h1>
      <p>Still readable measure</p>
    </div>
    <div>
      <img/> {/* Wide visual */}
    </div>
  </div>
</div>
```

---

## Components to Review

### Layout Container (`<main>` or section wrapper)
- [ ] max-w-6xl → max-w-[1400px]
- [ ] px-5 → px-5 sm:px-8 lg:px-12
- [ ] Consistent gap pattern

### Editorial Panels
- [ ] Wider at desktop
- [ ] Better visual/text balance
- [ ] Readable text within wider section

### Cards & Grids
- [ ] gap-3 → gap-4 sm:gap-6 lg:gap-8
- [ ] Remove edge-hugging (p-5 → p-6 sm:p-8 lg:p-10)
- [ ] Cards get breathing room

### Visuals & Previews
- [ ] Expand playbook timelines width
- [ ] Stage boards wider
- [ ] Product screenshots/diagrams scale up

---

## Visual Consistency

### Color System (keep existing)
- Dark #141414 / #1A1A1A foundation
- Near-white text
- Orange #F54E00 / #FF783D for accents
- Existing working components

### Typography (keep existing)
- Maintain hierarchy
- Responsive font sizes (clamp values)
- No oversized type on mobile

### Motion (preserve)
- Existing animations work
- Parallax backgrounds
- Interactive elements

---

## Testing Requirements

### Responsive Verification
- [ ] 375px (actual mobile or device emulation)
- [ ] 768px (tablet)
- [ ] 1280px (standard desktop)
- [ ] 1440px+ (wide desktop)

### No Regressions
- [ ] All text readable
- [ ] All interactive elements accessible
- [ ] Images scale properly
- [ ] Navigation works on all sizes
- [ ] Forms usable on mobile
- [ ] Focus states visible
- [ ] Reduced motion respected

---

## Companion (Signed-in)

### Shell/Navigation
- [ ] Companion integrations menu properly aligned
- [ ] Settings accessible
- [ ] Help/docs linked
- [ ] Sign out clear

### Dashboard Pages
- [ ] Release playbook responsive
- [ ] Settings readable on mobile
- [ ] Integration status clear
- [ ] No overflow on small screens

---

## Pricing Content Fix

**Critical:** Pricing page must match actual no-charge pilot model.

**Current issues:**
- May show fake tiers or invented pricing
- Should clarify: no-charge, invite-only, design-partner

**To fix:**
- Remove any invented tiers
- Clarify design-partner access
- Path to paid (validate → prove value → agree scope)
- What's NOT claimed yet

---

## Success Criteria

- [x] Release verification passed
- [x] Playbook complete and truthful
- [ ] Website feels wider and less boxed
- [ ] All breakpoints tested
- [ ] No false claims remain
- [ ] Mobile experience is premium
- [ ] Companion responsive
- [ ] Pricing content honest

---

## Next Steps

1. Start with Homepage `/`
2. Establish responsive grid pattern
3. Implement on Product, Capabilities, Pricing
4. Fix companion shell
5. Verify across breakpoints
6. Audit remaining pages

All changes must maintain Axiom's premium identity and preserve existing components that work well.
