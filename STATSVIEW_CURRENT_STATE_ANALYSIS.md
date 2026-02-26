# StatsView Current State Analysis

## Current iOS StatsView Sections (in order)
1. `whatChangedTodaySection` - ✅ KEEP (Section 1)
2. `yourCaseAnalysisSection` - ❌ REMOVE (not in required list)
3. `liveDataSection` - ❌ REMOVE/MERGE (merge relevant parts into Section 1 or 9)
4. `dailyImpactCardsSection` - ✅ KEEP (Section 2) - but contains multiple cards, needs review
5. `similarCasesSection` - ❌ REMOVE (not in required list)
6. `systemUpdatesSection` - ✅ KEEP but needs to be split/merged (Sections 6-8)
7. `chartsAndTrendsSection` - ✅ KEEP (Section 9) + needs Charts & Trends (Simple) block
8. `serviceCentersSection` - ✅ KEEP (Section 10)
9. `aiInsightsSection` - ✅ KEEP (Section 3)
10. `systemHealthSection` - ✅ KEEP (Section 4)

## Current Web StatsView Sections (in order)
1. "What Changed Today" - ✅ KEEP (Section 1)
2. "Daily Impact Analysis" - ✅ KEEP (Section 2)
3. "AI Insights" - ✅ KEEP (Section 3)
4. "System Health" - ⚠️ MERGE with "Your Risk" (Section 4)
5. NowTile - ❌ REMOVE/MERGE (merge relevant data into Section 1)
6. OverviewCards - ❌ REMOVE/MERGE (merge relevant data into appropriate sections)
7. Approval Trends Chart - ✅ KEEP (Section 9)
8. Service Centers - ✅ KEEP (Section 10)
9. Similar Cases - ❌ REMOVE (not in required list)
10. System Updates Section - ✅ KEEP but needs to be split/merged (Sections 6-8)

## Required Final Structure (10 Sections + Charts Block)

### Section 1: What Changed Today ✅
- **iOS**: Exists (`whatChangedTodaySection`)
- **Web**: Exists
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}`
- **Action**: Verify uses real data, add conditional rendering

### Section 2: Daily Impact Analysis ✅
- **iOS**: Exists (`dailyImpactCardsSection`) - but contains multiple cards
- **Web**: Exists
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}` + profile
- **Action**: Restructure to show Time Saved, Queue Position, Progress, ETA only

### Section 3: AI Insights ✅
- **iOS**: Exists (`aiInsightsSection`)
- **Web**: Exists
- **Data Source**: `/trends/{scopeId}`, `/rfeStats/{scopeId}`, `/pdStats/{scopeId}`
- **Action**: Ensure shows only computable insights, hide if none

### Section 4: System Health + Your Risk ✅
- **iOS**: Exists (`systemHealthSection`)
- **Web**: Exists but needs "Your Risk" added
- **Data Source**: Real telemetry + `/rfeStats/{scopeId}`
- **Action**: Merge System Health + Your Risk, conditional rendering

### Section 5: What Happens Next For You ❌ MISSING
- **iOS**: Needs to be added (exists in ContentView but not StatsView)
- **Web**: Needs to be added
- **Data Source**: Profile + processing/timeline engine
- **Action**: Implement on both platforms

### Section 6: Today's Update ⚠️ NEEDS REVIEW
- **iOS**: `TodaysUpdateCard` exists in `dailyImpactCardsSection`, `TodaysUpdateCardReal` in `systemUpdatesSection`
- **Web**: Check SystemUpdatesSection
- **Action**: If duplicate of Section 1, merge them

### Section 7: More Cases Approved This Month ⚠️ PARTIAL
- **iOS**: Part of `systemUpdatesSection` (`ThisMonthCardReal`)
- **Web**: Part of `SystemUpdatesSection` (`ThisMonthCard`)
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}`
- **Action**: Extract into standalone section, add filters

### Section 8: Approval & RFE Rate ⚠️ PARTIAL
- **iOS**: `ApprovalRFERateCard` in `dailyImpactCardsSection`, `ApprovalRFESectionCardReal` in `systemUpdatesSection`
- **Web**: Part of `SystemUpdatesSection` (`ApprovalRFECard`)
- **Data Source**: `/rfeStats/{scopeId}`
- **Action**: Extract into standalone section, consolidate duplicates

### Section 9: Approval Trends ✅
- **iOS**: Part of `chartsAndTrendsSection`
- **Web**: Exists
- **Data Source**: `/trends/{scopeId}`
- **Action**: Ensure shows only if >= 7 points exist

### Section 10: All Service Centers ✅
- **iOS**: Exists (`serviceCentersSection`)
- **Web**: Exists
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}` + service center breakdown
- **Action**: Ensure shows only centers with real data

### Charts & Trends (Simple) Block ❌ MISSING
- **iOS**: Needs to be added after Section 10
- **Web**: Needs to be added after Section 10
- **Charts**: A-F (6 charts total)
- **Data Source**: Various aggregates
- **Action**: Implement on both platforms

## Key Issues to Address

1. **Duplicates**: 
   - `TodaysUpdateCard` appears in both `dailyImpactCardsSection` and `systemUpdatesSection` on iOS
   - Approval & RFE Rate appears in multiple places
   - Need to consolidate

2. **Missing Sections**:
   - Section 5 (What Happens Next For You) missing on both
   - Charts & Trends (Simple) block missing on both

3. **Sections to Remove**:
   - `yourCaseAnalysisSection` (iOS)
   - `liveDataSection` (iOS) - merge relevant parts
   - `similarCasesSection` (iOS)
   - Similar Cases (Web)
   - NowTile/OverviewCards (Web) - merge relevant parts

4. **Data Sources**:
   - Need to verify all sections use real Firestore aggregates
   - Need to add conditional rendering based on data existence

## Implementation Priority

1. **Phase 1**: Remove sections not in required list
2. **Phase 2**: Reorder sections to match required order
3. **Phase 3**: Merge/consolidate duplicates (Section 6 with Section 1)
4. **Phase 4**: Implement missing sections (Section 5, Charts block)
5. **Phase 5**: Ensure all sections use real data + conditional rendering
6. **Phase 6**: Verify consistency between iOS and Web
