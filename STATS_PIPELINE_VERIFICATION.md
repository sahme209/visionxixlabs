# Stats Pipeline Verification Report

**Date:** 2026-01-15  
**Purpose:** Verify HIGH RISK items from checklist in production codebase  
**Method:** Code inspection only - no changes

---

## 1. Collections Actually Queried (Verified)

### Primary Collections Used in Stats

**`i130Approvals`** - VERIFIED
- **File:** `lib/statsService.ts`
- **Lines:** 263, 276, 476, 602, 635, 759, 847, 910, 1143, 1250
- **Query Pattern:** `where("formType", "==", "I-130")`
- **Used In:** All I-130 stats functions

**`i129fApprovals`** - VERIFIED
- **File:** `lib/statsService.ts`
- **Lines:** 369, 381, 392, 635, 759, 848, 910, 1143, 1250
- **Query Pattern:** `where("formType", "==", "I-129F")`
- **Used In:** All I-129F stats functions

**Component-Level Queries:**
- **`TodaysUpdateCard.tsx:71-72`** - Queries both collections (NO LIMIT)
- **`PeakApprovalDaysSection.tsx:27,36`** - Queries both (limit 250 each)
- **`ProcessingSpeedTrendSection.tsx:25,35`** - Queries both (limit 100 each)

### Collections NOT Used in Web Stats

