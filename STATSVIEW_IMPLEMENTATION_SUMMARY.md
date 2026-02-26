# StatsView Unification Implementation Summary

## Scope
Unify StatsView on both iOS (SwiftUI) and Web (Next.js) to have EXACTLY 10 sections + Charts & Trends (Simple) block, with all data from real Firestore sources.

## Required Final Structure

### SECTION 1: What Changed Today ✅
- New Approvals (+delta vs yesterday)
- Priority Date Movement (+days vs yesterday)
- Active Cases processed last 24h
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}`
- **Condition**: Show ONLY if real daily stats exist for today

### SECTION 2: Daily Impact Analysis ✅
- Time Saved
- Queue Position + moved spots (hide if cannot compute)
- Progress % + delta
- ETA days + improved by
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}` + profile

### SECTION 3: AI Insights ✅
- Up to 3 insight cards (hide section if none computable)
- Pace accelerating (week vs month)
- Similar cases faster (cohort)
- Low risk of RFE (cohort)
- **Data Source**: `/trends/{scopeId}`, `/rfeStats/{scopeId}`, `/pdStats/{scopeId}`

### SECTION 4: System Health + Your Risk ✅
- System Health (only if real telemetry exists)
- Your Risk (derived from cohort stats + profile completeness)
- **Data Source**: Real telemetry + `/rfeStats/{scopeId}`

### SECTION 5: What Happens Next For You ❌ NEEDS IMPLEMENTATION
- Personalized next-steps/timeline
- **Data Source**: Profile + processing/timeline engine
- **Condition**: Show CTA if profile incomplete

### SECTION 6: Today's Update ⚠️ NEEDS REVIEW/MERGE
- **ACTION**: Check if duplicates Section 1 - if yes, merge them

### SECTION 7: More Cases Approved This Month ⚠️ NEEDS EXTRACTION
- Currently part of `systemUpdatesSection`
- Needs to be standalone section with filters

### SECTION 8: Approval & RFE Rate ⚠️ NEEDS CONSOLIDATION
- Currently appears in multiple places
- Needs to be standalone section

### SECTION 9: Approval Trends ✅
- Show ONLY if >= 7 real trend points exist
- **Data Source**: `/trends/{scopeId}`

### SECTION 10: All Service Centers ✅
- All Service Centers aggregate
- Individual center cards (only if data exists)
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}` + service center breakdown

### Charts & Trends (Simple) Block ❌ NEEDS IMPLEMENTATION
- CHART A: Approvals per day (last 30 days) line chart
- CHART B: Service center comparison bar chart (avg processing days)
- CHART C: Monthly approvals calendar heatmap
- CHART D: RFE donut chart (with/without RFE) for cohort
- CHART E: ETA trend line chart (last 14–30 days)
- CHART F: "Your PD vs latest approved PD" gauge/progress
- **Data Source**: Various aggregates
- **Condition**: Hide each chart if data missing

## Files to Modify/Create

### iOS:
1. `VisaNova-IOS/Views/StatsView.swift` - MAIN FILE - Major refactoring
2. `VisaNova-IOS/Views/SystemUpdatesComponents.swift` - Already exists, needs updates
3. `VisaNova-IOS/Components/WhatsNextCard.swift` - Already exists, needs integration
4. `VisaNova-IOS/Views/ChartsTrendsSimpleComponents.swift` - NEW - Charts block components
5. `VisaNova-IOS/Managers/StatsDataService.swift` - Already exists, may need extensions

### Web:
1. `VisaNovaWeb/app/stats/page.tsx` - MAIN FILE - Major refactoring
2. `VisaNovaWeb/components/stats/SystemUpdatesSection.tsx` - Already exists, needs updates
3. `VisaNovaWeb/components/stats/WhatsNextSection.tsx` - NEW - Section 5 component
4. `VisaNovaWeb/components/stats/ChartsTrendsSimple.tsx` - NEW - Charts block component
5. `VisaNovaWeb/lib/statsService.ts` - Already exists, may need extensions

## Implementation Status

This is a MASSIVE refactoring task requiring:
- Removing multiple sections from both platforms
- Reordering all sections
- Merging/consolidating duplicates
- Implementing 2 new sections (Section 5, Charts block)
- Ensuring all data comes from real Firestore sources
- Adding conditional rendering everywhere
- Testing consistency between platforms

**Estimated Complexity**: Very High
**Files to Modify**: ~10 files
**New Files to Create**: ~5 files
**Lines of Code to Change**: ~1000+ lines

## Recommendation

Given the scope, I recommend proceeding in phases:
1. Phase 1: Remove sections not in required list
2. Phase 2: Reorder remaining sections
3. Phase 3: Consolidate duplicates
4. Phase 4: Implement missing sections
5. Phase 5: Verify data sources + conditional rendering

Would you like me to proceed with the full implementation, or would you prefer to review this plan first?
