# iOS Stats Tab Audit

## Overview
This document audits the iOS Stats tab implementation to understand all sections, data sources, calculations, and logic that must be replicated in the web version.

**Source Files:**
- `VisaNova-IOS/Views/StatsView.swift` (5467 lines)
- `VisaNova-IOS/Managers/StatsDataService.swift` (667 lines)
- `VisaNova-IOS/Models/SystemStatsModels.swift` (223 lines)

---

## Section A: System Health + Your Risk

### Location in iOS
- **View**: `systemHealthSection` (line 1173-1206)
- **Components**: 
  - `SnapshotGrid` (line 3773-3836)
  - `RiskAssessmentCard` (conditional, only if `hasUserProfile`)

### SnapshotGrid (System Overview Cards)
**Displayed Values:**
1. **"I-130 Pending"** - `"879k+"` (hardcoded, needs real data)
2. **"Immigration Backlog"** - `"11.3M+"` (hardcoded, needs real data)
3. **"Last Month Approved"** - `"1.2M+"` (hardcoded, needs real data)
4. **"Daily Average"** - `"45k+"` (hardcoded, needs real data)

**Data Source:**
- Currently hardcoded in iOS (line 3776-3780)
- **Should use**: `/systemMonthlyStats` for last month approved and daily average
- **Should use**: Backend aggregation for I-130 pending count
- **Should use**: System-wide backlog estimate (may remain hardcoded if no real source)

**Calculation:**
- Daily Average = `approvalsTotal / daysInMonth` from `SystemMonthlyStats`
- Last Month Approved = `approvalsTotal` from previous month's `SystemMonthlyStats`
- I-130 Pending = Count of pending I-130 cases (needs backend aggregation)
- Immigration Backlog = System-wide estimate (may remain hardcoded)

### RiskAssessmentCard
**Inputs:**
- `caseAge`: Days since priority date
- `currentStage`: Current case stage
- `priorityDate`: User's priority date string
- `userServiceCenter`: User's service center
- `userCountry`: Beneficiary country
- `formType`: Form type (I-130, I-129F, etc.)

**Calculation:**
- Risk factors calculated based on case age, service center backlog, country-specific delays
- Uses `calculateCaseAge()` and `getCurrentStage()` helper functions
- Shows risk factors with severity levels (high/medium/low)

**Data Source:**
- User profile data (`UserData.shared`, `ProfileDataService.shared`)
- Service center stats from `StatsDataService.getServiceCenterStats()`

---

## Section B: System Overview Cards

**Note:** This appears to be the same as SnapshotGrid in Section A. The iOS code shows SnapshotGrid is part of `systemHealthSection`.

**Cards:**
1. I-130 Pending
2. Immigration last month (Last Month Approved)
3. Daily average
4. (Backlog is also shown)

**Same as Section A above.**

---

## Section C: Today's Update

### Location in iOS
- **View**: `todaysUpdateSection` (line 1074-1092)
- **Component**: `TodaysUpdateCard` (line 4479-4768)

### Features
1. **Tabs**: Daily / Monthly / Yearly (enum `TimePeriod`)
2. **Donut Chart**: Shows case status distribution
3. **Metrics List**: 
   - Total Cases
   - Approval
   - Processing
   - Transferred
   - Interview
   - RFE
   - Biometrics
   - Received

4. **"More cases" expansion**: Shows all categories if > 4, with "See More" / "Show Less" toggle

### Data Source
**Current iOS Implementation:**
- Uses `SeededRandomGenerator` to simulate data (line 4491-4595)
- **Should use**: `/systemDailyStats` for daily data
- **Should use**: `/systemMonthlyStats` for monthly data
- **Should use**: `/calendarApprovals` for yearly data

**Calculation:**
- Daily: Aggregates from `/systemDailyStats/{YYYY-MM-DD}`
- Monthly: Aggregates from `/systemMonthlyStats/{YYYY-MM}`
- Yearly: Aggregates from `/calendarApprovals/{YYYY-MM}` for all months in year

