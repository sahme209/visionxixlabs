# StatsView Unification Plan

## Overview
Unify StatsView on both iOS (SwiftUI) and Web (Next.js) to have EXACTLY 10 sections + Charts & Trends block, with all data from real Firestore sources.

## Current State Analysis

### iOS StatsView Current Sections (in order):
1. `whatChangedTodaySection` - What Changed Today
2. `yourCaseAnalysisSection` - Your Case Analysis
3. `liveDataSection` - Live Data
4. `dailyImpactCardsSection` - Daily Impact Cards (multiple cards)
5. `similarCasesSection` - Similar Cases Like You
6. `systemUpdatesSection` - System Updates
7. `chartsAndTrendsSection` - Charts & Trends
8. `serviceCentersSection` - All Service Centers
9. `aiInsightsSection` - AI Insights & Predictions
10. `systemHealthSection` - System Health & Your Risks

### Web StatsView Current Sections (in order):
1. "What Changed Today" - What Changed Today
2. "Daily Impact Analysis" - Daily Impact Cards
3. "AI Insights" - AI Insights
4. "System Health" - System Health
5. NowTile - Live Data
6. OverviewCards - Overview
7. Approval Trends Chart - Approval Trends
8. Service Centers - Service Centers
9. Similar Cases - Similar Cases
10. System Updates Section - System Updates

## Required Final Structure

### SECTION 1: What Changed Today (MUST exist on BOTH)
- New Approvals (+delta vs yesterday)
- Priority Date Movement (+days vs yesterday)
- Active Cases processed last 24h
- **Condition**: Show ONLY if real daily stats exist for today
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}`

### SECTION 2: Daily Impact Analysis (MUST exist on BOTH)
- Time Saved
- Queue Position + moved spots
- Progress % + delta
- ETA days + improved by
- **Condition**: Hide Queue Position tile if cannot be computed reliably
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}` + profile data

### SECTION 3: AI Insights (MUST exist on BOTH)
- Up to 3 insight cards:
  - Pace accelerating (week vs month)
  - Similar cases faster (cohort)
  - Low risk of RFE (cohort)
- **Condition**: Hide section if none computable
- **Data Source**: `/trends/{scopeId}`, `/rfeStats/{scopeId}`, `/pdStats/{scopeId}`

### SECTION 4: System Health + Your Risk (MUST exist on BOTH)
- System Health (only if real telemetry exists)
- Your Risk (derived from cohort stats + profile completeness)
- **Condition**: Hide System Health if no telemetry; hide risk value if cannot compute
- **Data Source**: Real telemetry fields + `/rfeStats/{scopeId}`

### SECTION 5: What Happens Next For You (MUST exist on BOTH)
- Personalized next-steps/timeline
- **Condition**: Show CTA if profile incomplete
- **Data Source**: Profile data + processing/timeline engine

### SECTION 6: Today's Update (MUST exist on BOTH)
- **IMPORTANT**: If duplicate of Section 1, merge them
- **Action**: Check if "Today's Update" duplicates "What Changed Today" - if yes, merge

### SECTION 7: More Cases Approved This Month (MUST exist on BOTH)
- Approvals total this month
- Delta vs last month (if exists)
- Daily average
- Best day
- Filters: month selector, service center selector
- **Condition**: Omit delta if last month missing
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}`

### SECTION 8: Approval & RFE Rate (MUST exist on BOTH)
- Approvals count, RFE count, RFE rate %
- Breakdown by service center + optional country
- Drill-in details (only existing timeline fields)
- **Condition**: Label "Small sample size" if cohort too small
- **Data Source**: `/rfeStats/{scopeId}`

### SECTION 9: Approval Trends (MUST exist on BOTH)
- Trend chart
- **Condition**: Show ONLY if >= 7 real trend points exist
- **Data Source**: `/trends/{scopeId}`

### SECTION 10: All Service Centers (MUST exist on BOTH)
- All Service Centers aggregate
- Individual center cards (only if data exists)
- Include: CSC, NSC, TSC, VSC, PSC, NBC, YSC (if applicable + data exists)
- **Condition**: Omit centers without data
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}` + service center breakdown

### Charts & Trends (Simple) Block (AFTER Section 10)
- CHART A: Approvals per day (last 30 days) line chart
- CHART B: Service center comparison bar chart (avg processing days)
- CHART C: Monthly approvals calendar heatmap
- CHART D: RFE donut chart (with/without RFE) for cohort
- CHART E: ETA trend line chart (last 14–30 days)
- CHART F: "Your PD vs latest approved PD" gauge/progress
- **Condition**: Hide each chart if data missing
- **Data Source**: `/trends/{scopeId}`, `/rfeStats/{scopeId}`, `/pdStats/{scopeId}`, `/calendarApprovals/{YYYY-MM}`

## Sections to REMOVE

### iOS:
- `yourCaseAnalysisSection` - REMOVE (not in required list)
- `liveDataSection` - REMOVE (merge into Section 1 or 9)
- `similarCasesSection` - REMOVE (not in required list)

### Web:
- "Similar Cases" section - REMOVE
- Any duplicate sections

## Implementation Strategy

### Phase 1: Analysis & Planning
1. ✅ Create this plan document
2. Map existing sections to required sections
3. Identify data sources for each section
4. Identify components that can be reused

### Phase 2: Data Layer
1. Verify/implement Firestore aggregate collections
2. Ensure data fetching services exist for all required collections
3. Implement profile-based scoping logic

### Phase 3: iOS Implementation
1. Remove sections not in required list
2. Reorder sections to match required order
3. Update/merge Section 6 (Today's Update) if duplicate
4. Implement missing sections
5. Add Charts & Trends block
6. Ensure conditional rendering based on data

### Phase 4: Web Implementation
1. Remove sections not in required list
2. Reorder sections to match required order
3. Implement missing sections to match iOS
4. Add Charts & Trends block
5. Ensure conditional rendering based on data

### Phase 5: Verification
1. Verify both platforms show same sections in same order
2. Verify all data comes from real Firestore sources
3. Verify conditional rendering works correctly
4. Verify profile-based scoping works

## Files to Modify/Create

### iOS:
- `VisaNova-IOS/Views/StatsView.swift` - Main file
- `VisaNova-IOS/Views/SystemUpdatesComponents.swift` - Already exists
- `VisaNova-IOS/Managers/StatsDataService.swift` - Data fetching
- New components as needed for missing sections

### Web:
- `VisaNovaWeb/app/stats/page.tsx` - Main file
- `VisaNovaWeb/components/stats/SystemUpdatesSection.tsx` - Already exists
- `VisaNovaWeb/lib/statsService.ts` - Data fetching
- New components as needed for missing sections

## Next Steps

Given the scope of this task, I recommend:
1. Review and approve this plan
2. Start with Phase 2 (Data Layer) to ensure all data sources exist
3. Then proceed with Phase 3 (iOS) and Phase 4 (Web) in parallel

Would you like me to proceed with the implementation, or would you prefer to review this plan first?
