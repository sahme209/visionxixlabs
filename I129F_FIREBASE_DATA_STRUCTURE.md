# I-129F Firebase Data Structure

## Collection: `i129fApprovals`

### Expected Document Structure

Each document in the `i129fApprovals` collection should have the following structure:

```typescript
{
  // REQUIRED FIELDS
  formType: "I-129F" | "I129F",  // String - identifies this as an I-129F case
  noa1Date: Timestamp | Date,     // Receipt date (NOA1) - REQUIRED
  
  // APPROVAL DATE (REQUIRED for graph to show data)
  // The graph looks for approval dates in this priority order:
  noa2Date: Timestamp | Date,     // Preferred: Approval date (NOA2)
  noa2: Timestamp | Date,         // Fallback: Alternative field name
  approvalDate: Timestamp | Date,  // Fallback: Generic approval date field
  
  // OPTIONAL FIELDS (for other features)
  beneficiaryCountry: string,      // Country of beneficiary
  petitionerCountry: string,       // Usually "United States"
  usEmbassy: string?,              // U.S. Embassy location (optional)
  
  // Other optional dates (not used by graph)
  rfeDate: Timestamp | Date?,      // Request for Evidence date
  rfeResponseDate: Timestamp | Date?,
  sentToDOSDate: Timestamp | Date?,
  caseNumberAssignedDate: Timestamp | Date?,
  consulateInTransitDate: Timestamp | Date?,
  consulateReadyDate: Timestamp | Date?,
  medicalDate: Timestamp | Date?,
  interviewDate: Timestamp | Date?,
  visaReceivedDate: Timestamp | Date?,
  usArrivalDate: Timestamp | Date?,
  
  // Metadata
  notes: string?,                  // Optional flags (e.g., "expedite", "appeal", "denial")
  createdAt: Timestamp | Date?     // When document was created
}
```

## What the Graph Needs

For the **I-129F Approval Trends graph** to display data, each document MUST have:

1. ✅ **`formType`**: `"I-129F"` or `"I129F"` (optional - if missing, document will still be processed if in `i129fApprovals` collection)
2. ✅ **Approval Date**: At least ONE of these fields:
   - `noa2Date` (preferred)
   - `noa2` (fallback)
   - `approvalDate` (fallback)

## Date Format

Dates can be stored as:
- **Firestore Timestamp** (preferred): `Timestamp(date)`
- **JavaScript Date**: `new Date()`
- **ISO String**: `"2024-01-15"` or `"2024-01-15T00:00:00Z"`

## Example Valid Documents

### Example 1: Complete Document (Preferred)
```json
{
  "formType": "I-129F",
  "noa1Date": "2024-01-15T00:00:00Z",
  "noa2Date": "2024-06-20T00:00:00Z",
  "beneficiaryCountry": "United Kingdom",
  "petitionerCountry": "United States",
  "usEmbassy": "London, UK",
  "createdAt": "2024-01-15T00:00:00Z"
}
```

### Example 2: Minimal Document (Still Works)
```json
{
  "formType": "I-129F",
  "noa2Date": "2024-06-20T00:00:00Z"
}
```

### Example 3: Using Alternative Field Names (Still Works)
```json
{
  "formType": "I-129F",
  "noa2": "2024-06-20T00:00:00Z"
}
```

### Example 4: Without formType (Still Works - Collection name is enough)
```json
{
  "noa2Date": "2024-06-20T00:00:00Z"
}
```

## What Will Cause Graph to Show 0

The graph will show **0 approvals** if:

1. ❌ **No approval date field**: Document has no `noa2Date`, `noa2`, or `approvalDate`
2. ❌ **Invalid date format**: Date field exists but can't be parsed
3. ❌ **Date out of range**: Approval date is older than the selected time range (7D/30D/90D)
4. ❌ **Wrong formType**: Document has `formType` set to something other than "I-129F" or "I129F"
5. ❌ **Empty collection**: No documents exist in `i129fApprovals` collection
6. ❌ **Permission errors**: Firestore security rules block read access

## Query Behavior

The code tries multiple query strategies:

1. **First attempt**: Query with `formType == "I-129F"` and `orderBy("noa2Date", "desc")`
2. **Fallback 1**: Query with `formType == "I-129F"` and `orderBy("noa2", "desc")`
3. **Fallback 2**: Query with `formType == "I-129F"` (no ordering)
4. **Fallback 3**: Query without `formType` filter (gets all documents from collection)

## Debugging

Check browser console for these logs:
- `[StatsService] Fetched X I-129F approvals` - Shows how many documents were fetched
- `[StatsService] I-129F processing: X processed, Y skipped...` - Shows why documents were skipped

## Firestore Index Requirements

For optimal performance, create these composite indexes in Firestore:

1. **Collection**: `i129fApprovals`
   - Fields: `formType` (Ascending), `noa2Date` (Descending)

2. **Collection**: `i129fApprovals`
   - Fields: `formType` (Ascending), `noa2` (Descending)

If indexes are missing, the code will fall back to queries without ordering (slower but still works).