**Status Categories:**
- Approval: Cases approved
- Processing: Cases being processed
- Transferred: Cases transferred
- Interview: Interview scheduled
- RFE: Request for Evidence
- Biometrics: Biometrics completed
- Received: Cases received

**Date Window:**
- Daily: Current day
- Monthly: Current month
- Yearly: Current year

---

## Section D: More Cases Approved This Month

### Location in iOS
- **View**: `moreCasesApprovedThisMonthSection` (line 1030-1043)
- **Component**: `MonthlyComparisonCard` (line 4771-4960)

### Features
1. **Graph**: Line chart comparing this month vs last month
2. **Summary Text**: "X more cases approved this month"
3. **Calculation**: Compares current month progress vs last month progress

### Data Source
**Current iOS Implementation:**
- Uses `SeededRandomGenerator` with month progress calculation (line 4775-4803)
- **Should use**: `/systemMonthlyStats` for current month
- **Should use**: `/systemMonthlyStats` for previous month

**Calculation:**
```swift
// iOS calculation (line 4775-4803)
let monthProgress = Double(currentDay) / Double(daysInCurrentMonth)
let lastMonthBase = 8500 + seededRandom.nextInt(in: -600...600)
let dailyAverage = Double(lastMonthBase) / 30.0
let projectedThisMonth = Int(dailyAverage * 30.0 * (1.0 + growthRate))
let thisMonthActual = Int(Double(projectedThisMonth) * monthProgress)
let difference = thisMonthActual - Int(Double(lastMonthBase) * monthProgress)
```

**Web Implementation Should:**
- Get current month from `/systemMonthlyStats/{currentMonth}`
- Get previous month from `/systemMonthlyStats/{previousMonth}`
- Calculate: `difference = currentMonth.approvalsTotal - previousMonth.approvalsTotal`
- Account for month progress: `projectedCurrent = (currentMonth.approvalsTotal / currentDay) * daysInMonth`
- Compare projected vs actual last month at same progress point

**Baseline Comparison:**
- Compares current month's approvals (projected to full month) vs last month's total
- Shows difference as "X more cases approved this month"

---

## Section E: Approval & RFE Rate

### Location in iOS
- **View**: `approvalRFERateSection` (line 1052-1065)
- **Component**: `ApprovalRFERateCard` (line 4963-5160)

### Features
1. **Two Circular Charts**: 
   - Approval Rate (green)
   - RFE Rate (orange)
2. **Premium Gate**: Only shows if subscribed

### Data Source
**Current iOS Implementation:**
- Uses `SeededRandomGenerator` to simulate rates (line 4969-5006)
- Approval rate: 65-72% (base 68.5%)
- RFE rate: 28-35% (base 31.5%)
- **Should use**: `/rfeStats/{scopeId}` for real RFE data

**Calculation:**
```swift
// iOS calculation (line 4969-5006)
approvalRate = baseRate + dailyVariation + weeklyPattern + monthlyTrend
rfeRate = baseRate + dailyVariation + weeklyPattern + monthlyTrend
```

**Web Implementation Should:**
- Get RFE stats from `/rfeStats/{scopeId}`
- Approval rate = `1 - rfeRate` (if RFE rate is available)
- Or calculate from approval data: `approvalRate = approvals / (approvals + rfes)`
- RFE rate = `rfeCount / cohortSize` from `RFEStats`

**Scope ID:**
- Built from user profile: `petitionType:I-130|center:California|country:India`
- Falls back to less specific scopes if data not available

**Date Window:**
- Uses recent approvals (last 30-90 days) for rate calculation
- Cohort size must be >= 20 to show stats

---

## Section F: Weekly Approval Breakdown

### Location in iOS
- **View**: `cumulativeApprovalsSection` (line 1096-1114)
- **Component**: `CumulativeApprovalsChart` (referenced, implementation not shown in search results)

### Features
1. **Graph**: Shows daily approval counts for last 7 days
2. **Breakdown**: I-130 (blue) and I-129F (purple) separately
3. **Time Range**: Last 7 days

