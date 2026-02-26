# Stats Data Pipeline Risk Checklist

**Date:** 2026-01-15  
**Purpose:** Identify reasons records could be missing or miscounted in stats

---

## Collections Actually Queried

### Primary Collections (Used in Charts)
1. **`i130Approvals`** - I-130 approval records
   - Used in: All I-130 charts, trends, service center stats
   - Query pattern: `where("formType", "==", "I-130")`

2. **`i129fApprovals`** - I-129F approval records
   - Used in: All I-129F charts, trends
   - Query pattern: `where("formType", "==", "I-129F")`

### Aggregated Collections (Read-Only, Not Queried for Raw Data)
- `systemDailyStats` - Pre-aggregated daily stats (keyed by date)
- `systemMonthlyStats` - Pre-aggregated monthly stats (keyed by month)
- `calendarApprovals` - Pre-aggregated calendar data
- **Note:** These are NOT queried for raw approval data - only used for "Today's Update" card

### Collections NOT Used in Web Stats
- **`dailyApproval`** - Used in iOS/Android but NOT queried in web stats pipeline
  - **Risk:** If approvals are only in `dailyApproval` collection, they won't appear in web stats

---

## I-130 Record Requirements & Skip Conditions

### Required Fields
1. **`formType`** - MUST equal `"I-130"` (enforced in query `where` clause)
   - **Location:** `lib/statsService.ts:264`
   - **Skip if:** `formType !== "I-130"` → Document excluded from query results

2. **`approvalDate` OR `approvalDateText`** - At least one MUST exist
   - **Location:** `lib/statsService.ts:296-319`
   - **Priority:**
     1. `approvalDate.toDate()` (Firestore Timestamp)
     2. `approvalDate.seconds` → `new Date(seconds * 1000)`
     3. `new Date(approvalDate)` (direct conversion)
     4. `new Date(approvalDateText)` (text fallback)
   - **Skip if:** All fail → Document skipped with warning
   - **Log:** `[StatsService] Skipping doc ${doc.id}: No approvalDate or approvalDateText found`

3. **Valid Date** - Date must parse correctly
   - **Location:** `lib/statsService.ts:322-326`
   - **Skip if:** `isNaN(approvalDate.getTime())` → Document skipped
   - **Log:** `[StatsService] Invalid approval date for doc ${doc.id}`

### Body-Only Documents (NOT PARSED)
- **Location:** `lib/statsService.ts:296-331`
- **Skip if:** Document only has `title`, `body`, `source` fields without structured `approvalDate`/`approvalDateText`
- **Example:** `{ title: "Spouse Visa Approval", body: "✔️ Italy 🇮🇹 ✔️ Approval Date: December 21, 2025", source: "discord_i130_daily" }`
- **Risk:** These records are **completely ignored** - no text parsing logic exists
- **Impact:** High - if approvals are added as text-only, they won't appear in any stats

### Charts That Depend on I-130 Data

| Chart/Function | File | Line | Required Fields | Skip Conditions |
|---------------|------|------|----------------|-----------------|
| Daily Approval Trends | `lib/statsService.ts` | 256-355 | `formType="I-130"`, `approvalDate` or `approvalDateText` | Missing/invalid date |
| Weekly Breakdown | `lib/statsService.ts` | 674-705 | Calls `getI130ApprovalDataByDate(7)` | Same as above |
| Approval Trend Summary | `lib/statsService.ts` | 710-749 | Calls `getI130ApprovalDataByDate(daysBack)` | Same as above |
| Service Center Stats | `lib/statsService.ts` | 473-590 | `formType="I-130"`, `serviceCenter`, `priorityDate`, `approvalDate` | Missing `serviceCenter` (line 487), < 3 samples (line 507) |
| Most Active Centers | `lib/statsService.ts` | 843-894 | `formType="I-130"`, `serviceCenter`, `approvalDate` | Missing `serviceCenter` or invalid date |
| Processing Time Distribution | `lib/statsService.ts` | 754-823 | `formType="I-130"`, `priorityDate`, `approvalDate` | Invalid dates, days <= 0 |
| Approval Odds | `lib/statsService.ts` | 902-1069 | `formType="I-130"`, `priorityDate`, `approvalDate` or `rfe` | Missing start date, no status (line 972) |
| Queue Position | `lib/statsService.ts` | 1136-1237 | `formType="I-130"`, `priorityDate` or `priorityDateText` | Missing/invalid priority date (line 1167) |
| Neighbor Comparison | `lib/statsService.ts` | 1242-1322 | `formType="I-130"`, `priorityDate` | Missing start date (line 1272), invalid date (line 1275) |
| Today's Update | `components/stats/TodaysUpdateCard.tsx` | 71-120 | `formType="I-130"`, `approvalDate` or `createdAt` | Uses `createdAt` as fallback for "Received" status |
| Peak Approval Days | `components/stats/PeakApprovalDaysSection.tsx` | 27-31 | `formType="I-130"`, `approvalDate` | Missing/invalid date |
| Processing Speed Trend | `components/stats/ProcessingSpeedTrendSection.tsx` | 25-30 | `formType="I-130"`, `approvalDate`, `priorityDate` | Missing dates, invalid processing time |

