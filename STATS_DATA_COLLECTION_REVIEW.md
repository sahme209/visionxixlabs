# Stats Data Collection & Aggregation Review

**Date:** 2026-01-15  
**Scope:** Inspection only - no code changes  
**Purpose:** Document how stats pages collect and aggregate I-130 and I-129F approval data

---

## 1. Firestore Collections & Queries

### Primary Collections Used

#### I-130 Approvals
- **Collection:** `i130Approvals`
- **Query Pattern:**
  ```typescript
  query(
    collection(db, "i130Approvals"),
    where("formType", "==", "I-130"),
    orderBy("approvalDate", "desc"),  // Optional - falls back if index missing
    limit(1000)  // Most queries use 1000, some use 2000
  )
  ```
- **Fallback Behavior:** If `orderBy("approvalDate")` fails due to missing index, retries without `orderBy`

#### I-129F Approvals
- **Collection:** `i129fApprovals`
- **Query Pattern:**
  ```typescript
  query(
    collection(db, "i129fApprovals"),
    where("formType", "==", "I-129F"),
    orderBy("noa2Date", "desc"),  // Preferred
    limit(2000)  // Higher limit than I-130
  )
  ```
- **Fallback Chain:**
  1. Try `orderBy("noa2Date", "desc")`
  2. If index error → try `orderBy("noa2", "desc")`
  3. If still fails → query without `orderBy`

#### Aggregated Stats Collections (Read-Only)
- `systemDailyStats` - Daily aggregated stats (keyed by date string "YYYY-MM-DD")
- `systemMonthlyStats` - Monthly aggregated stats (keyed by "YYYY-MM")
- `systemCoverage` - Coverage ratios per scope
- `trends` - Trend data per scope
- `pdStats` - Priority date statistics per scope
- `rfeStats` - RFE statistics per scope
- `calendarApprovals` - Calendar-based approval data

---

## 2. Field Usage & Authoritative Sources

### I-130 Approval Date Fields

**Primary Field (Authoritative):**
- `approvalDate` (Firestore Timestamp) - **PRIMARY SOURCE**
  - Parsed via: `data.approvalDate?.toDate()`
  - Fallback: `data.approvalDate?.seconds` → `new Date(seconds * 1000)`
  - Fallback: `new Date(data.approvalDate)` if raw value exists

**Fallback Field:**
- `approvalDateText` (string, format: YYYY-MM-DD) - **SECONDARY SOURCE**
  - Only used if `approvalDate` is missing/null
  - Parsed via: `new Date(data.approvalDateText)`

**Processing Logic:**
```typescript
// Priority order:
1. approvalDate.toDate()           // Firestore Timestamp
2. approvalDate.seconds            // Timestamp seconds
3. new Date(approvalDate)           // Direct date conversion
4. new Date(approvalDateText)       // Text fallback
```

**Skip Conditions:**
- If no `approvalDate` AND no `approvalDateText` → document skipped
- If date is invalid (`isNaN(date.getTime())`) → document skipped

### I-129F Approval Date Fields

**Primary Fields (Authoritative):**
- `noa2Date` (Firestore Timestamp) - **PREFERRED**
- `noa2` (Firestore Timestamp) - **FALLBACK** (same field, different name)

**Processing Logic:**
```typescript
const noa2Field = data.noa2Date || data.noa2;  // Try both field names
// Then parse same as I-130:
1. noa2Field.toDate()
2. noa2Field.seconds → new Date(seconds * 1000)
3. new Date(noa2Field)
```

**Skip Conditions:**
- If no `noa2Date` AND no `noa2` → document skipped
- If date is invalid → document skipped
- If date is outside requested range (older than `daysBack`) → document skipped

### Priority Date Fields

**I-130:**
- `priorityDate` (Firestore Timestamp) - **PRIMARY**
- `priorityDateText` (string) - **FALLBACK** (only used if `priorityDate` missing)

**I-129F:**
- `noa1` (Firestore Timestamp) - **PRIMARY** (equivalent to priority date for I-129F)
- `noa1Date` (Firestore Timestamp) - **ALIAS** (same field, different name)

**Processing Logic:**
```typescript
// I-130:
priorityDate?.toDate() || new Date(priorityDate) || new Date(priorityDateText)

// I-129F:
noa1?.toDate() || new Date(noa1) || noa1Date?.toDate() || new Date(noa1Date)
```

### Other Critical Fields

**Required for Filtering:**
- `formType` - Must be "I-130" or "I-129F" (used in `where` clause)
- `serviceCenter` - Used for service center breakdowns (optional)
- `beneficiaryCountry` - Used for country breakdowns (optional)
- `category` - Used for I-129F categorization (e.g., "K1") (optional)

