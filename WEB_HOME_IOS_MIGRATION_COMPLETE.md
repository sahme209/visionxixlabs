# Web Home iOS Migration - Implementation Complete

## Overview
Updated Web Home page to mimic iOS Home screen layout and features. All sections now match iOS order and behavior.

## Implementation Date
January 2025

---

## Section Order (Matches iOS Home)

1. **Live Status** (top) - Shows current case milestone/status
2. **USCIS Case Status** - Official USCIS data with edit button
3. **VisaNova Timeline** - Estimated processing range (USCIS → NBC → Embassy)
4. **Premium Services** - Case Tools, Expedite, Action Plan
5. **Case Progress** - Progress visualization based on timeline
6. **Your Queue Position** - Queue position and movement (I-130 Consular, I-129F only)

---

## Files Created

### Services
1. **`lib/services/profileService.ts`**
   - `loadUserProfile()` - Load user profile from Firestore
   - `subscribeToProfile()` - Real-time profile updates
   - Matches iOS ProfileDataService pattern

2. **`lib/services/uscisStatusService.ts`**
   - `fetchCaseStatus()` - Fetch case status from Worker proxy
   - `healthCheck()` - Health check endpoint
   - Uses: `https://uscis-status-api-back.vision19.workers.dev`
   - Matches iOS USCISCaseStatusService pattern

3. **`lib/services/timelineService.ts`**
   - `generateTimeline()` - Generate timeline from profile data
   - `calculateCaseProgress()` - Calculate progress percentage
   - `getCurrentStage()` - Get current timeline stage
   - Matches iOS TimelineEngine.generateTimeline logic

### Hooks
4. **`hooks/useProfile.ts`**
   - `useProfile()` - Hook to load and subscribe to user profile
   - Includes timeout fail-safe (12 seconds)
   - State machine: `idle | auth-loading | profile-loading | ready | missing | error`

### Components
5. **`components/LiveStatusCard.tsx`**
   - Live Status card matching iOS LiveUSCISStatusCard
   - Maps case stage to USCIS-style status text
   - Shows "Official" or "Confirmed" badge
   - Last updated timestamp

6. **`components/PremiumServices.tsx`**
   - Premium Services section with Case Tools, Expedite, Action Plan
   - Matches iOS Premium Services layout
   - Links to existing web routes

---

## Files Modified

### Components
1. **`components/USCISCaseStatus.tsx`** (Major Update)
   - Accepts receipt number from profile prop
   - Auto-fetches status on load when receipt exists
   - Edit button to update receipt number
   - "Official USCIS data" label
   - Proper error handling with timeout (30s)
   - Loading states with fail-safe
   - Refresh button
   - Last updated timestamp

2. **`components/TimelineView.tsx`** (Major Update)
   - Uses `generateTimeline()` from timelineService
   - Generates timeline from profile data (form type, priority date, country, processing path)
   - Groups stages by agency (USCIS, NBC/NVC, Embassy)
   - Shows estimated processing range
   - CTA to complete profile if data missing
   - Matches iOS TimelineEngine output

3. **`components/CaseProgress.tsx`** (Major Update)
   - Calculates progress from timeline milestones
   - Accepts timeline prop or override progress/stage
   - Hides if no timeline data
   - Shows percentage and current stage

4. **`components/QueuePositionCard.tsx`** (No changes needed)
   - Already uses iOS QueuePositionEngine logic
   - Works with real profile data

### Pages
5. **`app/page.tsx`** (Complete Rewrite)
   - Uses `useProfile()` hook for profile data
   - Generates timeline from profile using timelineService
   - Loads queue position data (latest PD) from Firestore
   - Displays sections in iOS order:
     1. Live Status
     2. USCIS Case Status
     3. Timeline
     4. Premium Services
     5. Case Progress
     6. Queue Position
   - Removed non-iOS sections (Processing Times, Daily Approvals, News)
   - Proper loading states with timeout fail-safe
   - Error handling and retry
   - CTAs when data is missing

---

## iOS Files Used as Reference

1. **`VisaNova-IOS/VisaFlow/ContentView.swift`**
   - Main home screen structure
   - Section order and layout

2. **`VisaNova-IOS/VisaFlow/OverviewSectionView.swift`**
   - Premium Services section
   - Section ordering logic

3. **`VisaNova-IOS/VisaFlow/LiveUSCISStatusCard.swift`**
   - Live Status card implementation
   - Status text mapping logic

4. **`VisaNova-IOS/VisaFlow/USCISCaseStatusService.swift`**
   - USCIS status API client
   - Worker proxy URL and headers

