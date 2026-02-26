# Web UI Upgrades → iOS & Android Port Guide

This document maps the **website UI upgrades** (home, premium services, settings, stats, case tools, expedite, action plan) to iOS and Android implementation, and tracks what has been ported.

---

## 1. Home Page

| Web change | iOS | Android |
|------------|-----|---------|
| Hero (gradient, pattern, feature grid, CTAs) for signed-out | `OnboardingView`, sign-in gate | `OnboardingScreen`, sign-in flow |
| Dashboard header (gradient, badges, Form/PD/country/stage) for signed-in | `ContentView` pinned summary, `OverviewSectionView` | `HomeScreen`, `HeaderSection`, `PinnedSummaryBar` |
| Section headers: icon badge + gradient description box | `DashboardSectionHeader`, `LocalSectionHeader`, `SectionHeaderView` (StatsView) | `SectionHeaderView`, `HeaderSection` |
| Trust badges (3-column: Real-Time Data, Accurate Estimates, Secure) | Hero / onboarding | Onboarding |
| Disclaimers (data source, clearer styling) | Per-card disclaimers | Same |

**Status:** Section headers already use icon + gradient on Android `SectionHeaderView`. iOS uses `DashboardSectionHeader` / `LocalSectionHeader`. Home layout differs (tabs, pills); gradient header strip can be added where applicable.

---

## 2. Premium Services (Case Tools, Expedite, Action Plan)

| Web change | iOS | Android |
|------------|-----|---------|
| Pills: gradient bg, gradient icon circle, clearer typography | `OverviewSectionView` `compactPremiumPillContent` | `PremiumServicesSection` `CompactPremiumPill` |
| Colors: Case Tools blue, Expedite orange, Action Plan green | `Color.premiumCaseTools`, `premiumExpedite`, `premiumActionPlan` | `AmericanColors`, custom colors |
| Subtitles: "Premium suite", "Priority service", "Smart guidance" | ✅ Already used | Updated in port |

**Status:** iOS has web-matching colors and subtitles. Android port updates `PremiumServicesSection` to match.

---

## 3. Settings

| Web change | iOS | Android |
|------------|-----|---------|
| Compact gradient header with icon | `SettingsView` toolbar / header | `SettingsHeader` |
| Account Activity chart | New `AccountActivityChart` on web | Not yet ported |
| Subscription Usage chart | New `SubscriptionUsageChart` on web | Not yet ported |

**Status:** Header styling can be upgraded with gradient bar. Charts require native chart components (iOS Charts, Android Compose/MPAndroidChart) and optionally new analytics endpoints.

---

## 4. Stats

| Web change | iOS | Android |
|------------|-----|---------|
| Gradient header with icon, "Statistics" / subtitle | `StatsView` header | `StatsViewScreen` TopAppBar |
| Paywall CTA styling (gradient button) | Stats paywall / Deep Analysis+ | Stats paywall |

**Status:** Gradient header strip / TopAppBar applied in port. Chart upgrades (I-129F, I-130, etc.) already exist on both platforms; web-specific new charts (e.g. ToolUsage, ExpediteSuccess, Progress, StageCompletion) can be added later.

---

## 5. Case Tools, Expedite, Action Plan (Tools)

| Web change | iOS | Android |
|------------|-----|---------|
| Tool Usage chart | `CaseToolsView` | `CaseToolsScreen` |
| Expedite Success chart | `ExpediteRequestView` | `ExpediteRequestScreen` |
| Progress / Stage Completion charts | `NextStepsView` | `NextStepsScreen` |

**Status:** Both platforms have existing chart UIs. Web added dedicated charts (ToolUsageChart, ExpediteSuccessChart, ProgressChart, StageCompletionChart). Porting these would require equivalent native chart views and shared data sources.

---

## 6. Summary of Port Work

- **Done (this pass):**
  - **Android** `PremiumServicesSection`: Web colors (Case Tools blue, Expedite orange, Action Plan green), subtitles "Premium suite", "Priority service", "Smart guidance".
  - **Android** `SettingsHeader`: Gradient bar behind header.
  - **Android** `StatsViewScreen`: Gradient TopAppBar with icon.
  - **iOS**: Premium section already matches; optional gradient accents for Settings/Stats headers.
- **Future:**
  - Account Activity / Subscription Usage charts on Settings (iOS & Android).
  - Tool Usage, Expedite Success, Progress, Stage Completion charts in tools (if not already covered by existing charts).
  - Hero / trust badges refinement on onboarding to match web pixel-perfect.

---

## 7. File Reference

| Area | Web | iOS | Android |
|------|-----|-----|---------|
| Home | `app/page.tsx`, `PremiumServices.tsx` | `ContentView`, `OverviewSectionView`, `HomeView` | `HomeScreen`, `OverviewSectionView`, `PremiumServicesSection` |
| Settings | `app/settings/page.tsx` | `SettingsView` | `SettingsScreen`, `SettingsHeader` |
| Stats | `app/stats/page.tsx` | `StatsView` | `StatsViewScreen` |
| Case Tools | `app/tools/case-tools/page.tsx` | `CaseToolsView` | `CaseToolsScreen` |
| Expedite | `ExpediteRequestView` | `ExpediteRequestView` | `ExpediteRequestScreen` |
| Action Plan | `NextStepsView` | `NextStepsView` | `NextStepsScreen` |