**Status Determination:**
- `rfe` - If present (not null/undefined) → status = "rfe"
- `approvalDate` (I-130) or `noa2`/`noa2Date` (I-129F) → status = "approved"
- Neither present → status = "processing" (or skipped in some functions)

**Metadata:**
- `createdAt` - Used in "Today's Update" for determining when record was added (not for approval date)
- `notes` - Used for parsing status keywords ("transferred", "interview", "biometric", etc.)

---

## 3. Grouping Logic & Timezone Handling

### Date Grouping

**Daily Aggregation:**
- **Method:** Extract date portion only (YYYY-MM-DD)
- **Implementation:**
  ```typescript
  const dateString = approvalDate.toISOString().split("T")[0];  // "2025-12-21"
  approvalsByDate.set(dateString, (approvalsByDate.get(dateString) || 0) + 1);
  ```
- **Timezone:** Uses UTC (via `toISOString()`)
- **Result:** All approvals on the same calendar day (UTC) are grouped together

**Weekly Aggregation:**
- **Method:** Last 7 days from today
- **Implementation:**
  ```typescript
  for (let i = 6; i >= 0; i--) {  // Last 7 days (today + 6 days back)
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateString = date.toISOString().split("T")[0];
  }
  ```
- **Timezone:** Uses local time for "today", then converts to UTC for date string

**Monthly Aggregation:**
- **Method:** Uses `systemMonthlyStats` collection (pre-aggregated)
- **Key Format:** "YYYY-MM" (e.g., "2025-12")
- **Timezone:** Not applicable (pre-aggregated data)

**Yearly Aggregation:**
- **Method:** Aggregates from `calendarApprovals` collection
- **Implementation:** Sums all daily counts from all months in year
- **Timezone:** Inherits from daily aggregation (UTC)

### Timezone Handling

**Current Behavior:**
- **Date Extraction:** Always uses UTC (`toISOString().split("T")[0]`)
- **Today Calculation:** Uses local time (`new Date()`)
- **Potential Issue:** If approval happened at 11 PM local time (next day UTC), it may be grouped into the wrong day

**Example:**
- Approval at `2025-12-21T23:00:00-05:00` (EST)
- UTC: `2025-12-22T04:00:00Z`
- Grouped as: `2025-12-22` (next day in UTC)

**Range Filtering:**
- Uses local time for cutoff dates:
  ```typescript
  const today = new Date();
  today.setHours(0, 0, 0, 0);  // Local midnight
  const cutoffDate = new Date(today);
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  ```
- Then compares against UTC dates from Firestore
- **Potential Inconsistency:** Timezone mismatch between cutoff and data

---

## 4. Parsing Behavior for Different Record Types

### I-130 Records

**Structured Fields (Preferred):**
```typescript
{
  formType: "I-130",
  priorityDate: Timestamp,        // or priorityDateText: "2024-10-28"
  approvalDate: Timestamp,         // or approvalDateText: "2025-12-21"
  serviceCenter: "Nebraska",
  beneficiaryCountry: "Italy 🇮🇹",
  rfe: Timestamp | null,
  createdAt: Timestamp,
  notes: string
}
```

**Body-Only Text Records (Fallback):**
- Some records may have `body` field with text like: `"✔️ Italy 🇮🇹 ✔️ Service Center: Nebraska ✔️ Priority Date: November 30, 2024 ✔️ Approval Date: December 21, 2025"`
- **Current Behavior:** These are **NOT parsed** - if structured fields are missing, document is skipped
- **Gap:** Text-only records are ignored in stats

**Status Determination:**
1. If `rfe !== null && rfe !== undefined` → "rfe"
2. If `approvalDate` exists → "approved"
3. Otherwise → "processing" (or skipped)

### I-129F Records

**Structured Fields (Preferred):**
```typescript
{
  formType: "I-129F",
  noa1: Timestamp,                 // or noa1Date: Timestamp
  noa2: Timestamp,                 // or noa2Date: Timestamp
  serviceCenter: "CSC",
  beneficiaryCountry: "Thailand 🇹🇭",
  category: "K1",
  rfe: Timestamp | null,
  interview: Timestamp | null,
  medical: Timestamp | null,
  sentToDOS: Timestamp | null,
  createdAt: Timestamp
}
```

**Body-Only Text Records:**
- Similar to I-130 - if structured fields missing, document is skipped
- **Gap:** Text-only records are ignored

**Status Determination:**
1. If `rfe !== null && rfe !== undefined` → "rfe"
2. If `noa2` or `noa2Date` exists → "approved"
3. Otherwise → "processing" (or skipped)

