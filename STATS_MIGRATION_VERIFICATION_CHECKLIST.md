# Stats Migration Verification Checklist

## Overview
This document provides a checklist to verify that the web Stats implementation matches the iOS Stats tab exactly in terms of functionality, calculations, and data sources.

---

## ✅ Section A: System Health + Your Risk

### SnapshotGrid (System Overview Cards)
- [ ] **I-130 Pending**: Shows count from real data (or "Not available" if no data)
  - **iOS Source**: Hardcoded "879k+" (needs real data)
  - **Web Implementation**: Uses placeholder - needs backend aggregation
  - **Verification**: Check if value matches iOS or shows "Not available"

- [ ] **Immigration Backlog**: Shows system-wide estimate
  - **iOS Source**: Hardcoded "11.3M+"
  - **Web Implementation**: Uses placeholder - may remain hardcoded
  - **Verification**: Check if value matches iOS

- [ ] **Last Month Approved**: Shows from `/systemMonthlyStats/{previousMonth}`
  - **iOS Source**: Hardcoded "1.2M+"
  - **Web Implementation**: Uses `previousMonthStats.approvalsTotal`
  - **Verification**: Compare with iOS - should match if data exists

- [ ] **Daily Average**: Shows from `/systemMonthlyStats/{currentMonth}`
  - **iOS Source**: Hardcoded "45k+"
  - **Web Implementation**: Uses `currentMonthStats.dailyAverage`
  - **Verification**: Compare with iOS - should match if data exists

### RiskAssessmentCard
- [ ] **Only shows if user has profile** (`hasUserProfile` check)
- [ ] **Case Age Calculation**: Matches iOS `calculateCaseAge()`
  - Formula: `daysBetween(priorityDate, today)`
- [ ] **Risk Factors**: Based on case age, service center, country
- [ ] **Service Center Status**: Uses real data from `getServiceCenterStats()`
- [ ] **Verification**: Compare risk factors with iOS for same user profile

---

## ✅ Section C: Today's Update

### Period Tabs
- [ ] **Daily Tab**: Shows data from `/systemDailyStats/{today}`
- [ ] **Monthly Tab**: Shows data from `/systemMonthlyStats/{currentMonth}`
- [ ] **Yearly Tab**: Aggregates from `/calendarApprovals` for current year
- [ ] **Tab Switching**: Updates data when period changes

### Donut Chart
- [ ] **Renders correctly** with Recharts `PieChart`
- [ ] **Inner radius**: 60 (donut effect)
- [ ] **Outer radius**: 80
- [ ] **Center text**: Shows current date/month/year based on period
- [ ] **Colors**: Match iOS (Approval=blue, Processing=purple, etc.)

### Metrics List
- [ ] **Shows 4 by default**, expands to show all with "See More"
- [ ] **Categories**: Approval, Processing, Transferred, Interview, RFE, Biometrics, Received
- [ ] **Format**: Shows percentage and count `(X%) (Y)`
- [ ] **Sorted**: By percentage descending
- [ ] **Empty State**: Shows "Data not available" when no data

### Data Source Verification
- [ ] **Daily**: Uses `/systemDailyStats/{YYYY-MM-DD}`
- [ ] **Monthly**: Uses `/systemMonthlyStats/{YYYY-MM}`
- [ ] **Yearly**: Aggregates from `/calendarApprovals/{YYYY-MM}` for all months
- [ ] **No Mock Data**: Shows empty state if data not available

---

## ✅ Section D: More Cases Approved This Month

### Calculation
- [ ] **Current Month**: From `/systemMonthlyStats/{currentMonth}`
- [ ] **Previous Month**: From `/systemMonthlyStats/{previousMonth}`
- [ ] **Difference**: `currentMonth.approvalsTotal - previousMonth.approvalsTotal`
- [ ] **Month Progress**: Accounts for current day in month
- [ ] **Verification**: Compare difference with iOS for same date

### Graph
- [ ] **Line Chart**: Shows this month vs last month
- [ ] **X-axis**: Days of month
- [ ] **Y-axis**: Cumulative approvals
- [ ] **Legend**: Shows month names (abbreviated)
- [ ] **Colors**: This month = blue, Last month = gray