---

## I-129F Record Requirements & Skip Conditions

### Required Fields
1. **`formType`** - MUST equal `"I-129F"` (enforced in query `where` clause)
   - **Location:** `lib/statsService.ts:370`
   - **Skip if:** `formType !== "I-129F"` → Document excluded from query results

2. **`noa2Date` OR `noa2`** - At least one MUST exist
   - **Location:** `lib/statsService.ts:414-431`
   - **Priority:**
     1. `noa2Date.toDate()` or `noa2.toDate()` (Firestore Timestamp)
     2. `noa2Field.seconds` → `new Date(seconds * 1000)`
     3. `new Date(noa2Field)` (direct conversion)
   - **Skip if:** All fail → Document skipped (silently, no log)
   - **Note:** No `approvalDateText`-style fallback for I-129F

3. **Valid Date** - Date must parse correctly
   - **Location:** `lib/statsService.ts:429-431`
   - **Skip if:** `isNaN(noa2Date.getTime())` → Document skipped

4. **Date Within Range** - For `getI129FApprovalDataByDate()`
   - **Location:** `lib/statsService.ts:433-441`
   - **Skip if:** `noa2Date < cutoffDate` (older than `daysBack` days) → Document skipped
   - **Note:** This is an additional filter not present in I-130 function

### Documents Skipped Due to Missing noa2/noa2Date
- **Location:** `lib/statsService.ts:429-431`
- **Skip if:** Both `noa2Date` and `noa2` are missing/null
- **Skip if:** Date is invalid (`isNaN(noa2Date.getTime())`)
- **Skip if:** Date is outside requested range (for date-based queries)
- **Logging:** **NONE** - skipped silently (unlike I-130 which logs warnings)
- **Impact:** Medium - no visibility into how many I-129F records are skipped

### Charts That Depend on I-129F Data

| Chart/Function | File | Line | Required Fields | Skip Conditions |
|---------------|------|------|----------------|-----------------|
| Daily Approval Trends | `lib/statsService.ts` | 361-467 | `formType="I-129F"`, `noa2Date` or `noa2` | Missing/invalid date, outside range |
| Weekly Breakdown | `lib/statsService.ts` | 674-705 | Calls `getI129FApprovalDataByDate(7)` | Same as above |
| Approval Trend Summary | `lib/statsService.ts` | 710-749 | Calls `getI129FApprovalDataByDate(daysBack)` | Same as above |
| Most Active Centers | `lib/statsService.ts` | 843-894 | `formType="I-129F"`, `serviceCenter`, `noa2` | Missing `serviceCenter` or invalid date |
| Processing Time Distribution | `lib/statsService.ts` | 754-823 | `formType="I-129F"`, `noa1`/`noa1Date`, `noa2`/`noa2Date` | Invalid dates, days <= 0 |
| Approval Odds | `lib/statsService.ts` | 902-1069 | `formType="I-129F"`, `noa1`, `noa2` or `rfe` | Missing start date, no status |
| Queue Position | `lib/statsService.ts` | 1136-1237 | `formType="I-129F"`, `noa1` or `noa1Date` | Missing/invalid noa1 date |
| Neighbor Comparison | `lib/statsService.ts` | 1242-1322 | `formType="I-129F"`, `noa1` | Missing start date, invalid date |
| Today's Update | `components/stats/TodaysUpdateCard.tsx` | 123-151 | `formType="I-129F"`, `noa2` or `createdAt` | Uses `createdAt` as fallback |
| Peak Approval Days | `components/stats/PeakApprovalDaysSection.tsx` | 36-40 | `formType="I-129F"`, `noa2` | Missing/invalid date |
| Processing Speed Trend | `components/stats/ProcessingSpeedTrendSection.tsx` | 35-40 | `formType="I-129F"`, `noa1`, `noa2` | Missing dates, invalid processing time |