**Milestone Timestamps:**
- `noa1` / `noa1Date` - Used as "start date" (equivalent to priority date)
- `noa2` / `noa2Date` - Used as "approval date" (equivalent to approvalDate)
- `interview`, `medical`, `sentToDOS` - Used in "Today's Update" status breakdown, but not in main approval trends

---

## 5. Assumptions & Fallbacks

### Query Limits

**I-130:**
- Most queries: `limit(1000)`
- Approval odds: `limit(2000)`
- **Assumption:** 1000-2000 records is sufficient for accurate stats
- **Risk:** If more than limit records exist, older records may be excluded

**I-129F:**
- Most queries: `limit(2000)`
- **Assumption:** Higher limit needed due to more I-129F data

### Missing Index Fallbacks

**I-130:**
- If `orderBy("approvalDate")` fails → retry without `orderBy`
- **Assumption:** Results are still usable without ordering
- **Risk:** May get different results each time (non-deterministic)

**I-129F:**
- Three-tier fallback: `noa2Date` → `noa2` → no `orderBy`
- **Assumption:** At least one approach will work
- **Risk:** Without ordering, may miss recent approvals if limit is hit

### Date Parsing Fallbacks

**Priority Order (I-130 approvalDate):**
1. `approvalDate.toDate()` (Firestore Timestamp)
2. `approvalDate.seconds` → `new Date(seconds * 1000)`
3. `new Date(approvalDate)` (direct conversion)
4. `new Date(approvalDateText)` (text fallback)
5. **If all fail:** Document skipped

**Priority Order (I-129F noa2):**
1. `noa2Date.toDate()` or `noa2.toDate()`
2. `noa2Field.seconds` → `new Date(seconds * 1000)`
3. `new Date(noa2Field)`
4. **If all fail:** Document skipped

### Default Values

**Approval Odds:**
- If no similar cases found → returns:
  ```typescript
  {
    approved: 70,
    rfe: 25,
    denied: 5,
    sampleSize: 0,
    confidence: "low"
  }
  ```
- **Assumption:** Generic 70/25/5 split is reasonable default

**Timeline Estimate:**
- If no distribution data → uses:
  - I-130: 450 days median
  - I-129F: 240 days median
- **Assumption:** These are reasonable defaults based on historical data

**Queue Position:**
- If no cohort cases found → returns:
  ```typescript
  {
    positionRank: 0,
    totalTracked: 0,
    percentile: 50,  // Default 50% if no data
    casesAhead: 0,
    isInRange: false
  }
  ```

### Field Name Variations

**I-129F Date Fields:**
- Supports both `noa1` and `noa1Date` (same field, different names)
- Supports both `noa2` and `noa2Date` (same field, different names)
- **Assumption:** Data may use either naming convention

**I-130 Date Fields:**
- Supports both `approvalDate` (Timestamp) and `approvalDateText` (string)
- Supports both `priorityDate` (Timestamp) and `priorityDateText` (string)
- **Assumption:** Some records may only have text fields

---

## 6. Potential Inconsistencies

### Timezone Mismatch

**Issue:** 
- Approval dates stored as UTC timestamps
- Date grouping uses UTC (`toISOString().split("T")[0]`)
- But "today" calculation uses local time
- Range filtering uses local time for cutoff

**Example:**
- User in EST (UTC-5) adds approval at 11 PM local time
- Approval date: `2025-12-21T23:00:00-05:00` = `2025-12-22T04:00:00Z` UTC
- Grouped as: `2025-12-22` (next day)
- But if querying "today" (Dec 21 local), it may not appear

**Impact:** Approvals may appear on wrong day in charts

### Query Limit Exclusions

**Issue:**
- Queries limited to 1000-2000 records
- If more records exist, older ones excluded
- Without `orderBy`, results are non-deterministic

**Impact:** Stats may be incomplete or inconsistent across refreshes

### Text-Only Records Ignored

**Issue:**
- Records with only `body` text (e.g., "✔️ Italy 🇮🇹 ...") are skipped
- No parsing logic for extracting dates from text

**Impact:** Some approvals may not appear in stats

### Field Name Inconsistencies

**Issue:**
- I-129F uses both `noa1`/`noa1Date` and `noa2`/`noa2Date`
- Code handles both, but if data uses different names inconsistently, some records may be missed

**Impact:** Incomplete data if field names vary

### Status Determination Logic

**Issue:**
- Status based on presence of `rfe` or `approvalDate`/`noa2`
- If both are null, status = "processing"
- But in some functions, these are skipped entirely