### Summary Text
- [ ] **Format**: "X more cases approved this month"
- [ ] **Calculation**: Matches iOS `MonthlyComparisonCard` logic
- [ ] **Verification**: Compare text with iOS for same date

---

## ✅ Section E: Approval & RFE Rate

### Data Source
- [ ] **RFE Stats**: From `/rfeStats/{scopeId}`
- [ ] **Scope ID**: Built from user profile (petitionType|center|country)
- [ ] **Minimum Sample**: Only shows if `cohortSize >= 20`

### Approval Rate
- [ ] **Calculation**: `1 - rfeRate` OR `approvals / (approvals + rfes)`
- [ ] **Range**: Should be 65-72% (if using iOS formula)
- [ ] **Display**: Circular chart with percentage

### RFE Rate
- [ ] **Calculation**: `rfeCount / cohortSize` from `RFEStats`
- [ ] **Range**: Should be 28-35% (if using iOS formula)
- [ ] **Display**: Circular chart with percentage

### Charts
- [ ] **Two Circular Charts**: Side by side
- [ ] **Approval Rate**: Green color, shows percentage
- [ ] **RFE Rate**: Orange color, shows percentage
- [ ] **Verification**: Compare rates with iOS for same scope

---

## ✅ Section F: Weekly Approval Breakdown

### Data Source
- [ ] **I-130**: From `/i130Approvals`, grouped by approval date, last 7 days
- [ ] **I-129F**: From `/i129fApprovals`, grouped by `noa2Date`, last 7 days
- [ ] **Date Range**: Last 7 days from today

### Chart
- [ ] **Type**: Grouped bar chart
- [ ] **X-axis**: Dates (last 7 days)
- [ ] **Y-axis**: Approval count
- [ ] **Bars**: I-130 (blue) and I-129F (purple) side by side
- [ ] **Legend**: Shows both form types

### Verification
- [ ] **Counts match iOS**: Compare daily counts for I-130 and I-129F
- [ ] **Date range matches**: Same 7 days as iOS
- [ ] **Timezone handling**: Matches iOS (UTC or local time)

---

## ✅ Section G: Approval Trends — Daily Approval Trends for I-130

### Data Source
- [ ] **From**: `/i130Approvals`, grouped by approval date
- [ ] **Date Range**: Last 90 days (default), or selected range (7D/30D/90D)
- [ ] **Range Selector**: 7D, 30D, 90D buttons

### Summary Cards
- [ ] **Total**: Sum of all approvals in range
- [ ] **Average**: `total / daysInRange`
- [ ] **Peak**: Day with max approvals (date + count)
- [ ] **Trend**: "increasing" | "decreasing" | "stable"
  - Calculation: Compare last 7 days vs previous 7 days
  - Delta: `((last7 - previous7) / previous7) * 100`

### Chart
- [ ] **Type**: Line chart
- [ ] **X-axis**: Dates
- [ ] **Y-axis**: Approval count
- [ ] **Line Color**: Blue (matches iOS)
- [ ] **Dots**: Show on data points

### Verification
- [ ] **Summary matches iOS**: Compare total, average, peak, trend
- [ ] **Chart data matches**: Compare daily counts
- [ ] **Date range matches**: Same range as iOS

---

## ✅ Section H: How Long Do Cases Take — I-130

### Data Source
- [ ] **From**: `/i130Approvals`
- [ ] **Calculation**: `processingDays = approvalDate - priorityDate` for each approval

### Statistics
- [ ] **Average**: Mean of all processing days
- [ ] **Median**: Middle value of sorted processing days
- [ ] **Min**: Minimum processing days
- [ ] **Max**: Maximum processing days

### Distribution
- [ ] **Ranges**: Grouped into 50-day buckets (e.g., 300-350, 350-400)
- [ ] **Chart**: Bar chart showing count per range
- [ ] **Most Common Range**: Highlighted or shown as text

### Verification
- [ ] **Average matches iOS**: Compare with iOS `getAverageProcessingTime()`
- [ ] **Distribution matches**: Compare histogram with iOS

---

## ✅ Section I: Daily Approval Trends for I-129F

### Data Source
- [ ] **From**: `/i129fApprovals`
- [ ] **Filter**: Only approved cases (`noa2Date` is not null)
- [ ] **Group By**: `noa2Date` (approval date)
- [ ] **Date Range**: Last 90 days (default), or selected range

