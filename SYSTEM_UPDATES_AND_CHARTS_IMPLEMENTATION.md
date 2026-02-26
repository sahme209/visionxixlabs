# System Updates & Charts & Trends Implementation

## Overview
This document outlines the implementation of "System Updates" and "Charts & Trends" sections within the existing StatsView on both iOS (SwiftUI) and Web (Next.js).

## Status
✅ Data models created (iOS & Web)
✅ StatsDataService extended with new data fetching methods
🔄 UI components in progress
⏳ Firestore security rules pending
⏳ Aggregation documentation pending

## Data Models Created

### iOS (`VisaNova-IOS/Models/SystemStatsModels.swift`)
- `SystemDailyStats` - Daily aggregated statistics
- `SystemMonthlyStats` - Monthly aggregated statistics
- `SystemCoverage` - Coverage ratios for extrapolation
- `TrendsData` - Trend data with approval and ETA points
- `PDStats` - Priority date statistics
- `RFEStats` - RFE statistics
- `CalendarApprovals` - Calendar heatmap data
- `ScopeBuilder` - Helper enum for building scope strings

### Web (`VisaNovaWeb/lib/types.ts`)
- Matching TypeScript interfaces for all models above
- `buildScopeId()` and `scopeFromProfile()` helper functions

## Data Service Extensions

### iOS (`VisaNova-IOS/Managers/StatsDataService.swift`)
Added methods:
- `getSystemDailyStats(date:)` - Fetch daily stats for a date
- `getSystemMonthlyStats(month:)` - Fetch monthly stats
- `getSystemCoverage(scopeId:)` - Fetch coverage ratio
- `getTrendsData(scopeId:)` - Fetch trends data
- `getPDStats(scopeId:)` - Fetch PD statistics
- `getRFEStats(scopeId:)` - Fetch RFE statistics
- `getCalendarApprovals(month:)` - Fetch calendar approvals

All methods return optional values - sections must be hidden if data is nil.

## Implementation Requirements

### CRITICAL RULES
1. **NO MOCK DATA** - Everything must come from real Firestore data
2. **Conditional Rendering** - Hide sections/cards if data doesn't exist
3. **Profile-Based Scope** - Use ScopeBuilder to fetch data based on user profile
4. **Service Center Support** - Support "All Service Centers" aggregate + individual centers

### System Updates Section

#### 1. Today's Update (Already exists but uses mock data - needs real data)
**Location**: `whatChangedTodaySection` in StatsView.swift
**Requirements**:
- Fetch `SystemDailyStats` for today
- Show only if data exists:
  - Top Metrics Row: New Approvals (with delta), Priority Date Movement, Active Cases
  - Daily Impact Analysis: Time Saved, Queue Position, Progress, ETA
  - AI Insights: Up to 3 cards (only if computable from real data)
  - System Health: Only if backend telemetry exists
  - PD Snapshot: From `PDStats`
  - Approval Trends chart: Only if >= 7 points
  - Service Center Comparison: All centers + individual cards
  - Similar Cases CTA: Profile completion check

#### 2. This Month Section (NEW - needs to be added)
**Requirements**:
- Fetch `SystemMonthlyStats` for current month
- Show: approvals total, trend vs last month, daily average, best day
- Filters: month selector, service center filter
- Hide if data doesn't exist