**Impact:** "Processing" cases may be undercounted

### Cohort Calculation Window

**Issue:**
- Queue position uses ±90 day cohort window
- But neighbor comparison uses ±60 day window
- Different windows may give different results

**Impact:** Inconsistent position calculations

---

## 7. Summary: Authoritative Fields

### I-130 Approvals

**Authoritative Fields (in priority order):**
1. `approvalDate` (Firestore Timestamp) - **PRIMARY**
2. `approvalDateText` (string YYYY-MM-DD) - **FALLBACK**
3. `priorityDate` (Firestore Timestamp) - **PRIMARY**
4. `priorityDateText` (string) - **FALLBACK**
5. `formType` - **REQUIRED** (must be "I-130")
6. `serviceCenter` - **OPTIONAL** (for breakdowns)
7. `beneficiaryCountry` - **OPTIONAL** (for breakdowns)
8. `rfe` - **OPTIONAL** (for status determination)
9. `createdAt` - **OPTIONAL** (for "Today's Update" only)

**NOT Used:**
- `body` text field (not parsed)
- Other milestone dates (not used in main stats)

### I-129F Approvals

**Authoritative Fields (in priority order):**
1. `noa2Date` or `noa2` (Firestore Timestamp) - **PRIMARY** (approval date)
2. `noa1` or `noa1Date` (Firestore Timestamp) - **PRIMARY** (start date)
3. `formType` - **REQUIRED** (must be "I-129F")
4. `serviceCenter` - **OPTIONAL** (for breakdowns)
5. `beneficiaryCountry` - **OPTIONAL** (for breakdowns)
6. `category` - **OPTIONAL** (e.g., "K1")
7. `rfe` - **OPTIONAL** (for status determination)
8. `interview`, `medical`, `sentToDOS` - **OPTIONAL** (for "Today's Update" only)
9. `createdAt` - **OPTIONAL** (for "Today's Update" only)

**NOT Used:**
- `body` text field (not parsed)
- Other milestone dates (not used in main approval trends)

---

## 8. Data Flow Summary

### Daily Approval Trends

1. Query `i130Approvals` or `i129fApprovals` with `formType` filter
2. Extract `approvalDate` (I-130) or `noa2Date`/`noa2` (I-129F)
3. Convert to UTC date string: `YYYY-MM-DD`
4. Group by date string, count approvals per day
5. Create array for last N days (fill missing days with 0)
6. Sort chronologically

### Weekly Breakdown

1. Call `getI130ApprovalDataByDate(7)` and `getI129FApprovalDataByDate(7)`
2. Merge results into single array with both I-130 and I-129F counts
3. Create entries for last 7 days (today + 6 days back)

### Service Center Stats

1. Query `i130Approvals` with `formType == "I-130"`
2. Group by `serviceCenter`
3. Calculate processing time: `approvalDate - priorityDate`
4. Filter centers with < 3 samples
5. Calculate averages, latest PD, status trends

### Approval Odds

1. Query collection with `formType` filter
2. Filter by `serviceCenter`, `beneficiaryCountry`, `caseAge` if provided
3. Determine status: `rfe` → "rfe", `approvalDate`/`noa2` → "approved", else skip
4. Count approved/rfe/denied
5. Calculate percentages
6. Build service center and country breakdowns

### Queue Position

1. Query collection with `formType` filter
2. Extract priority date (`priorityDate` for I-130, `noa1` for I-129F)
3. Filter to cohort: cases within ±90 days of user's PD
4. Calculate position rank within cohort
5. Calculate percentile

### Neighbor Comparison

1. Query collection with `formType` filter
2. Filter by `serviceCenter` if provided
3. Filter to window: cases within ±60 days of user's PD
4. Determine status for each neighbor
5. Count by status (approved/processing/rfe)
6. Calculate distribution percentages

---

## 9. Recommendations (For Future Consideration)

1. **Standardize Field Names:** Ensure all I-129F records use consistent field names (`noa1Date` vs `noa1`, `noa2Date` vs `noa2`)

2. **Parse Text Fields:** Add logic to parse `body` text fields for records that only have text data

3. **Timezone Consistency:** Use consistent timezone (preferably UTC) for all date operations

4. **Increase Query Limits:** Consider increasing limits or using pagination for more complete data

5. **Create Firestore Indexes:** Create composite indexes for common queries to avoid fallback behavior

6. **Standardize Window Sizes:** Use consistent cohort/neighbor window sizes across functions

7. **Add Data Validation:** Validate that required fields exist before processing

8. **Logging:** Add more detailed logging for skipped records to identify data quality issues

---

**End of Review**
