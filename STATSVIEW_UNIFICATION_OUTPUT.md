# StatsView Unification - Final Output

## Summary

This document provides the final output for the StatsView unification task.

## Files to be Modified/Created

### iOS Files

#### Modified:
1. **`VisaNova-IOS/Views/StatsView.swift`**
   - Remove: `yourCaseAnalysisSection`, `liveDataSection`, `similarCasesSection`
   - Reorder sections to match required order (1-10)
   - Consolidate duplicates (Section 6 with Section 1 if duplicate)
   - Extract Sections 7 & 8 from SystemUpdatesSection
   - Add Section 5 (What Happens Next For You)
   - Add Charts & Trends (Simple) block
   - Ensure all sections use real Firestore data with conditional rendering

2. **`VisaNova-IOS/Views/SystemUpdatesComponents.swift`**
   - Extract `ThisMonthCardReal` → Section 7 (More Cases Approved This Month)
   - Extract `ApprovalRFESectionCardReal` → Section 8 (Approval & RFE Rate)
   - Review `TodaysUpdateCardReal` → merge with Section 1 if duplicate

#### Created:
1. **`VisaNova-IOS/Views/WhatsNextForYouSection.swift`**
   - Section 5 component using `WhatsNextCard` (already exists)
   - Profile-based conditional rendering
   - Real data from profile + processing/timeline engine

2. **`VisaNova-IOS/Views/ChartsTrendsSimpleSection.swift`**
   - Charts & Trends (Simple) block with 6 charts
   - CHART A: Approvals per day (last 30 days) line chart
   - CHART B: Service center comparison bar chart
   - CHART C: Monthly approvals calendar heatmap
   - CHART D: RFE donut chart
   - CHART E: ETA trend line chart
   - CHART F: Your PD vs latest approved PD gauge/progress
   - All with "Explain like I'm 5" captions
   - Conditional rendering based on data availability

### Web Files

#### Modified:
1. **`VisaNovaWeb/app/stats/page.tsx`**
   - Remove: "Similar Cases" section, "NowTile" section, "OverviewCards" section
   - Reorder sections to match required order (1-10)
   - Add Section 5 (What Happens Next For You)
   - Extract Sections 7 & 8 from SystemUpdatesSection
   - Add Charts & Trends (Simple) block
   - Ensure all sections use real Firestore data with conditional rendering

2. **`VisaNovaWeb/components/stats/SystemUpdatesSection.tsx`**
   - Extract Section 7 (More Cases Approved This Month) into standalone component
   - Extract Section 8 (Approval & RFE Rate) into standalone component
   - Review Today's Update → merge with Section 1 if duplicate

#### Created:
1. **`VisaNovaWeb/components/stats/WhatsNextForYouSection.tsx`**
   - Section 5 component
   - Profile-based conditional rendering
   - Real data from profile + processing/timeline engine

2. **`VisaNovaWeb/components/stats/ChartsTrendsSimple.tsx`**
   - Charts & Trends (Simple) block with 6 charts (matching iOS)
   - All with "Explain like I'm 5" captions
   - Conditional rendering based on data availability

## Final StatsView Structure

### Section 1: What Changed Today ✅
- New Approvals (+delta vs yesterday)
- Priority Date Movement (+days vs yesterday)
- Active Cases processed last 24h
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}`
- **Condition**: Show ONLY if real daily stats exist for today

### Section 2: Daily Impact Analysis ✅
- Time Saved
- Queue Position + moved spots (hide if cannot compute)
- Progress % + delta
- ETA days + improved by
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}` + profile

### Section 3: AI Insights ✅
- Up to 3 insight cards (hide section if none computable)
- Pace accelerating (week vs month)
- Similar cases faster (cohort)
- Low risk of RFE (cohort)
- **Data Source**: `/trends/{scopeId}`, `/rfeStats/{scopeId}`, `/pdStats/{scopeId}`

### Section 4: System Health + Your Risk ✅
- System Health (only if real telemetry exists)
- Your Risk (derived from cohort stats + profile completeness)
- **Data Source**: Real telemetry + `/rfeStats/{scopeId}`

### Section 5: What Happens Next For You ❌ (TO BE IMPLEMENTED)
- Personalized next-steps/timeline
- **Data Source**: Profile + processing/timeline engine
- **Condition**: Show CTA if profile incomplete

### Section 6: Today's Update ⚠️ (TO BE REVIEWED/MERGED)
- **Action**: Check if duplicates Section 1 - if yes, merge them

### Section 7: More Cases Approved This Month ⚠️ (TO BE EXTRACTED)
- Monthly summary with filters
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}`

### Section 8: Approval & RFE Rate ⚠️ (TO BE CONSOLIDATED)
- Approvals count, RFE count, RFE rate %
- Breakdown by service center + optional country
- **Data Source**: `/rfeStats/{scopeId}`

### Section 9: Approval Trends ✅
- Trend chart (show ONLY if >= 7 real trend points exist)
- **Data Source**: `/trends/{scopeId}`

### Section 10: All Service Centers ✅
- All Service Centers aggregate + individual center cards
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}` + service center breakdown

### Charts & Trends (Simple) Block ❌ (TO BE IMPLEMENTED)
- 6 charts (hide each if data missing)
- **Data Source**: Various aggregates

## Firestore Security Rules

All required rules are already in place in `VisaNova-IOS/firestore-security-rules-final.txt`:

```javascript
// ✅ System Daily Stats (public read, admin write)
match /systemDailyStats/{date} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ System Monthly Stats (public read, admin write)
match /systemMonthlyStats/{month} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ Trends Data (public read, admin write)
match /trends/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ PD Stats (public read, admin write)
match /pdStats/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ RFE Stats (public read, admin write)
match /rfeStats/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ Calendar Approvals (public read, admin write)
match /calendarApprovals/{month} {
  allow read: if true;
  allow write: if isAdmin();
}

// ✅ System Coverage (public read, admin write)
match /systemCoverage/{scopeId} {
  allow read: if true;
  allow write: if isAdmin();
}
```

## Implementation Status

**Status**: Ready to begin implementation
**Estimated Complexity**: Very High
**Files to Modify**: ~10 files
**New Files to Create**: ~5 files
**Lines of Code to Change**: ~1000+ lines

## Next Steps

1. Phase 1: Remove sections not in required list (iOS + Web)
2. Phase 2: Reorder sections to match required order
3. Phase 3: Consolidate duplicates
4. Phase 4: Extract Sections 7 & 8
5. Phase 5: Implement missing sections (Section 5, Charts block)
6. Phase 6: Ensure all sections use real data + conditional rendering
7. Phase 7: Verify consistency between iOS and Web
