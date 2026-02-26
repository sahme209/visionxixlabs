# StatsView Phase 6: Charts & Trends (Simple) Block

## Overview
Implement the Charts & Trends (Simple) block with 6 charts as specified in the requirements.

## Required Charts

### CHART A: "Faster or slower?"
- **Type**: Line chart
- **Data**: Approvals/day last 30 days
- **Scope**: User scope and all scope (two lines)
- **Condition**: Hide if < 7 data points
- **Data Source**: `/trends/{scopeId}` → `approvalsPerDayPoints`

### CHART B: "Your PD vs Latest Approved PD"
- **Type**: Progress/gauge chart
- **Data**: User PD vs `latestApprovedPD`
- **Condition**: Hide if `latestApprovedPD` missing
- **Data Source**: `/pdStats/{scopeId}` → `latestApprovedPD`

### CHART C: "ETA trend"
- **Type**: Line chart
- **Data**: ETA-days last 14-30 days for user scope
- **Condition**: Hide if cannot compute
- **Data Source**: `/trends/{scopeId}` → `etaPoints`

### CHART D: "Service centers comparison"
- **Type**: Bar chart
- **Data**: Avg processing days by service center
- **Data Source**: Service center stats (existing data)

### CHART E: "RFE simple risk"
- **Type**: Donut/pie chart
- **Data**: Approved-with-RFE vs without-RFE for user cohort
- **Condition**: Hide if no cohort stats
- **Data Source**: `/rfeStats/{scopeId}`

### CHART F: "Monthly approvals calendar"
- **Type**: Calendar heatmap
- **Data**: Current month approvals/day
- **Condition**: Hide if no daily counts
- **Data Source**: `/calendarApprovals/{YYYY-MM}`

## Implementation Plan

### iOS (SwiftUI)
1. Check if Charts framework is available (iOS 16+)
2. Create `ChartsAndTrendsSection.swift` component file
3. Implement each chart as a separate view component
4. Use conditional rendering (hide if no data)
5. Add "Explain like I'm 5" captions

### Web (React/Recharts)
1. Use existing Recharts library
2. Create `ChartsAndTrendsSection.tsx` component
3. Implement each chart using Recharts components
4. Use conditional rendering (hide if no data)
5. Add "Explain like I'm 5" captions

## Data Fetching

All charts use existing data service methods:
- `getTrendsData(scopeId)` - for Charts A & C
- `getPDStats(scopeId)` - for Chart B
- Service center stats (existing) - for Chart D
- `getRFEStats(scopeId)` - for Chart E
- `getCalendarApprovals(month)` - for Chart F

## Notes

- All charts must be "dummy-friendly" with simple captions
- Hide charts if dependent profile fields are missing
- Use `ScopeBuilder.fromProfile()` for personalized charts
- Charts should gracefully handle missing data (return null/EmptyView)