### Data Source
**Should use:**
- `/i130Approvals` - Group by approval date, filter last 7 days
- `/i129fApprovals` - Group by approval date, filter last 7 days

**Calculation:**
- Group approvals by date for last 7 days
- Count I-130 approvals per day
- Count I-129F approvals per day
- Display as grouped bar chart or stacked bar chart

**Week Definition:**
- Last 7 days from today
- Timezone: User's local timezone or UTC (match iOS)

---

## Section G: Approval Trends — Daily Approval Trends for I-130

### Location in iOS
- **View**: `approvalTrendsSection` (line 1117-1170)
- **Component**: `ApprovalTrendsChart` (referenced, implementation not shown)

### Features
1. **Line/Bar Graph**: Daily approval counts over time
2. **Summary Cards**: 
   - Total approvals
   - Average per day
   - Peak day
   - Trend direction (increasing/decreasing/stable)

### Data Source
**Should use:**
- `/i130Approvals` - Group by approval date
- Or `/trends/{scopeId}` if pre-aggregated

**Calculation:**
- Get approval data for last 90 days (or selected range)
- Group by date, count approvals per day
- Calculate:
  - Total = sum of all approvals
  - Average = total / number of days
  - Peak = max approvals in a single day
  - Trend = compare last 7 days vs previous 7 days

**Date Window:**
- Default: Last 90 days
- User can select: 7D, 30D, 90D

**Summary Calculation:**
- Last 7 days delta: `(last7days - previous7days) / previous7days * 100`
- Avg/day: `totalApprovals / daysInRange`
- Best day: Day with max approvals
- Trend direction: Compare recent vs older period

---

## Section H: How Long Do Cases Take — I-130

### Location in iOS
- **View**: `approvalTrendsSection` (line 1137)
- **Component**: `ProcessingTimeChart` (referenced, implementation not shown)

### Features
1. **Graph**: Distribution/bar chart showing processing time distribution
2. **Metrics**: Average, median, min, max processing days

### Data Source
**Should use:**
- `/i130Approvals` - Calculate `processingDays = approvalDate - priorityDate` for each approval
- Or use precomputed stats if available

**Calculation:**
```swift
// iOS calculation (from StatsDataService)
let processingDays = centerApprovals.map { $0.processingDays }
let avgDays = processingDays.reduce(0, +) / processingDays.count
```

**Processing Time Calculation:**
- For each approval: `processingDays = daysBetween(priorityDate, approvalDate)`
- Calculate distribution: Group by time ranges (e.g., 300-350 days, 350-400 days, etc.)
- Show as histogram/bar chart
- Display average, median, min, max

**Time Range:**
- Use all available approvals (or last 180 days for recent trends)

---

## Section I: Daily Approval Trends for I-129F

### Location in iOS
- **View**: `approvalTrendsSection` (line 1144)
- **Component**: `I129FApprovalTrendsChart` (referenced, implementation not shown)

### Features
1. **Graph**: Line/bar chart for I-129F approvals
2. **Summary Tiles**: Same as Section G but for I-129F

### Data Source
**Should use:**
- `/i129fApprovals` - Group by `noa2Date` (approval date)
- Filter only approved cases (`noa2Date` is not null)

**Calculation:**
- Same as Section G but for I-129F form type
- Use `noa2Date` instead of `approvalDate`
- Group by date, count approvals per day

**Date Window:**
- Same rules as Section G (last 90 days default)

---

## Section J: How Long Do Cases Take — I-129F

### Location in iOS
- **View**: `approvalTrendsSection` (line 1151)
- **Component**: `I129FProcessingTimeChart` (referenced, implementation not shown)

### Features
1. **Bar Graph**: Processing time distribution for I-129F
2. **Calculation**: Same as Section H but for I-129F

### Data Source
**Should use:**
- `/i129fApprovals` - Calculate `processingDays = noa2Date - noa1Date` for each approval

