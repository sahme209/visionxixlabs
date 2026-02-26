# StatsView Unification - Complete Implementation Plan

## Overview
This document tracks the complete refactoring of StatsView on both iOS (SwiftUI) and Web (Next.js) to have EXACTLY 10 sections + Charts & Trends (Simple) block.

## Required Final Structure

1. **Section 1: What Changed Today** ✅
   - New Approvals (+delta vs yesterday)
   - Priority Date Movement (+days vs yesterday)
   - Active Cases processed last 24h
   - Data Source: `/systemDailyStats/{YYYY-MM-DD}`
   - Condition: Show ONLY if real daily stats exist for today

2. **Section 2: Daily Impact Analysis** ✅
   - Time Saved
   - Queue Position + moved spots (hide if cannot compute)
   - Progress % + delta
   - ETA days + improved by
   - Data Source: `/systemDailyStats/{YYYY-MM-DD}` + profile

3. **Section 3: AI Insights** ✅
   - Up to 3 insight cards (hide section if none computable)
   - Pace accelerating (week vs month)
   - Similar cases faster (cohort)
   - Low risk of RFE (cohort)
   - Data Source: `/trends/{scopeId}`, `/rfeStats/{scopeId}`

4. **Section 4: System Health + Your Risk** ✅
   - System Health (only if real telemetry exists)
   - Your Risk (from real cohort stats + profile completeness)
   - Data Source: Real backend telemetry + `/rfeStats/{scopeId}`

5. **Section 5: What Happens Next For You** ❌ MISSING
   - Personalized timeline next steps
   - Based on current case stage
   - Data Source: Profile + timeline engine

6. **Section 6: Today's Update** ⚠️ REVIEW
   - Same as Section 1? (merge if duplicate)

7. **Section 7: More Cases Approved This Month** ⚠️ EXTRACT
   - Extract from SystemUpdatesSection
   - Data Source: `/systemMonthlyStats/{YYYY-MM}`

8. **Section 8: Approval & RFE Rate** ⚠️ EXTRACT
   - Extract from SystemUpdatesSection
   - Data Source: `/rfeStats/{scopeId}`

9. **Section 9: Approval Trends** ✅
   - Chart showing approval trends
   - Data Source: `/trends/{scopeId}`

10. **Section 10: All Service Centers** ✅
    - Service center comparison
    - Data Source: Real service center stats

11. **Charts & Trends (Simple) Block** ❌ MISSING
    - 6 charts with real data
    - See detailed requirements in original request

## Implementation Phases

### Phase 1: Remove Sections Not in Required List
**Status**: Starting

**iOS to Remove:**
- `yourCaseAnalysisSection` (line 644)
- `liveDataSection` (line 674)
- `similarCasesSection` (line 792)

**Web to Remove:**
- "Similar Cases" section (line 505)
- "NowTile" standalone display (line 387)
- "OverviewCards" standalone display (line 395)

### Phase 2: Reorder Sections
**Status**: Pending

Reorder to match required order (1-10).

### Phase 3: Consolidate Duplicates
**Status**: Pending

- Check if Section 6 duplicates Section 1 (merge if needed)
- Ensure no duplicate content

### Phase 4: Extract Sections 7 & 8
**Status**: Pending

- Extract `ThisMonthCardReal` → Section 7
- Extract `ApprovalRFESectionCardReal` → Section 8
- Make them standalone sections

### Phase 5: Implement Section 5
**Status**: Pending

- Create "What Happens Next For You" section on iOS
- Create "What Happens Next For You" section on Web
- Use existing `WhatsNextCard` component

### Phase 6: Implement Charts & Trends (Simple)
**Status**: Pending

- Implement 6 charts with real data
- Add "Explain like I'm 5" captions
- Profile-based scoping

### Phase 7: Ensure Real Data
**Status**: Pending

- Verify all sections use real Firestore data
- Add conditional rendering (hide if no data)
- Remove any mock data

### Phase 8: Verify Consistency
**Status**: Pending

- Ensure iOS and Web show same sections
- Verify same labels and ordering
- Confirm same numbers for same scope/date

## Files to Modify

### iOS:
- `VisaNova-IOS/Views/StatsView.swift` (main file)
- `VisaNova-IOS/Views/SystemUpdatesComponents.swift` (extract sections)

### Web:
- `VisaNovaWeb/app/stats/page.tsx` (main file)
- `VisaNovaWeb/components/stats/SystemUpdatesSection.tsx` (extract sections)

## Notes

- All data must come from real Firestore sources
- Hide sections if data not available
- No mock data anywhere
- Maintain consistency between iOS and Web