### Summary Cards
- [ ] **Same as Section G**: Total, Average, Peak, Trend
- [ ] **Calculation**: Same logic as I-130 but for I-129F data

### Chart
- [ ] **Type**: Line chart
- [ ] **Color**: Purple (to distinguish from I-130)
- [ ] **Same format**: As Section G

### Verification
- [ ] **Counts match iOS**: Compare daily I-129F approval counts
- [ ] **Summary matches**: Compare with iOS I-129F trends

---

## ✅ Section J: How Long Do Cases Take — I-129F

### Data Source
- [ ] **From**: `/i129fApprovals`
- [ ] **Calculation**: `processingDays = noa2Date - noa1Date` for each approval

### Statistics
- [ ] **Same as Section H**: Average, Median, Min, Max
- [ ] **Distribution**: Same 50-day bucket grouping

### Chart
- [ ] **Same format**: As Section H
- [ ] **Color**: Purple (to match I-129F theme)

### Verification
- [ ] **Average matches iOS**: Compare with iOS I-129F processing times
- [ ] **Distribution matches**: Compare histogram with iOS

---

## ✅ Section K: How Long Have Offices Been Quiet — I-130

### Data Source
- [ ] **From**: `/i130Approvals`
- [ ] **Group By**: `serviceCenter`
- [ ] **Calculation**: For each center, find most recent `approvalDate`, calculate days since

### Definition of "Quiet"
- [ ] **Days Since Last Approval**: Smaller number = more active
- [ ] **Sorting**: Ascending (most active first)

### Chart
- [ ] **Type**: Horizontal bar chart
- [ ] **X-axis**: Days since last approval
- [ ] **Y-axis**: Service center names
- [ ] **Colors**: Green (< 30 days), Yellow (30-60 days), Red (> 60 days)

### Verification
- [ ] **Days match iOS**: Compare days since last approval per center
- [ ] **Ordering matches**: Same center ranking as iOS

---

## ✅ Section L: Which Center Are Most Active — I-130

### Data Source
- [ ] **From**: `/i130Approvals`
- [ ] **Filter**: Last 30 days
- [ ] **Group By**: `serviceCenter`
- [ ] **Count**: Approvals per center

### Definition of "Active"
- [ ] **Approvals in Last 30 Days**: Number of approvals per center
- [ ] **Sorting**: Descending (most active first)

### Chart
- [ ] **Type**: Horizontal bar chart
- [ ] **X-axis**: Approval count
- [ ] **Y-axis**: Service center names
- [ ] **Color**: Blue (USCIS blue)

### Verification
- [ ] **Counts match iOS**: Compare approval counts per center
- [ ] **Ranking matches**: Same center order as iOS

---

## Data Source Verification

### Firestore Collections
- [ ] **`/i130Approvals`**: Used for I-130 data
  - Query: `where("formType", "==", "I-130")`
  - Fields: `priorityDate`, `approvalDate`, `serviceCenter`, `beneficiaryCountry`

- [ ] **`/i129fApprovals`**: Used for I-129F data
  - Query: `where("formType", "==", "I-129F")`
  - Fields: `noa1Date`, `noa2Date`, `usEmbassy`

- [ ] **`/systemDailyStats/{YYYY-MM-DD}`**: Used for daily stats
  - Fields: `approvalsCount`, `approvalsCountYesterday`, `priorityDateMovement`

- [ ] **`/systemMonthlyStats/{YYYY-MM}`**: Used for monthly stats
  - Fields: `approvalsTotal`, `approvalsLastMonth`, `dailyAverage`, `bestDay`

- [ ] **`/rfeStats/{scopeId}`**: Used for RFE rates
  - Fields: `cohortSize`, `rfeCount`, `rfeRate`

- [ ] **`/calendarApprovals/{YYYY-MM}`**: Used for yearly aggregation
  - Fields: `days` (object with date keys)

### Query Filters
- [ ] **Date Ranges**: Match iOS (7D, 30D, 90D, 180 days)
- [ ] **Form Type Filters**: `formType == "I-130"` or `"I-129F"`
- [ ] **Time Zones**: Match iOS (UTC or local time)

---

## Calculation Verification