#### 3. Approval & RFE Section (Partially exists - needs expansion)
**Requirements**:
- Fetch `RFEStats` for user scope
- Show: approvals count, RFE count, RFE rate, breakdown by service center
- Drill-in: Timeline events per case (NOA1, RFE, RFE Response, NOA2, etc.)
- Hide missing fields (don't show placeholders)

### Charts & Trends Section

#### CHART A: "Faster or slower?"
- Line chart: approvals/day last 30 days (user scope + all scope)
- Caption: "This week: X/day vs monthly avg: Y/day → Faster/Slower by Z%"
- Hide if < 7 points

#### CHART B: "Your PD vs Latest Approved PD"
- Progress/gauge: user PD vs latestApprovedPD
- Caption: "You're about __% of the way from your PD to the latest approved PD."
- Hide if latestApprovedPD missing

#### CHART C: "ETA trend"
- Line chart: ETA-days last 14-30 days
- Caption: "Your estimated wait changed by __ days in the last __ days."
- Hide if cannot compute

#### CHART D: "Service centers comparison"
- Bar chart: avg processing days by service center
- Caption: "Fastest: ___ (avg ___ days). Slowest: ___ (avg ___ days)."
- If only 1 center, show card not chart

#### CHART E: "RFE simple risk"
- Donut/pie: approved-with-RFE vs without-RFE
- Caption: "Out of ___ similar cases, ___ got an RFE (___%)."
- Sample size safety: If cohortSize < 20-30, show "Small sample size"
- Hide if no cohort stats

#### CHART F: "Monthly approvals calendar"
- Calendar heatmap: current month approvals/day
- Caption: "Busiest day: ___ with ___ approvals."
- Hide if no daily counts

## Firestore Collections Structure

### `/systemDailyStats/{YYYY-MM-DD}`
```swift
{
  date: "2026-01-11",
  approvalsCount: 150,
  approvalsCountYesterday: 145,
  priorityDateMovement: 3,
  activeCasesProcessed: 127,
  updatedAt: Timestamp
}
```

### `/systemMonthlyStats/{YYYY-MM}`
```swift
{
  month: "2026-01",
  approvalsTotal: 4500,
  approvalsLastMonth: 4200,
  dailyAverage: 145.16,
  bestDay: "2026-01-15",
  bestDayCount: 180,
  updatedAt: Timestamp
}
```

### `/systemCoverage/{scopeId}`
```swift
{
  scopeId: "all",
  coverageRatio: 0.65, // 0-1
  sourceDescription: "Admin-maintained coverage ratio",
  updatedAt: Timestamp
}
```

### `/trends/{scopeId}`
```swift
{
  scopeId: "petitionType:I-130|center:California",
  approvalsPerDayPoints: [
    { date: "2026-01-01", count: 50 },
    ...
  ],
  etaPoints: [
    { date: "2026-01-01", etaDays: 120 },
    ...
  ],
  updatedAt: Timestamp
}
```

### `/pdStats/{scopeId}`
```swift
{
  scopeId: "all",
  latestApprovedPD: "2025-09-15",
  lastApprovedPD: "2025-09-12",
  pacePdsPerDay: 2.5,
  avgTimeDays: 395,
  backlog: null, // Only if real source exists
  updatedAt: Timestamp
}
```

### `/rfeStats/{scopeId}`
```swift
{
  scopeId: "petitionType:I-130|center:California|country:India",
  cohortSize: 250,
  rfeCount: 30,
  rfeRate: 0.12, // 12%
  updatedAt: Timestamp
}
```

### `/calendarApprovals/{YYYY-MM}`
```swift
{
  month: "2026-01",
  days: {
    "2026-01-01": 145,
    "2026-01-02": 150,
    ...
  },
  updatedAt: Timestamp
}
```

## Firestore Security Rules (To Be Added)

```javascript
// System Daily Stats (public read, admin write)
match /systemDailyStats/{date} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

// System Monthly Stats (public read, admin write)
match /systemMonthlyStats/{month} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

// System Coverage (public read, admin write)
match /systemCoverage/{scopeId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

// Trends (public read, admin write)
match /trends/{scopeId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

// PD Stats (public read, admin write)
match /pdStats/{scopeId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

// RFE Stats (public read, admin write)
match /rfeStats/{scopeId} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}

// Calendar Approvals (public read, admin write)
match /calendarApprovals/{month} {
  allow read: if true;
  allow write: if request.auth != null && request.auth.token.admin == true;
}
```

## Aggregation Requirements

These collections must be populated by:
1. **Admin tool** - Backend process that aggregates from `/i130Approvals` and `/i129fApprovals`
2. **Cloud Functions** - Automated aggregation on approval data updates
3. **Manual admin process** - For coverage ratios and initial data

### Aggregation Logic (To Be Implemented)

1. **Daily Stats Aggregation**:
   - Query approvals where `approvalDate` is today
   - Count approvals, calculate delta vs yesterday
   - Calculate priority date movement
   - Count active cases processed

2. **Monthly Stats Aggregation**:
   - Group approvals by month
   - Calculate totals, averages, best day
   - Compare with previous month

3. **Trends Aggregation**:
   - Group approvals by date for last 30 days
   - Calculate ETA trends if user PD is available
   - Store as array of points

4. **PD Stats Aggregation**:
   - Find latest approved PD from approvals
   - Calculate pace (PDs/day) from recent approvals
   - Calculate average processing time

5. **RFE Stats Aggregation**:
   - Count RFEs in approvals (from `notes` field or dedicated RFE field)
   - Group by scope (petition type, center, country)
   - Calculate rates

6. **Calendar Approvals Aggregation**:
   - Group approvals by date for current month
   - Store as map { "YYYY-MM-DD": count }

## Next Steps

1. ✅ Create data models
2. ✅ Extend StatsDataService
3. ⏳ Create/update iOS UI components for System Updates section
4. ⏳ Create iOS Charts & Trends components
5. ⏳ Create Web data fetching hooks/services
6. ⏳ Create Web System Updates components
7. ⏳ Create Web Charts & Trends components
8. ⏳ Update Firestore security rules
9. ⏳ Document aggregation requirements for admin/backend

## Files to Create/Modify

### iOS
- ✅ `Models/SystemStatsModels.swift` - Created
- ✅ `Managers/StatsDataService.swift` - Extended
- ⏳ `Views/StatsView.swift` - Update whatChangedTodaySection, add new sections
- ⏳ `Views/Components/SystemUpdatesSection.swift` - New component file
- ⏳ `Views/Components/ChartsTrendsSection.swift` - New component file
- ⏳ Various chart components (LineChart, BarChart, DonutChart, ProgressGauge, CalendarHeatmap)

### Web
- ✅ `lib/types.ts` - Extended
- ⏳ `lib/statsService.ts` - New data fetching service
- ⏳ `app/stats/page.tsx` - Update to include new sections
- ⏳ `components/stats/SystemUpdatesSection.tsx` - New component
- ⏳ `components/stats/ChartsTrendsSection.tsx` - New component
- ⏳ Various chart components (matching iOS)

### Documentation
- ⏳ `firestore-security-rules.txt` - Update with new rules
- ⏳ `AGGREGATION_REQUIREMENTS.md` - Document aggregation logic