**Calculation:**
```swift
// iOS calculation (from StatsDataService.getI129FProcessingTimes)
let days = calendar.dateComponents([.day], from: approval.noa1Date.dateValue(), to: approval.noa2Date.dateValue()).day ?? 0
```

**Processing Time:**
- For each I-129F approval: `processingDays = daysBetween(noa1Date, noa2Date)`
- Calculate distribution and show as histogram
- Display average, median, min, max

---

## Section K: How Long Have Offices Been Quiet — I-130

### Location in iOS
- **View**: `approvalTrendsSection` (line 1158)
- **Component**: `QuietOfficesChart` (referenced, implementation not shown)

### Features
1. **Graph**: Shows days since last approval per service center/field office
2. **Definition of "Quiet"**: Days since last approval from that office

### Data Source
**Should use:**
- `/i130Approvals` - Group by `serviceCenter`
- Find most recent `approvalDate` per center
- Calculate days since that date

**Calculation:**
```swift
// Concept (not exact iOS code)
for each serviceCenter:
  let latestApproval = max(approvals.filter { $0.serviceCenter == center }, by: { $0.approvalDate })
  let daysSince = daysBetween(latestApproval.approvalDate, today)
```

**"Quiet" Definition:**
- Days since last approval from that service center
- Smaller number = more recent activity
- Larger number = office has been "quiet" longer

**Display:**
- Bar chart or list showing service centers
- Sort by days since last approval (ascending = most active first)

---

## Section L: Which Center Are Most Active — I-130

### Location in iOS
- **View**: `approvalTrendsSection` (line 1165)
- **Component**: `MostActiveCentersChart` (referenced, implementation not shown)

### Features
1. **Bar Graph**: Ranking of service centers by activity
2. **Definition of "Active"**: Approvals in last X days (likely 30 days)

### Data Source
**Should use:**
- `/i130Approvals` - Filter last 30 days
- Group by `serviceCenter`
- Count approvals per center

**Calculation:**
```swift
// Concept
let thirtyDaysAgo = calendar.date(byAdding: .day, value: -30, to: today)
let recentApprovals = approvals.filter { $0.approvalDate >= thirtyDaysAgo }
let centerCounts = recentApprovals.groupBy { $0.serviceCenter }.mapValues { $0.count }
```

**"Active" Definition:**
- Number of approvals in last 30 days per service center
- Rank centers by approval count (descending)
- Show as horizontal or vertical bar chart

**Time Window:**
- Last 30 days (configurable, but 30 days is standard)

---

## Data Service Methods (StatsDataService)

### Key Methods to Replicate:

1. **`getApprovalDataByDate(daysBack: Int = 180)`**
   - Fetches from `/i130Approvals`
   - Groups by approval date
   - Returns `[ApprovalData]` with date and count

2. **`getServiceCenterStats()`**
   - Groups by `serviceCenter`
   - Calculates average processing days
   - Finds latest PD per center
   - Determines status (improving/declining/stable)

3. **`getLatestPD()`**
   - Finds most recent approval
   - Returns latest priority date string

4. **`getLiveData()`**
   - Filters last 24 hours
   - Returns: approval count, PDs covered, pace, latest PD

5. **`getAverageProcessingTime()`**
   - Calculates `(approvalDate - priorityDate)` average

6. **`getCachedI129FApprovals()`**
   - Fetches from `/i129fApprovals`
   - Filters `formType == "I-129F"`

7. **`getI129FApprovalDataByDate(daysBack: Int = 180)`**
   - Groups I-129F approvals by `noa2Date`
   - Returns `[ApprovalData]`

8. **`getI129FProcessingTimes()`**
   - Calculates `noa2Date - noa1Date` for each approval

9. **System Stats Methods:**
   - `getSystemDailyStats(date: Date)`
   - `getSystemMonthlyStats(month: String)`
   - `getSystemCoverage(scopeId: String)`
   - `getTrendsData(scopeId: String)`
   - `getPDStats(scopeId: String)`
   - `getRFEStats(scopeId: String)`
   - `getCalendarApprovals(month: String)`