---

## Date Grouping & Timezone Issues

### Date Grouping Method
- **Location:** `lib/statsService.ts:328`, `lib/statsService.ts:443`
- **Method:** `approvalDate.toISOString().split("T")[0]` → `"YYYY-MM-DD"` (UTC)
- **Result:** All approvals are grouped by UTC date, not local time

### Timezone Mismatch Issues

**Problem 1: "Today" Calculation Uses Local Time**
- **Location:** `lib/statsService.ts:334-335`, `lib/statsService.ts:434-435`
- **Code:** `const today = new Date(); today.setHours(0, 0, 0, 0);` (local midnight)
- **Issue:** Creates date range using local time, but groups by UTC

**Problem 2: Day-Shift for EST/EDT Users**
- **Scenario:** Approval at `2025-12-21T23:00:00-05:00` (EST, 11 PM local)
- **UTC Conversion:** `2025-12-22T04:00:00Z` (next day in UTC)
- **Grouped As:** `2025-12-22` (appears on wrong day)
- **Impact:** Approvals late in day (EST) appear on next day in charts

**Problem 3: Range Filtering Mismatch**
- **Location:** `lib/statsService.ts:433-441` (I-129F only)
- **Code:** `cutoffDate` calculated from local `today`, compared against UTC dates
- **Issue:** May exclude/include records on boundary days incorrectly

**Example:**
```typescript
// User in EST (UTC-5) queries last 7 days on Dec 21
const today = new Date(); // Dec 21, 2025 00:00:00 EST
today.setHours(0, 0, 0, 0);
const cutoffDate = new Date(today);
cutoffDate.setDate(cutoffDate.getDate() - 7); // Dec 14, 2025 00:00:00 EST

// But approval dates are UTC:
// Approval: 2025-12-14T05:00:00Z (Dec 14, 12:00 AM EST = Dec 14, 5:00 AM UTC)
// cutoffDate comparison: Uses local time vs UTC → may incorrectly filter
```

**Charts Affected:**
- All date-based charts (daily trends, weekly breakdown, approval trends)
- "Today's Update" card (uses local time for period calculation)

---

## Query Limit & Index Fallback Risks

### Query Limits by Function

| Function | Collection | Limit | File | Line | Risk Level |
|----------|-----------|-------|------|------|------------|
| `getI130ApprovalDataByDate()` | `i130Approvals` | 1000 | `lib/statsService.ts` | 266 | **HIGH** - May exclude older approvals |
| `getI129FApprovalDataByDate()` | `i129fApprovals` | 2000 | `lib/statsService.ts` | 372 | **MEDIUM** - Higher limit, but still capped |
| `getServiceCenterStats()` | `i130Approvals` | 1000 | `lib/statsService.ts` | 478 | **HIGH** - May miss service centers |
| `getAverageProcessingTime()` | Both | 1000 | `lib/statsService.ts` | 635 | **HIGH** - May exclude older data |
| `getProcessingTimeDistribution()` | Both | 1000 | `lib/statsService.ts` | 759 | **HIGH** - May miss distribution patterns |
| `getMostActiveCenters()` | Both | 1000 each | `lib/statsService.ts` | 847-848 | **MEDIUM** - Recent data only |
| `getApprovalOdds()` | Both | 2000 | `lib/statsService.ts` | 910 | **MEDIUM** - Higher limit |
| `getQueuePosition()` | Both | 1000 | `lib/statsService.ts` | 1143 | **HIGH** - May miss cases in queue |
| `getNeighborComparison()` | Both | 1000 | `lib/statsService.ts` | 1250 | **HIGH** - May miss neighbors |
| `TodaysUpdateCard` | Both | **NO LIMIT** | `components/stats/TodaysUpdateCard.tsx` | 71-72 | **LOW** - Gets all records (may be slow) |
| `PeakApprovalDaysSection` | Both | 250 each | `components/stats/PeakApprovalDaysSection.tsx` | 27, 36 | **HIGH** - Very low limit |
| `ProcessingSpeedTrendSection` | Both | 100 each | `components/stats/ProcessingSpeedTrendSection.tsx` | 25, 35 | **HIGH** - Very low limit |