### Processing Time Calculations
- [ ] **I-130**: `approvalDate - priorityDate` (in days)
- [ ] **I-129F**: `noa2Date - noa1Date` (in days)
- [ ] **Average**: Sum of all processing days / count
- [ ] **Median**: Middle value of sorted array

### Trend Calculations
- [ ] **Last 7 Days Delta**: `((last7 - previous7) / previous7) * 100`
- [ ] **Trend Direction**: 
  - `increasing` if delta > 5%
  - `decreasing` if delta < -5%
  - `stable` otherwise

### Service Center Status
- [ ] **Improving**: Recent avg < older avg - 10 days
- [ ] **Delays**: Recent avg > older avg + 10 days
- [ ] **Steady**: Otherwise

### Monthly Comparison
- [ ] **Month Progress**: `currentDay / daysInMonth`
- [ ] **Projected Current**: `(currentMonth.approvalsTotal / currentDay) * daysInMonth`
- [ ] **Difference**: `projectedCurrent - (previousMonth.approvalsTotal * monthProgress)`

---

## UI/UX Verification

### Section Order
- [ ] **Matches iOS exactly**: A, B, C, D, E, F, G, H, I, J, K, L
- [ ] **No extra sections**: Only the 12 sections specified
- [ ] **No missing sections**: All sections present

### Responsive Design
- [ ] **Mobile**: Cards stack vertically, charts responsive
- [ ] **Tablet**: 2-column grid for cards
- [ ] **Desktop**: 3-4 column grid for cards

### Loading States
- [ ] **Shows loading**: While fetching data
- [ ] **Shows empty state**: When no data available
- [ ] **Shows error state**: On fetch errors (with fallback to stale cache)

### Charts
- [ ] **All charts render**: No broken charts
- [ ] **Colors match iOS**: Same color scheme
- [ ] **Tooltips work**: Show data on hover
- [ ] **Responsive**: Charts scale to container width

---

## Performance Verification

- [ ] **Build passes**: `npm run build` succeeds
- [ ] **No TypeScript errors**: All types correct
- [ ] **No linting errors**: Code passes ESLint
- [ ] **No console errors**: Check browser console
- [ ] **Data fetching**: Parallel where possible, cached appropriately

---

## Edge Cases

### No Data Available
- [ ] **Shows "Not available"**: Not mock/fake numbers
- [ ] **Empty states**: User-friendly messages
- [ ] **Graceful degradation**: App still works without data

### Insufficient Sample Size
- [ ] **Service Centers**: Minimum 3 approvals to show stats
- [ ] **RFE Stats**: Minimum 20 cohort size to show rates
- [ ] **Hides sections**: If data insufficient

### Missing Fields
- [ ] **Handles missing `serviceCenter`**: Skips or uses default
- [ ] **Handles missing dates**: Skips invalid records
- [ ] **Logs warnings**: For debugging

### Date Edge Cases
- [ ] **Timezone handling**: Matches iOS
- [ ] **Leap years**: Handled correctly
- [ ] **Month boundaries**: Correct date calculations

---

## Testing Steps

1. **Open iOS app** → Stats tab
2. **Open Web app** → `/stats` page
3. **Compare each section** side by side:
   - Check numbers match (if data available)
   - Check calculations match
   - Check charts render correctly
   - Check empty states match
4. **Test with different date ranges**: 7D, 30D, 90D
5. **Test with user profile**: Verify personalized sections show
6. **Test without user profile**: Verify sections still work
7. **Test with no data**: Verify empty states
8. **Test build**: `npm run build` should pass

---

## Known Limitations / TODOs

1. **Today's Update Card**: Currently shows empty state - needs real data aggregation from Firestore case statuses
2. **I-130 Pending**: Currently hardcoded - needs backend aggregation
3. **Immigration Backlog**: Currently hardcoded - may remain if no real source
4. **Processing Time Distribution**: Currently shows single range - needs full histogram implementation
5. **Calendar Approvals**: Yearly aggregation may need adjustment based on actual Firestore structure

---

## Notes

- iOS uses `SeededRandomGenerator` for some sections - these should be replaced with real Firestore data
- Some sections are premium-gated in iOS - web should match this behavior if applicable
- All date calculations should match iOS timezone handling
- Empty states should match iOS (show "Not available" not mock data)