---

## Firestore Collections Used

1. **`/i130Approvals`**
   - Fields: `formType`, `beneficiaryCountry`, `priorityDate`, `approvalDate`, `serviceCenter`, `notes`, `createdAt`
   - Query: `where("formType", "==", "I-130")`

2. **`/i129fApprovals`**
   - Fields: `formType`, `beneficiaryCountry`, `noa1Date`, `noa2Date`, `rfeDate`, `rfeResponseDate`, `usEmbassy`, `notes`, `createdAt`
   - Query: `where("formType", "==", "I-129F")`

3. **`/systemDailyStats/{YYYY-MM-DD}`**
   - Fields: `approvalsCount`, `approvalsCountYesterday`, `priorityDateMovement`, `activeCasesProcessed`, `updatedAt`

4. **`/systemMonthlyStats/{YYYY-MM}`**
   - Fields: `approvalsTotal`, `approvalsLastMonth`, `dailyAverage`, `bestDay`, `bestDayCount`, `updatedAt`

5. **`/systemCoverage/{scopeId}`**
   - Fields: `coverageRatio`, `sourceDescription`, `updatedAt`

6. **`/trends/{scopeId}`**
   - Fields: `approvalsPerDayPoints`, `etaPoints`, `updatedAt`

7. **`/pdStats/{scopeId}`**
   - Fields: `latestApprovedPD`, `lastApprovedPD`, `pacePdsPerDay`, `avgTimeDays`, `backlog`, `updatedAt`

8. **`/rfeStats/{scopeId}`**
   - Fields: `cohortSize`, `rfeCount`, `rfeRate`, `updatedAt`

9. **`/calendarApprovals/{YYYY-MM}`**
   - Fields: `days` (object with date keys and count values), `updatedAt`

---

## Caching Strategy

**iOS Implementation:**
- Cache TTL: 5 minutes (300 seconds)
- Uses Firestore listeners for real-time updates
- Falls back to stale cache if fetch fails

**Web Implementation Should:**
- Use SWR or React Query for client-side caching
- Cache TTL: 5 minutes (match iOS)
- Use Firestore `onSnapshot` for real-time updates where needed
- Or use ISR (Incremental Static Regeneration) for server-side caching

---

## Edge Cases & Fallbacks

1. **No Data Available:**
   - Show "Not available" or empty state
   - Don't show mock/fake numbers
   - Match iOS empty state behavior

2. **Insufficient Sample Size:**
   - Service centers: Minimum 3 approvals to show stats
   - RFE stats: Minimum 20 cohort size to show rates
   - Hide sections if data insufficient

3. **Missing Fields:**
   - Handle missing `serviceCenter`, `priorityDate`, `approvalDate`
   - Skip records with invalid dates
   - Log warnings for debugging

4. **Date Range Edge Cases:**
   - Handle timezone differences
   - Handle leap years
   - Handle month boundaries correctly

---

## Verification Checklist

After implementation, verify:

1. ✅ All sections A-L are present in correct order
2. ✅ All calculations match iOS exactly
3. ✅ All data sources match iOS (same Firestore collections)
4. ✅ Date ranges match iOS (7D, 30D, 90D, etc.)
5. ✅ Empty states match iOS (show "Not available" not mock data)
6. ✅ Charts render correctly with real data
7. ✅ Loading states are shown while fetching
8. ✅ Error handling matches iOS (fallback to stale cache, show errors)
9. ✅ User profile integration works (for personalized sections)
10. ✅ Build passes (`npm run build`)

---

## Notes

- iOS uses `SeededRandomGenerator` for some sections (Today's Update, Monthly Comparison, Approval/RFE Rate) - these should be replaced with real data from Firestore
- Some sections are premium-gated in iOS - web should match this behavior
- iOS has real-time listeners - web should use Firestore `onSnapshot` or polling for updates
- All date calculations should match iOS timezone handling
