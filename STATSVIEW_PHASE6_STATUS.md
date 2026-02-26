# StatsView Phase 6: Charts & Trends Implementation Status

## Overview
Implementing the Charts & Trends (Simple) block with 6 charts on both iOS (SwiftUI) and Web (React/Recharts).

## Charts Required

### ✅ CHART A: "Faster or slower?" (Line Chart)
- Approvals/day last 30 days
- User scope + all scope (two lines)
- Hide if < 7 data points
- **Status**: TODO

### ✅ CHART B: "Your PD vs Latest Approved PD" (Progress/Gauge)
- User PD vs latestApprovedPD
- Hide if latestApprovedPD missing
- **Status**: TODO

### ✅ CHART C: "ETA trend" (Line Chart)
- ETA-days last 14-30 days
- Hide if cannot compute
- **Status**: TODO

### ✅ CHART D: "Service centers comparison" (Bar Chart)
- Avg processing days by service center
- **Status**: TODO

### ✅ CHART E: "RFE simple risk" (Donut/Pie Chart)
- Approved-with-RFE vs without-RFE
- Hide if no cohort stats
- **Status**: TODO

### ✅ CHART F: "Monthly approvals calendar" (Calendar Heatmap)
- Current month approvals/day
- Hide if no daily counts
- **Status**: TODO

## Implementation Plan

### Phase 6.1: Foundation ✅
- Create ChartsAndTrendsSection component structure (iOS + Web)
- Add section header with "Explain like I'm 5" descriptions
- Set up data fetching infrastructure
- Add conditional rendering logic

### Phase 6.2: Simple Charts (Priority) ⏳
1. CHART E: RFE simple risk (Donut/Pie) - simplest
2. CHART B: PD progress/gauge - relatively simple
3. CHART D: Service centers bar chart - uses existing data

### Phase 6.3: Complex Charts ⏳
4. CHART A: Faster/slower line chart (two lines)
5. CHART C: ETA trend line chart
6. CHART F: Calendar heatmap (most complex)

## Data Sources

- `/trends/{scopeId}` - Charts A & C
- `/pdStats/{scopeId}` - Chart B
- Service center stats (existing) - Chart D
- `/rfeStats/{scopeId}` - Chart E
- `/calendarApprovals/{YYYY-MM}` - Chart F

## Notes

- All charts must be "dummy-friendly" with simple captions
- Hide charts if dependent profile fields are missing
- Use `ScopeBuilder.fromProfile()` for personalized charts
- Charts should gracefully handle missing data