### Missing Index Fallback Risks

**I-130 Queries:**
- **Location:** `lib/statsService.ts:261-288`
- **Fallback Chain:**
  1. Try: `orderBy("approvalDate", "desc")` with index
  2. If fails: Query without `orderBy`
- **Risk:** Without ordering, results are **non-deterministic**
- **Impact:** Different results on each query, may miss recent approvals if limit is hit

**I-129F Queries:**
- **Location:** `lib/statsService.ts:366-408`
- **Fallback Chain:**
  1. Try: `orderBy("noa2Date", "desc")` with index
  2. If fails: Try `orderBy("noa2", "desc")` with index
  3. If fails: Query without `orderBy`
- **Risk:** Same as I-130 - non-deterministic results without ordering
- **Impact:** May get different records each time, older records may be excluded

**Component-Level Fallbacks:**
- **PeakApprovalDaysSection:** `components/stats/PeakApprovalDaysSection.tsx:27-31, 36-40`
- **ProcessingSpeedTrendSection:** `components/stats/ProcessingSpeedTrendSection.tsx:25-30, 35-40`
- **Risk:** Each component has its own fallback logic, may behave differently

### Risk Summary

**HIGH RISK:**
1. Query limits (1000-2000) may exclude older/historical data
2. Missing indexes cause non-deterministic results
3. Body-only documents completely ignored (no parsing)
4. I-129F records skipped silently (no logging)

**MEDIUM RISK:**
1. Timezone mismatch (EST → UTC day shift)
2. Range filtering uses local time vs UTC dates
3. Different limits across functions (inconsistent data)

**LOW RISK:**
1. Field name variations handled (noa2 vs noa2Date)
2. Text fallbacks exist for I-130 (approvalDateText)

---

## Exact Field Dependencies by Chart

### Daily Approval Activity This Week
- **Function:** `getWeeklyApprovalBreakdown()`
- **File:** `lib/statsService.ts:674-705`
- **Dependencies:**
  - I-130: `formType="I-130"`, `approvalDate` or `approvalDateText`
  - I-129F: `formType="I-129F"`, `noa2Date` or `noa2`
- **Skip Conditions:**
  - Missing approval date
  - Invalid date
  - (I-129F only) Date outside 7-day range

### I-130 Approval Trend Over Time
- **Function:** `getI130ApprovalDataByDate(daysBack)`
- **File:** `lib/statsService.ts:256-355`
- **Dependencies:** `formType="I-130"`, `approvalDate` or `approvalDateText`
- **Skip Conditions:**
  - Missing/invalid approval date
  - Query limit exceeded (1000 records)

### I-129F Approval Trend Over Time
- **Function:** `getI129FApprovalDataByDate(daysBack)`
- **File:** `lib/statsService.ts:361-467`
- **Dependencies:** `formType="I-129F"`, `noa2Date` or `noa2`
- **Skip Conditions:**
  - Missing/invalid noa2 date
  - Date outside requested range
  - Query limit exceeded (2000 records)

### Today's Update Card
- **Function:** `calculateRealStatusBreakdown()` in component
- **File:** `components/stats/TodaysUpdateCard.tsx:50-189`
- **Dependencies:**
  - I-130: `formType="I-130"`, `approvalDate` or `createdAt`, `rfe`, `notes`
  - I-129F: `formType="I-129F"`, `noa2` or `createdAt`, `rfe`, `interview`, `medical`
- **Skip Conditions:**
  - Uses `createdAt` as fallback, so fewer skips than other charts
  - Still requires valid date parsing

### Service Center Stats
- **Function:** `getServiceCenterStats()`
- **File:** `lib/statsService.ts:473-590`
- **Dependencies:** `formType="I-130"`, `serviceCenter`, `priorityDate`, `approvalDate`
- **Skip Conditions:**
  - Missing `serviceCenter` (line 487)
  - < 3 samples per center (line 507)
  - Invalid processing time calculation (line 518)
  - Query limit exceeded (1000 records)