5. **`VisaNova-IOS/VisaFlow/TimelineEngine.swift`**
   - Timeline generation logic
   - Stage definitions and calculations

6. **`VisaNova-IOS/VisaFlow/QueuePositionEngine.swift`**
   - Queue position calculation (already ported)

---

## Data Sources & Logic

### Profile Data
- Source: Firestore `userProfiles/{userId}`
- Fields: `formType`, `priorityDate`, `country`, `receiptNumber`, `serviceCenter`, `processingPath`, `currentStage`, `completed`
- Hook: `useProfile()` with real-time subscription

### USCIS Case Status
- Source: Cloudflare Worker proxy: `https://uscis-status-api-back.vision19.workers.dev/case-status/{receiptNumber}`
- Headers: `demo_id: 3344` (matches iOS)
- Auto-fetches on load when receipt number exists
- Timeout: 30 seconds

### Timeline
- Generated from profile data using `timelineService.generateTimeline()`
- Uses iOS TimelineEngine formulas and stage definitions
- Supports: I-130, I-129F, I-140, I-485, I-765, I-131, I-751, I-821, I-821D, N-400
- Processing paths: Consular, AOS

### Queue Position
- Source: Firestore `pdStats/{scopeId}` where scopeId = `petitionType:{formType}`
- Calculated using iOS QueuePositionEngine (already ported)
- Only shown for I-130 Consular and I-129F
- Requires `latestApprovedPD` from Firestore

---

## Loading States & Error Handling

### State Machine
- `authLoading` → `profileLoading` → `ready` / `missing` / `error`

### Timeout Fail-Safe
- Profile loading: 12 seconds
- USCIS status fetch: 30 seconds (read timeout), 30 seconds (request timeout)
- All timeouts show error with retry option

### Error Handling
- Profile errors: Shows error card with refresh button
- USCIS status errors: Shows error message with "Retry" and "Edit receipt number" buttons
- Timeline errors: Hides timeline, shows CTA to complete profile
- Queue position errors: Hides queue position card if data unavailable

---

## Conditional Rendering

### Sections Show/Hide Logic
- **Live Status**: Only if `profile.currentStage` exists
- **USCIS Case Status**: Always shown (can edit receipt number)
- **Timeline**: Only if profile has `priorityDate` and `formType`
- **Premium Services**: Always shown
- **Case Progress**: Only if timeline can be generated
- **Queue Position**: Only for I-130 Consular or I-129F, and if `currentLatestPD` is available

### Missing Data CTAs
- No profile: "Complete Profile Setup" button
- No receipt number: "Add Receipt Number" button in USCIS Case Status
- No timeline data: "Complete profile to see your timeline" CTA
- No queue data: Queue Position card hidden (no dead space)

---

## Styling & UI

- Uses existing web theme (`uscis-card`, `uscis-card-header` classes)
- Compact, card-based layout matching iOS
- Reduced whitespace for sleek appearance
- Responsive (mobile-first)
- Dark mode support

---

## Testing Checklist

- [x] Profile loading with timeout
- [x] USCIS status fetch with worker proxy
- [x] Timeline generation from profile
- [x] Queue position calculation (if applicable)
- [x] Section order matches iOS
- [x] Conditional rendering based on data
- [x] Error handling and retry
- [x] Loading states
- [x] No infinite loading states
- [x] CTAs when data missing

---

## Next Steps (Optional Enhancements)

1. **Profile Update Service**: Create service to update receipt number in Firestore when user edits it
2. **Timeline Custom Pace**: Add UI for custom pace input (if needed)
3. **Embassy Stages Enhancement**: Add more country-specific wait times
4. **Real-time Updates**: Add real-time timeline/queue position updates via Firestore listeners

---

## Notes

- All calculations match iOS outputs using shared formulas
- No mock data - everything comes from real user profile + Firestore + USCIS API
- Worker proxy URL matches iOS implementation
- Timeline engine uses same stage definitions and calculations as iOS
- Queue position engine already ported from iOS

---

## Success Criteria ✅

1. ✅ Web Home matches iOS Home section order
2. ✅ All sections use real data (no mocks)
3. ✅ Sections hide/show based on data availability
4. ✅ Loading states with timeout fail-safe
5. ✅ Error handling with retry
6. ✅ Timeline uses iOS TimelineEngine logic
7. ✅ Queue position uses iOS QueuePositionEngine logic
8. ✅ USCIS status uses same worker proxy as iOS
9. ✅ UI is sleek/compact like iOS
10. ✅ No infinite loading states