**`dailyApproval`** - NOT QUERIED
- **Evidence:** No `collection(db, "dailyApproval")` found in stats pipeline
- **Used In:** iOS/Android only (`DailyApprovalCard.tsx:80` uses it, but that's a different component)
- **Risk:** If approvals are only in `dailyApproval`, they won't appear in web stats

**`systemDailyStats`, `systemMonthlyStats`** - READ-ONLY
- **Evidence:** Only read via `getDoc()`, never queried for raw approval data
- **Used In:** `TodaysUpdateSection.tsx` for pre-aggregated counts only

---

## 2. I-130 Skip Conditions (Verified)

### Skip Condition 1: Missing Approval Date
- **File:** `lib/statsService.ts:314-319`
- **Code:**
  ```typescript
  if (!approvalDate) {
    skippedCount++;
    console.warn(`[StatsService] Skipping doc ${doc.id}: No approvalDate or approvalDateText found`);
    return;
  }
  ```
- **Triggers When:**
  - `approvalDate` is null/undefined AND
  - `approvalDateText` is null/undefined
- **Detection:** Console warning with doc ID
- **Example Doc IDs That Would Skip:**
  - `doc_123` with `{ formType: "I-130", title: "Approval", body: "..." }` (no date fields)
  - `doc_456` with `{ formType: "I-130", serviceCenter: "Nebraska" }` (missing date)

### Skip Condition 2: Invalid Date
- **File:** `lib/statsService.ts:322-326`
- **Code:**
  ```typescript
  if (isNaN(approvalDate.getTime())) {
    skippedCount++;
    console.warn(`[StatsService] Invalid approval date for doc ${doc.id}:`, data.approvalDate || data.approvalDateText);
    return;
  }
  ```
- **Triggers When:**
  - Date parses but is invalid (e.g., `new Date("invalid")`, `new Date(null)`)
- **Detection:** Console warning with doc ID and date value
- **Example Doc IDs That Would Skip:**
  - `doc_789` with `{ formType: "I-130", approvalDateText: "invalid-date" }`
  - `doc_abc` with `{ formType: "I-130", approvalDate: null }` (after fallback fails)

### Skip Condition 3: Missing Service Center (Service Center Stats Only)
- **File:** `lib/statsService.ts:487`
- **Code:**
  ```typescript
  if (!serviceCenter) return;
  ```
- **Triggers When:** `serviceCenter` field is missing/null/undefined
- **Detection:** Silent skip (no logging)
- **Example Doc IDs That Would Skip:**
  - `doc_xyz` with `{ formType: "I-130", approvalDate: Timestamp, priorityDate: Timestamp }` (no serviceCenter)

### Skip Condition 4: Insufficient Samples (Service Center Stats Only)
- **File:** `lib/statsService.ts:507`
- **Code:**
  ```typescript
  if (approvals.length < 3) return; // Minimum 3 samples
  ```
- **Triggers When:** Service center has < 3 approval records
- **Detection:** Service center not included in results
- **Example:** Service center "Potomac" with only 2 approvals → excluded

### Skip Condition 5: No Processing Time (Service Center Stats Only)
- **File:** `lib/statsService.ts:518`
- **Code:**
  ```typescript
  if (processingDays.length === 0) return;
  ```
- **Triggers When:** All approvals have invalid processing time calculations
- **Detection:** Service center not included in results

### Skip Condition 6: No Status (Approval Odds Only)
- **File:** `lib/statsService.ts:971-973`
- **Code:**
  ```typescript
  // Skip cases without clear status (no approval, no RFE, likely still processing)
  return;
  ```
- **Triggers When:** No `approvalDate` AND no `rfe` field
- **Detection:** Silent skip (no logging)
- **Example Doc IDs That Would Skip:**
  - `doc_processing` with `{ formType: "I-130", priorityDate: Timestamp }` (no approval, no RFE)

### Body-Only Documents: VERIFIED IGNORED
- **File:** `lib/statsService.ts:296-331`
- **Evidence:** No parsing of `body` field found in stats pipeline
- **Code Path:** Documents with only `title`/`body`/`source` but no `approvalDate`/`approvalDateText` → Skip Condition 1
- **Example Doc IDs That Would Skip:**
  - `doc_body_only` with `{ title: "Spouse Visa Approval", body: "✔️ Italy 🇮🇹 ✔️ Approval Date: December 21, 2025", source: "discord_i130_daily" }`
  - `doc_text_only` with `{ formType: "I-130", body: "Approved on Dec 21, 2025" }` (no structured date fields)

---

## 3. I-129F Skip Conditions (Verified)

### Skip Condition 1: Missing noa2/noa2Date
- **File:** `lib/statsService.ts:429-431`
- **Code:**
  ```typescript
  if (!noa2Date || isNaN(noa2Date.getTime())) {
    return; // Only approved cases with valid dates
  }
  ```
- **Triggers When:**
  - Both `noa2Date` and `noa2` are null/undefined OR
  - Date is invalid
- **Detection:** **SILENT SKIP** (no logging - unlike I-130)
- **Example Doc IDs That Would Skip:**
  - `doc_i129f_1` with `{ formType: "I-129F", noa1: Timestamp }` (no noa2)
  - `doc_i129f_2` with `{ formType: "I-129F", noa2: null }` (explicit null)

### Skip Condition 2: Date Outside Range (Date-Based Queries Only)
- **File:** `lib/statsService.ts:433-441`
- **Code:**
  ```typescript
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  if (noa2Date < cutoffDate) {
    return; // Skip dates outside the range
  }
  ```
- **Triggers When:** `noa2Date` is older than `daysBack` days from today
- **Detection:** Silent skip (no logging)
- **Example:** Querying last 7 days, but `noa2Date` is 10 days ago → skipped
- **Note:** This filter is **ONLY in `getI129FApprovalDataByDate()`**, NOT in other functions

### Skip Condition 3: Missing Service Center (Most Active Centers Only)
- **File:** `lib/statsService.ts:871`
- **Code:**
  ```typescript
  if (serviceCenter && noa2 && !isNaN(noa2.getTime()) && noa2 >= cutoffDate) {
    centerCounts.set(serviceCenter, (centerCounts.get(serviceCenter) || 0) + 1);
  }
  ```
- **Triggers When:** `serviceCenter` is missing/null
- **Detection:** Silent skip (no logging)

### Skip Condition 4: Missing Start Date (Queue Position, Neighbor Comparison)
- **File:** `lib/statsService.ts:1156, 1272`
- **Code:**
  ```typescript
  // Queue Position (line 1156)
  pd = data.noa1?.toDate?.() || (data.noa1 ? new Date(data.noa1) : null);
  
  // Neighbor Comparison (line 1272)
  if (!startDate) return;
  ```
- **Triggers When:** `noa1`/`noa1Date` is missing/null
- **Detection:** Silent skip (no logging)

### Body-Only Documents: VERIFIED IGNORED
- **File:** `lib/statsService.ts:414-431`
- **Evidence:** No parsing of `body` field found
- **Code Path:** Documents with only `title`/`body` but no `noa2`/`noa2Date` → Skip Condition 1
- **Example Doc IDs That Would Skip:**
  - `doc_i129f_body` with `{ title: "K-1 Approval", body: "NOA2: January 6, 2026", formType: "I-129F" }` (no structured noa2 field)

---

## 4. Timezone/Day-Shift Behavior (Verified)

### UTC Grouping Method
- **File:** `lib/statsService.ts:328, 443`
- **Code:**
  ```typescript
  const dateString = approvalDate.toISOString().split("T")[0]; // YYYY-MM-DD
  ```
- **Result:** All dates grouped by UTC date string

### Local Time "Today" Calculation
- **File:** `lib/statsService.ts:334-335, 434-435`
- **Code:**
  ```typescript
  const today = new Date();
  today.setHours(0, 0, 0, 0);  // Local midnight
  ```
- **Issue:** Uses local timezone for "today", but groups by UTC

### Day-Shift Example (EST → UTC)
- **Scenario:** Approval at `2025-12-21T23:00:00-05:00` (11 PM EST, Dec 21)
- **UTC Conversion:** `2025-12-22T04:00:00Z` (4 AM UTC, Dec 22)
- **Grouped As:** `"2025-12-22"` (appears on Dec 22 in charts)
- **Impact:** Approvals after 7 PM EST appear on next day

### Range Filtering Mismatch (I-129F Only)
- **File:** `lib/statsService.ts:433-441`
- **Code:**
  ```typescript
  const today = new Date();  // Local time
  today.setHours(0, 0, 0, 0);
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  
  if (noa2Date < cutoffDate) {  // Comparing UTC date vs local cutoff
    return;
  }
  ```
- **Issue:** `cutoffDate` is local time, but `noa2Date` is UTC → boundary records may be incorrectly filtered

### Charts Affected by Timezone Issues
1. **Daily Approval Trends** - `lib/statsService.ts:256-355` (I-130), `361-467` (I-129F)
2. **Weekly Breakdown** - `lib/statsService.ts:674-705`
3. **Approval Trend Summary** - `lib/statsService.ts:710-749`
4. **Today's Update** - `components/stats/TodaysUpdateCard.tsx:54-68` (uses local time for period calculation)

---

## 5. Query Limits & Index Fallback Risks (Verified)

### Query Limits by Function

| Function | File | Line | Collection | Limit | Risk |
|----------|------|------|------------|-------|------|
| `getI130ApprovalDataByDate()` | `lib/statsService.ts` | 266, 278 | `i130Approvals` | 1000 | **HIGH** |
| `getI129FApprovalDataByDate()` | `lib/statsService.ts` | 372, 384, 394 | `i129fApprovals` | 2000 | **MEDIUM** |
| `getServiceCenterStats()` | `lib/statsService.ts` | 478 | `i130Approvals` | 1000 | **HIGH** |
| `getAverageProcessingTime()` | `lib/statsService.ts` | 635 | Both | 1000 | **HIGH** |
| `getProcessingTimeDistribution()` | `lib/statsService.ts` | 759 | Both | 1000 | **HIGH** |
| `getMostActiveCenters()` | `lib/statsService.ts` | 847-848 | Both | 1000 each | **MEDIUM** |
| `getApprovalOdds()` | `lib/statsService.ts` | 910 | Both | 2000 | **MEDIUM** |
| `getQueuePosition()` | `lib/statsService.ts` | 1143 | Both | 1000 | **HIGH** |
| `getNeighborComparison()` | `lib/statsService.ts` | 1250 | Both | 1000 | **HIGH** |
| `PeakApprovalDaysSection` | `components/stats/PeakApprovalDaysSection.tsx` | 27, 36 | Both | 250 each | **HIGH** |
| `ProcessingSpeedTrendSection` | `components/stats/ProcessingSpeedTrendSection.tsx` | 25, 35 | Both | 100 each | **HIGH** |
| `TodaysUpdateCard` | `components/stats/TodaysUpdateCard.tsx` | 71-72 | Both | **NO LIMIT** | **LOW** |

### Missing Index Fallback Behavior

**I-130 Fallback Chain:**
- **File:** `lib/statsService.ts:261-288`
- **Step 1:** Try `orderBy("approvalDate", "desc")` with index
- **Step 2:** If index error → Query without `orderBy`
- **Step 3:** If that fails → Return empty array
- **Risk:** Without ordering, results are **non-deterministic** - may get different records each time
- **Impact:** If limit is hit, may miss recent approvals (without ordering, Firestore returns arbitrary 1000 records)

**I-129F Fallback Chain:**
- **File:** `lib/statsService.ts:366-408`
- **Step 1:** Try `orderBy("noa2Date", "desc")` with index
- **Step 2:** If fails → Try `orderBy("noa2", "desc")` with index
- **Step 3:** If fails → Query without `orderBy`
- **Step 4:** If that fails → Return empty array
- **Risk:** Same as I-130 - non-deterministic results without ordering

**Component-Level Fallbacks:**
- **PeakApprovalDaysSection:** `components/stats/PeakApprovalDaysSection.tsx:27-31, 36-40`
  - Same fallback pattern (try with `orderBy`, fallback without)
  - **Limit:** Only 250 records (very low)
- **ProcessingSpeedTrendSection:** `components/stats/ProcessingSpeedTrendSection.tsx:25-30, 35-40`
  - Same fallback pattern
  - **Limit:** Only 100 records (very low)

### Detection of Index Failures
- **I-130:** Error logged at `lib/statsService.ts:282` if fallback also fails
- **I-129F:** Error logged at `lib/statsService.ts:398` if all attempts fail
- **Components:** No error logging - silently falls back

---

## 6. Failure Modes & Detection

### Failure Mode 1: Body-Only Documents Ignored
**Cause:** Documents with only `title`/`body`/`source` fields, no structured `approvalDate`/`noa2Date`  
**Impact:** These approvals never appear in any stats  
**Detection:**
- **Query:** `db.collection("i130Approvals").where("formType", "==", "I-130").where("approvalDate", "==", null).where("approvalDateText", "==", null).get()`
- **Logs:** I-130 logs warnings at `lib/statsService.ts:317` (but only if doc passes query filter)
- **Pattern:** Documents with `body` field but no `approvalDate`/`approvalDateText`
- **Example Doc IDs:** `doc_body_only_1`, `doc_text_approval_123`

### Failure Mode 2: Query Limits Exclude Older Data
**Cause:** Functions limited to 1000-2000 records, older approvals excluded  
**Impact:** Historical trends incomplete, older service centers missing  
**Detection:**
- **Query:** Count total docs: `db.collection("i130Approvals").where("formType", "==", "I-130").count().get()`
- **Compare:** If count > limit, older records excluded
- **Logs:** No direct logging, but can compare `snapshot.docs.length` vs total count
- **Pattern:** Functions return fewer records than exist in collection
- **Example:** If 5000 I-130 approvals exist, only 1000 included in stats

### Failure Mode 3: Missing Indexes Cause Non-Deterministic Results
**Cause:** Firestore index missing → fallback query without `orderBy`  
**Impact:** Different results each query, may miss recent approvals  
**Detection:**
- **Logs:** Error at `lib/statsService.ts:282` (I-130) or `398` (I-129F) if all attempts fail
- **Pattern:** Query succeeds but results vary between calls
- **Firestore Console:** Check for "index required" errors
- **Example:** Same query returns different 1000 records each time

### Failure Mode 4: Timezone Day-Shift (EST → UTC)
**Cause:** Approvals after 7 PM EST grouped into next UTC day  
**Impact:** Approvals appear on wrong day in charts  
**Detection:**
- **Query:** `db.collection("i130Approvals").where("approvalDate", ">=", Timestamp).where("approvalDate", "<", Timestamp).get()`
- **Compare:** Local date range vs UTC date range
- **Pattern:** Approvals with timestamps 19:00-23:59 EST appear on next day
- **Example:** Approval at `2025-12-21T23:00:00-05:00` appears as `2025-12-22` in chart

### Failure Mode 5: I-129F Records Skipped Silently
**Cause:** Missing `noa2`/`noa2Date` or invalid date  
**Impact:** I-129F approvals missing from stats, no visibility  
**Detection:**
- **Query:** `db.collection("i129fApprovals").where("formType", "==", "I-129F").where("noa2", "==", null).where("noa2Date", "==", null).get()`
- **Logs:** **NONE** - skipped silently (unlike I-130 which logs warnings)
- **Pattern:** Documents with `formType="I-129F"` but no `noa2`/`noa2Date`
- **Example Doc IDs:** `doc_i129f_no_noa2_1`, `doc_k1_missing_date_456`

### Failure Mode 6: Range Filtering Mismatch (I-129F)
**Cause:** `cutoffDate` uses local time, but `noa2Date` is UTC  
**Impact:** Boundary records incorrectly excluded/included  
**Detection:**
- **Query:** Check records near cutoff date
- **Pattern:** Records with UTC dates just before/after local cutoff may be incorrectly filtered
- **Example:** Querying last 7 days, but record with UTC date 8 days ago (7 days ago local) excluded

### Failure Mode 7: Very Low Limits in Components
**Cause:** `PeakApprovalDaysSection` (250) and `ProcessingSpeedTrendSection` (100) use very low limits  
**Impact:** These charts show incomplete data  
**Detection:**
- **Logs:** No logging of limit vs total
- **Pattern:** Charts show fewer approvals than exist
- **Example:** 500 recent approvals exist, but chart only shows 250

### Failure Mode 8: Missing Service Center Excludes Records
**Cause:** `serviceCenter` field missing/null  
**Impact:** Records excluded from service center stats  
**Detection:**
- **Query:** `db.collection("i130Approvals").where("formType", "==", "I-130").where("serviceCenter", "==", null).get()`
- **Logs:** Silent skip at `lib/statsService.ts:487`
- **Pattern:** Records with valid approval but no service center
- **Example Doc IDs:** `doc_no_service_center_1`, `doc_missing_sc_789`

### Failure Mode 9: Insufficient Samples Excludes Service Centers
**Cause:** Service center has < 3 approval records  
**Impact:** Service center not shown in stats  
**Detection:**
- **Query:** Group by `serviceCenter`, count records per center
- **Pattern:** Centers with 1-2 approvals not in results
- **Example:** "Potomac" service center with 2 approvals → excluded

### Failure Mode 10: No Status Skips Records (Approval Odds)
**Cause:** No `approvalDate`/`noa2` AND no `rfe` field  
**Impact:** Records excluded from approval odds calculation  
**Detection:**
- **Query:** `db.collection("i130Approvals").where("formType", "==", "I-130").where("approvalDate", "==", null).where("rfe", "==", null).get()`
- **Logs:** Silent skip at `lib/statsService.ts:972`
- **Pattern:** Processing cases (no approval, no RFE) excluded
- **Example Doc IDs:** `doc_processing_only_1`, `doc_no_status_abc`

---

## 7. Example Doc IDs That Would Skip (Code Reasoning Only)

### I-130 Skip Examples

**Missing Approval Date:**
- `doc_i130_no_date_001` - `{ formType: "I-130", title: "Approval", body: "Approved Dec 21", serviceCenter: "Nebraska" }`
- `doc_i130_text_only_002` - `{ formType: "I-130", body: "✔️ Italy 🇮🇹 ✔️ Approval Date: December 21, 2025", source: "discord_i130_daily" }`
- `doc_i130_missing_fields_003` - `{ formType: "I-130", priorityDate: Timestamp }` (no approvalDate, no approvalDateText)

**Invalid Date:**
- `doc_i130_invalid_date_004` - `{ formType: "I-130", approvalDateText: "invalid-date-string" }`
- `doc_i130_null_date_005` - `{ formType: "I-130", approvalDate: null, approvalDateText: null }`
- `doc_i130_bad_format_006` - `{ formType: "I-130", approvalDateText: "12/21/2025" }` (may parse incorrectly)

**Missing Service Center (Service Center Stats Only):**
- `doc_i130_no_sc_007` - `{ formType: "I-130", approvalDate: Timestamp, priorityDate: Timestamp }` (no serviceCenter)
- `doc_i130_null_sc_008` - `{ formType: "I-130", approvalDate: Timestamp, serviceCenter: null }`

**No Status (Approval Odds Only):**
- `doc_i130_processing_009` - `{ formType: "I-130", priorityDate: Timestamp }` (no approvalDate, no rfe)
- `doc_i130_no_status_010` - `{ formType: "I-130", priorityDate: Timestamp, beneficiaryCountry: "Italy" }` (processing case)

### I-129F Skip Examples

**Missing noa2/noa2Date:**
- `doc_i129f_no_noa2_001` - `{ formType: "I-129F", noa1: Timestamp, serviceCenter: "CSC" }` (no noa2)
- `doc_i129f_text_only_002` - `{ formType: "I-129F", body: "NOA2: January 6, 2026", title: "K-1 Approval" }` (no structured noa2)
- `doc_i129f_null_noa2_003` - `{ formType: "I-129F", noa1: Timestamp, noa2: null, noa2Date: null }`

**Invalid Date:**
- `doc_i129f_invalid_noa2_004` - `{ formType: "I-129F", noa2: "invalid-timestamp" }`
- `doc_i129f_bad_date_005` - `{ formType: "I-129F", noa2Date: null, noa2: "not-a-date" }`

**Date Outside Range (Date Queries Only):**
- `doc_i129f_old_approval_006` - `{ formType: "I-129F", noa2: Timestamp(10 days ago) }` (querying last 7 days)
- `doc_i129f_out_of_range_007` - `{ formType: "I-129F", noa2Date: Timestamp(200 days ago) }` (querying last 180 days, but cutoff is 180 days from local today, may exclude)

**Missing Start Date (Queue/Neighbor Functions):**
- `doc_i129f_no_noa1_008` - `{ formType: "I-129F", noa2: Timestamp }` (no noa1 for queue position)
- `doc_i129f_missing_start_009` - `{ formType: "I-129F", serviceCenter: "CSC" }` (no noa1, no noa2)

**Missing Service Center (Most Active Centers):**
- `doc_i129f_no_sc_010` - `{ formType: "I-129F", noa2: Timestamp }` (no serviceCenter)

---

## Summary

### Verified HIGH RISK Items

1. ✅ **Body-Only Documents Ignored** - CONFIRMED (no parsing logic exists)
2. ✅ **Query Limits Exclude Data** - CONFIRMED (100-2000 limits across functions)
3. ✅ **Missing Indexes Cause Non-Deterministic Results** - CONFIRMED (fallback without orderBy)
4. ✅ **I-129F Records Skipped Silently** - CONFIRMED (no logging, unlike I-130)
5. ✅ **Timezone Day-Shift** - CONFIRMED (UTC grouping vs local "today")
6. ✅ **Range Filtering Mismatch** - CONFIRMED (I-129F only, local cutoff vs UTC dates)
7. ✅ **Very Low Limits in Components** - CONFIRMED (100-250 records)

### Collections Actually Queried

- ✅ `i130Approvals` - VERIFIED (10+ query locations)
- ✅ `i129fApprovals` - VERIFIED (9+ query locations)
- ❌ `dailyApproval` - NOT QUERIED in stats pipeline (iOS/Android only)

### Skip Conditions Verified

**I-130:** 6 skip conditions identified with file/line references  
**I-129F:** 5 skip conditions identified (4 silent, 1 with range filter)

---

**End of Verification Report**