### Most Active Centers
- **Function:** `getMostActiveCenters(days)`
- **File:** `lib/statsService.ts:843-894`
- **Dependencies:**
  - I-130: `formType="I-130"`, `serviceCenter`, `approvalDate`
  - I-129F: `formType="I-129F"`, `serviceCenter`, `noa2`
- **Skip Conditions:**
  - Missing `serviceCenter`
  - Invalid/outside-range approval date
  - Query limit exceeded (1000 each)

### Your Odds
- **Function:** `getApprovalOdds()`
- **File:** `lib/statsService.ts:902-1069`
- **Dependencies:**
  - I-130: `formType="I-130"`, `priorityDate`, `approvalDate` or `rfe`, `serviceCenter`, `beneficiaryCountry`
  - I-129F: `formType="I-129F"`, `noa1`, `noa2` or `rfe`, `serviceCenter`, `beneficiaryCountry`
- **Skip Conditions:**
  - Missing start date (priorityDate/noa1)
  - No status (no approval, no RFE) → skipped (line 972)
  - Case age filter mismatch (> ±60 days)
  - Query limit exceeded (2000 records)

### Your Position (Queue Position)
- **Function:** `getQueuePosition()`
- **File:** `lib/statsService.ts:1136-1237`
- **Dependencies:**
  - I-130: `formType="I-130"`, `priorityDate` or `priorityDateText`
  - I-129F: `formType="I-129F"`, `noa1` or `noa1Date`
- **Skip Conditions:**
  - Missing/invalid priority date (line 1167)
  - Outside cohort window (±90 days)
  - Query limit exceeded (1000 records)

### Your Neighbors
- **Function:** `getNeighborComparison()`
- **File:** `lib/statsService.ts:1242-1322`
- **Dependencies:**
  - I-130: `formType="I-130"`, `priorityDate`, `approvalDate` or `rfe`
  - I-129F: `formType="I-129F"`, `noa1`, `noa2` or `rfe`
- **Skip Conditions:**
  - Missing start date (line 1272)
  - Invalid date (line 1275)
  - Outside neighbor window (±60 days)
  - Query limit exceeded (1000 records)

---

## Summary Checklist

### ✅ What Could Break

1. **Body-Only Documents Ignored**
   - Records with only `title`/`body`/`source` (no structured fields) are skipped
   - **Fix Needed:** Add text parsing logic or require structured fields

2. **Query Limits Exclude Data**
   - Limits of 100-2000 records may exclude older/historical data
   - **Fix Needed:** Increase limits or implement pagination

3. **Missing Indexes Cause Non-Deterministic Results**
   - Fallback queries without `orderBy` return random results
   - **Fix Needed:** Create Firestore composite indexes

4. **Timezone Mismatch (EST → UTC Day Shift)**
   - Approvals late in day (EST) appear on next day in charts
   - **Fix Needed:** Use consistent timezone (prefer UTC) for all date operations

5. **I-129F Records Skipped Silently**
   - No logging when I-129F records are skipped (unlike I-130)
   - **Fix Needed:** Add logging similar to I-130

6. **Range Filtering Uses Local Time vs UTC**
   - I-129F date range filtering may incorrectly exclude/include boundary records
   - **Fix Needed:** Use UTC for all date comparisons

7. **Very Low Limits in Some Components**
   - `PeakApprovalDaysSection`: 250 records
   - `ProcessingSpeedTrendSection`: 100 records
   - **Fix Needed:** Increase limits or use shared service functions

8. **Missing Field Fallbacks Inconsistent**
   - I-130 has `approvalDateText` fallback, I-129F has no text fallback
   - **Fix Needed:** Standardize fallback logic

9. **Status Determination May Skip Valid Cases**
   - Cases without `approvalDate`/`noa2` and without `rfe` are skipped in some functions
   - **Fix Needed:** Consider "processing" status instead of skipping

10. **No Validation of Required Fields Before Processing**
    - Documents processed even if required fields are missing, then skipped later
    - **Fix Needed:** Validate early and log clearly

---

**End of Risk Checklist**
