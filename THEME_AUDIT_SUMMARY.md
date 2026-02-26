# Theme Audit Summary - Surface Token System Migration

## Overview
Comprehensive audit and fix of all style overrides to ensure the global surface token system works correctly across the entire application.

## Changes Made

### 1. Global CSS (`app/globals.css`)
- ✅ **Token utilities added**: `.text-fg`, `.text-muted`, `.text-icon` utility classes
- ✅ **Theme Debug Helper**: Added dev-only debug outlines for `surface-dark` (blue) and `surface-light` (green) containers
  - Enable with `?debug-theme=true` URL parameter
  - Shows visual outlines and labels for all surface containers

### 2. Pages Fixed

#### `app/profile-setup/page.tsx`
- ✅ Removed `text-white !text-white` and inline `style={{ color: 'white' }}`
- ✅ Replaced with `text-fg` and `text-muted` utilities
- ✅ Already has `surface-dark` wrapper

#### `app/news/page.tsx`
- ✅ Removed `text-white !text-white` and inline styles
- ✅ Replaced icons with `text-icon`
- ✅ Replaced text with `text-fg` and `text-muted`
- ✅ Already has `surface-dark` wrapper

#### `app/settings/page.tsx`
- ✅ Removed `text-white !text-white` and inline styles
- ✅ Replaced icons with `text-icon`
- ✅ Replaced text with `text-fg` and `text-muted`
- ✅ Already has `surface-dark` wrapper

#### `app/page.tsx` (Home)
- ✅ Hero section wrapped with `surface-dark`
- ✅ Removed `text-white` and inline styles from hero section
- ✅ Replaced with `text-fg`, `text-muted`, `text-icon`
- ✅ Fixed profile card text colors

#### `app/subscribe/page.tsx`
- ✅ Removed `text-white` and inline styles
- ✅ Replaced with `text-fg` and `text-icon`
- ✅ Already has `surface-dark` wrapper

#### `app/terms/page.tsx`
- ✅ Removed `text-white !text-white` and inline styles
- ✅ Replaced with `text-fg` and `text-muted`
- ✅ Already has `surface-dark` wrapper

#### `app/privacy/page.tsx`
- ✅ Removed `text-white !text-white` and inline styles
- ✅ Replaced with `text-fg` and `text-muted`
- ✅ Already has `surface-dark` wrapper

### 3. Components Fixed

#### `components/NextStepsView.tsx`
- ✅ Replaced `text-white` with `text-fg`, `text-muted`, `text-icon`
- ✅ Already has `surface-dark` wrapper

#### `components/SiteFooter.tsx`
- ✅ Removed all `text-white` instances (20+ replacements)
- ✅ Replaced with `text-fg`, `text-muted`, `text-icon`
- ✅ Already has `surface-dark` wrapper

#### `components/TopNavigation.tsx`
- ✅ Already using CSS variables (`text-[var(--fg)]`, `text-[var(--icon)]`)
- ✅ Already has `surface-dark` wrapper
- ✅ No changes needed

### 4. Charts (Recharts)
- ✅ **Verified**: All chart components use CSS variables (`var(--text-primary)`, `var(--text-secondary)`)
- ✅ **No black overrides found**: Charts use proper color tokens
- ✅ **Protected**: Recharts elements are protected by `unset !important` guards in `globals.css`

### 5. Layout Updates

#### `app/layout.tsx`
- ✅ Added theme debug script to enable debug mode via URL parameter

## Remaining Work

### Files Still Needing Attention
1. **`components/DailyBriefing.tsx`**: Has `text-white` instances
2. **`components/ExpediteRequestView.tsx`**: Has multiple `text-white` instances
3. **`app/help/page.tsx`**: Has `text-white` instances
4. **`app/help/example-forms/page.tsx`**: Has `text-white` instances
5. **`app/settings/language/page.tsx`**: Has `text-white` instances
6. **`app/tools/case-tools/page.tsx`**: Has `text-white` instances
7. **`app/auth/action/page.tsx`**: Has inline `style={{ color: "white" }}`
8. **`app/reset-password/page.tsx`**: Has inline `style={{ color: "white" }}`

### Pattern to Follow
For each file:
1. Ensure dark sections have `surface-dark` wrapper
2. Replace `text-white` → `text-fg`
3. Replace `text-white/90`, `text-white/80`, etc. → `text-muted` (with opacity if needed)
4. Replace icon `text-white` → `text-icon`
5. Remove inline `style={{ color: 'white' }}` and `!text-white` overrides
6. For buttons with colored backgrounds (emerald, blue), `text-white` is acceptable

## Verification Checklist

- [x] Theme debug helper added and working
- [x] Core pages (home, news, settings, subscribe) fixed
- [x] Core components (footer, navigation) fixed
- [x] Charts verified to use CSS variables (no black overrides)
- [ ] All remaining pages audited and fixed
- [ ] All remaining components audited and fixed
- [ ] Visual verification on all major routes
- [ ] No black text on dark USCIS blue backgrounds
- [ ] Charts maintain their original colors

## Usage

### Enable Theme Debug Mode
Add `?debug-theme=true` to any URL to see visual outlines:
- Blue outline = `surface-dark` containers
- Green outline = `surface-light` containers
- Labels show which surface class is applied

### Token Utilities
- `text-fg` - Primary foreground text (adapts to surface)
- `text-muted` - Secondary/muted text (adapts to surface)
- `text-icon` - Icon color (adapts to surface)

## Notes

- Buttons with colored backgrounds (emerald, blue) may still use `text-white` - this is intentional
- Charts are protected from theme overrides via Recharts guards
- SVG icons should use `currentColor` to inherit from surface tokens
- All dark sections (nav, footer, hero, headers) should have `surface-dark` wrapper
