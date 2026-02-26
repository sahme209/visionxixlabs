# iOS Home Tab: Complete Analysis & Web Mapping Plan

## iOS Home Tab: Key Files

### Main Entry Point
- **`Views/HomeView.swift`** (47 lines)
  - Wraps `ContentView` with profile setup flow
  - Handles authentication state changes
  - Shows `FormTypeSelectionView` full-screen cover when profile not completed

### Core Implementation
- **`VisaFlow/ContentView.swift`** (5,477 lines)
  - Main Home tab implementation
  - Contains all sections: approval cards, timeline, progress rings, premium services
  - State management for priority date, service center, pace
  - Dashboard pills/tabs system (Overview, Insights, Centers)
  - Timeline generation and display logic

### View Models & Services
- **`VisaFlow/ContentViewModel.swift`** (290 lines)
  - Generates approval data, latest PD, service center stats
  - Uses `CommunityDataService` for real data when available
  - Falls back to estimated data with seeded random generation
  - Refreshes data daily

- **`VisaFlow/OverviewSectionView.swift`** (1,319 lines)
  - Renders overview section with all cards
  - Premium services pills (Case Tools, Expedite, Action Plan)
  - Live USCIS Status card
  - Timeline card
  - Case Progress rings
  - Queue Position card
  - Current Processing Times card
  - Daily Approvals card

### Data Services
- **`VisaFlow/NewsService.swift`** (629 lines)
  - Fetches news from USCIS RSS, DHS RSS, Google News, Travel.State.Gov
  - Caching: 12-hour cache, UserDefaults storage
  - Filters for immigration-related news
  - Priority classification (breaking, urgent, normal)

- **`Managers/QueuePositionCalculatorService.swift`** (1,038 lines)
  - Calculates queue position from real backend data
  - Fetches from `i130Approvals`, `i129fApprovals`, `userCases` collections
  - 15-minute cache TTL
  - Calculates current processing PD from recent approvals (14-30 day rolling median)

- **`Managers/CurrentProcessingTimesService.swift`** (75 lines)
  - Real-time listener on `currentProcessingTimes/global` Firestore document
  - Observes `bodyText` and `updatedAt` fields
  - Auto-updates when admin publishes new data

- **`Views/DailyApprovalCard.swift`** + **`Models/DailyApproval.swift`**
  - Real-time listener on `dailyApproval` collection (I-130) and `i129fApprovals` (I-129F)
  - Fetches up to 50 most recent approvals
  - Segmented control to switch between I-130 and I-129F
  - Premium-gated (subscription required)

### Timeline & Calculations
- **`VisaFlow/TimelineEngine.swift`**
  - Generates timeline stages for all form types
  - Calculates USCIS approval dates using `I130USCISApprovalEstimator`
  - NVC/DQ date calculations (14-60 days after approval)
  - Embassy stage calculations using `PostDQGapProvider` or `CountryWaitTimeManager`

- **`VisaFlow/USCISUtilities.swift`**
  - `calculateTimelineDates()` - computes all stage dates
  - `estimatedApprovalDate()` / `estimatedApprovalDateWithPace()` - approval date calculation
  - `getCurrentLatestPD()` - gets current processing PD for form type

### Premium Services
- **`VisaFlow/CaseToolsView.swift`** (195+ lines)
  - Coin-gated (20 coins to unlock all tools)
  - Tools: RFE Response, Expedite Request, Action Plan, Document Pack, Evidence Checklist, etc.
  - Each tool opens specific view/sheet

- **`VisaFlow/ExpediteRequestView.swift`**
  - Individual tool unlock: 10 coins
  - Generates expedite request letter
  - Uses user profile data (form type, receipt number, priority date, country)

- **`Views/NextStepsView.swift`** (Action Plan)
  - NavigationLink destination from OverviewSectionView
  - Shows smart guidance based on case stage
  - Uses timeline data to determine next steps

### UI Components
- **`VisaFlow/LiveUSCISStatusCard.swift`** (392 lines)
  - Generates Live Status card view model
  - Maps `CaseMilestone` to USCIS-style status text
  - Shows "Confirmed" vs "Official" badge based on source
  - "Edit Profile Setup" entrypoint button

- **`Views/QueuePositionCard.swift`** (517 lines)
  - Premium-gated queue position display
  - Shows position number, range, days remaining
  - Uses `QueuePositionCalculatorService` for real data calculation

- **`Views/CurrentProcessingTimesCard.swift`** (497 lines)
  - Displays processing times from Firestore
  - Parses `bodyText` into form/service center entries
  - Premium blur overlay for non-subscribers
  - "View Full Details" button opens detail sheet

---

## Section A: News Feed

### iOS UI Structure
- **View**: `Views/NewsView.swift` (407 lines)
- **Navigation**: Standalone view (not embedded in Home tab, but accessible)
- **Layout**: 
  - ScrollView with LazyVStack
  - Modern header with search field
  - Filter picker (All, Breaking, Urgent)
  - `ModernNewsCard` components for each article
  - Pull-to-refresh via `.refreshable` modifier

### Data Source
- **Service**: `VisaFlow/NewsService.swift`
- **Sources** (fetched concurrently):
  1. USCIS RSS: `https://www.uscis.gov/news/rss.xml`
  2. DHS RSS: `https://www.dhs.gov/news-releases/rss.xml`
  3. Google News RSS: Multiple queries ("USCIS immigration news", "USCIS visa updates", etc.)
  4. Travel.State.Gov RSS: `https://travel.state.gov/content/travel/en/News/rss.xml`

### Business Logic
1. **Caching Strategy**:
   - Cache key: `lastNewsFetchDate` (UserDefaults)
   - Cache data key: `cachedNews` (UserDefaults, JSON encoded)
   - If fetched today AND cache < 12 hours old → return cached
   - If cache > 12 hours → fetch fresh in background, return cached immediately
   - Force refresh bypasses cache

2. **Fetching Process**:
   - Concurrent async fetching from all 4 sources
   - Parse RSS XML using `RSSParser` (XMLParserDelegate)
   - Filter for immigration relevance (keywords: "uscis", "immigration", "visa", "green card", etc.)
   - Remove duplicates by URL
   - Filter to last 60 days only
   - Sort: Breaking news first, then by date (newest first)
   - Limit to top 50 articles

3. **Priority Classification**:
   - **Breaking**: Contains "breaking", "emergency", "urgent"
   - **Urgent**: Contains "important", "update", "change", "announcement"
   - **Normal**: Everything else

4. **Refresh Behavior**:
   - Pull-to-refresh: `await refreshNews()` (force refresh)
   - Manual refresh button in toolbar
   - Auto-check on view appear: if cache > 6 hours, refresh in background
   - Loading state shown when initially loading and news is empty

### Dependencies
- **Local Storage**: UserDefaults for cache
- **Network**: URLSession for RSS fetching
- **Parsing**: Custom RSSParser (XMLParserDelegate)
- **No Firestore/APIs**: Pure RSS feed aggregation

### Edge Cases & Fallback UI
- Empty state: Shows loading spinner when `isLoading && news.isEmpty`
- Error handling: Failed sources return empty array (non-blocking)
- Date parsing: Multiple formatters tried, falls back to including article if date unparseable
- URL normalization: Handles relative URLs, Google News redirects, encoding issues

---

## Section B: Live USCIS Status Card

### iOS UI Structure
- **Component**: `VisaFlow/LiveUSCISStatusCard.swift`
- **View**: `LiveUSCISStatusCardView` (embedded in `OverviewSectionView`)
- **Layout**:
  - Official USCIS header with shield icon
  - Status text (e.g., "Case is still being processed by USCIS")
  - Subtitle ("Updated by you" or "Based on your case timeline")
  - Badge ("Confirmed" or "Official")
  - Encouraging message
  - Progress checklist
  - "Edit Profile Setup" button (opens `FormTypeSelectionView`)

### Data Source
- **User Profile**: `UserData.shared.currentStage` (CaseStage enum)
- **Milestone Source**: `userCase.milestoneSource` (`.userConfirmed`, `.predicted`, `.autoAdvanced`)
- **Milestone Date**: `userCase.milestoneDate`

### Business Logic
1. **Milestone Mapping** (`liveStatusText(for:)`):
   - `.uscisProcessing` → "Case is still being processed by USCIS"
   - `.uscisApprovedSentToNVC` → "Case was approved and sent to NVC"
   - `.nvcCaseCreated` → "NVC case number created — preparing next steps"
   - `.dq` → "Documentarily Qualified (DQ) — awaiting interview queue"
   - `.medicalDone` → "Medical completed — waiting for interview"
   - `.interviewScheduled` → "Interview scheduled"
   - `.interviewDone` → "Interview completed — awaiting visa decision"
   - `.visaIssued` → "Visa issued"

2. **Badge Logic**:
   - `.userConfirmed` → "Confirmed" badge (green)
   - `.predicted` / `.autoAdvanced` → "Official" badge (blue)
   - `isEstimated` flag set based on source

3. **Confirmation Prompt**:
   - Shows if `milestoneSource == .autoAdvanced`
   - Allows user to confirm milestone was reached

4. **Edit Profile Setup Entrypoint**:
   - Button opens `FormTypeSelectionView` full-screen cover
   - Allows user to update case information

### Dependencies
- **UserData**: Shared singleton for current stage
- **ProfileDataService**: For form type, priority date, etc.
- **No Firestore**: Uses local user profile data

### Edge Cases & Fallback UI
- No profile: Card not shown (gated by `hasPriorityDate` in OverviewSectionView)
- Missing milestone date: Uses `Date()` as fallback
- Auto-advanced milestone: Shows confirmation prompt overlay

---

## Section C: VisaNova Timeline

### iOS UI Structure
- **Component**: `VisaFlow/ContentView.swift` (lines 3060-3248: `timelineCard`)
- **Alternative**: `advancedTimelineCard` (lines 3248+) for advanced mode
- **View**: Uses `ProTimelineView` or `SimpleTimelineView` based on mode
- **Layout**:
  - Three sections: **USCIS**, **NVC**, **Embassy**
  - Each section shows stages with dates
  - Progress indicators between stages
  - Tap to expand/collapse sections
  - Visual timeline with connecting lines

### Data Source
- **Timeline Generation**: `VisaFlow/TimelineEngine.swift`
  - `generateTimeline()` - main entry point
  - `generateUSSideStages()` - USCIS and NVC stages
  - `generateEmbassyStages()` - Embassy/consular stages
- **User Profile**: 
  - Priority Date: `ProfileDataService.shared.priorityDate`
  - Form Type: `ProfileDataService.shared.formType`
  - Country: `ProfileDataService.shared.spouseCountry`
  - Service Center: `ProfileDataService.shared.serviceCenter`
  - Processing Path: `UserData.shared.processingPath` (Consular vs AOS)

### Business Logic - Stage Date Calculations

#### USCIS Approval Date
- **Function**: `TimelineEngine.calculateUSCISApprovalDate()`
- **For I-130**:
  - Uses `I130USCISApprovalEstimator.shared.estimateApproval()`
  - Inputs: Priority Date, Country (optional), Custom Pace (optional)
  - Returns: `(estimated: Date, range: DateRange)`
- **For I-129F**:
  - Uses NOA1 date (not Priority Date)
  - Median: 300 days from NOA1
  - Custom pace adjustment: `days = medianDays / pace`
- **For other forms**: Form-specific median days from PD

#### NVC Transfer Date
- **Calculation**: Approval Date + 7-28 days (typically 14 days)
- **Code**: `VisaFlow/USCISUtilities.swift` line 460
- **Range**: Earliest 7 days, Latest 28 days

#### NVC Processing End Date
- **Calculation**: NVC Transfer Date + 60 days
- **Code**: `TimelineEngine.swift` line 237-265

#### DQ Date (Documentarily Qualified)
- **Calculation**: NVC Processing End + 14-60 days (typically 30 days)
- **Code**: `TimelineEngine.swift` line 237-265
- **Range**: Earliest 14 days, Latest 60 days

#### Post-DQ Dates (Embassy Stages)
- **Data Source**: 
  - `PostDQGapProvider` (for I-130/I-140)
  - `CountryWaitTimeManager` (fallback)
- **Country-Specific Offsets** (days from DQ):
  - Medical Exam: Country-specific offset (e.g., 45 days)
  - Interview Scheduled: Country-specific offset (e.g., 90 days)
  - Visa Issued: Country-specific offset (e.g., 120 days)
- **Code**: `USCISUtilities.swift` lines 472-487

#### I-129F Special Case
- **Embassy Receives**: Sent to DOS + 14-28 days (typically 21 days)
- **Post-Embassy dates**: Calculated from Embassy Receives date (not DQ)

### Formulas & Derived Fields

1. **USCIS Approval Formula** (I-130):
   ```
   approvalDate = I130USCISApprovalEstimator.estimateApproval(
       priorityDate: userPD,
       country: countryCode,
       customPace: pace
   )
   ```

2. **NVC Transfer Formula**:
   ```
   nvcTransferDate = approvalDate + 14 days (typical)
   Range: approvalDate + 7 to +28 days
   ```

3. **DQ Formula**:
   ```
   dqDate = nvcProcessingEnd + 30 days (typical)
   Range: nvcProcessingEnd + 14 to +60 days
   ```

4. **Embassy Stage Formula**:
   ```
   medicalDate = dqDate + countryMedicalOffset
   interviewDate = dqDate + countryInterviewOffset
   visaDate = dqDate + countryVisaOffset
   ```

### Dependencies
- **Firestore**: None (all calculations are local)
- **Local Services**:
  - `I130USCISApprovalEstimator` - approval date estimation
  - `PostDQGapProvider` - country-specific embassy timing
  - `CountryWaitTimeManager` - fallback country data
- **User Profile**: ProfileDataService, UserData

### Edge Cases & Fallback UI
- **AOS Forms** (I-485, etc.): No NVC/Embassy stages, only USCIS → Approval
- **Missing Country**: Uses default offsets or median values
- **No Priority Date**: Timeline not shown (gated by `hasPriorityDate`)
- **Form Type Not Supported**: Shows generic timeline or error state

---

## Section D: Premium Services (Case Tools / Expedite / Action Plan)

### iOS UI Structure
- **Location**: `VisaFlow/OverviewSectionView.swift` (lines 428-965: `premiumServicesSection`)
- **Layout**: Horizontal scrollable pills/buttons
- **Pills**:
  1. **Case Tools** (`.caseTools`)
  2. **Expedite** (`.expedite`)
  3. **Action Plan** (`.actionPlan`)

### Case Tools

#### UI & Navigation
- **View**: `VisaFlow/CaseToolsView.swift`
- **Entry**: NavigationLink or sheet from OverviewSectionView
- **Layout**: Grid of tool cards
- **Tools Available**:
  - RFE Response
  - Expedite Request
  - Action Plan
  - Document Pack
  - Evidence Checklist
  - Queue Position
  - Timeline Alerts
  - Case Packet

#### Logic & Gating
- **Unlock Cost**: 20 coins (one-time unlock for all tools)
- **Check**: `@AppStorage("hasUnlockedCaseTools")`
- **Coin System**: `StoreKitManager` (coinBank)
- **If Locked**: Shows `coinGateView` with upsell
- **If Unlocked**: Shows `caseToolsContent` with all tools

#### What Screens Open
- **RFE Response**: `RFEResponseView` (generates RFE response letter)
- **Expedite Request**: `ExpediteRequestView` (individual tool, 10 coins)
- **Action Plan**: `NextStepsView` (NavigationLink)
- **Document Pack**: Document generation view
- **Evidence Checklist**: Checklist view
- **Queue Position**: `QueuePositionView` (sheet)
- **Timeline Alerts**: Alerts configuration
- **Case Packet**: PDF generation view

### Expedite Request

#### UI & Navigation
- **View**: `VisaFlow/ExpediteRequestView.swift`
- **Entry**: Can be accessed individually (10 coins) or via Case Tools (if unlocked)
- **Layout**: Form with user data pre-filled, generates expedite letter

#### Logic
- **Individual Unlock**: 10 coins
- **Data Used**:
  - Form Type: `profile.formType`
  - Receipt Number: `profile.receiptNumber`
  - Priority Date: `profile.priorityDate`
  - Country: `profile.spouseCountry`
  - Service Center: `profile.serviceCenter`
  - Current Stage: `userData.currentStage`
- **Letter Generation**: Creates formatted expedite request letter with user's case details

### Action Plan

#### UI & Navigation
- **View**: `Views/NextStepsView.swift`
- **Entry**: NavigationLink from OverviewSectionView (line 505-528)
- **Navigation Title**: "Action Plan"
- **Layout**: ScrollView with step-by-step guidance

#### Logic
- **No Gating**: Always accessible (not premium-gated)
- **Smart Guidance**: Based on current case stage from timeline
- **Data Source**: Timeline stages, user profile
- **Determines Next Steps**: Uses `TimelineEngine` to determine what stage user is at, then shows relevant actions

### Dependencies
- **StoreKitManager**: Coin balance, spending, subscription status
- **ProfileDataService**: User case data
- **UserData**: Current stage, processing path
- **TimelineEngine**: For Action Plan next steps

### Edge Cases & Fallback UI
- **No Coins**: Shows upsell view with "Buy Coins" button
- **No Profile**: Some tools may show empty state or prompt for profile setup
- **Subscription Check**: Some tools may also check `store.isSubscribed` for additional premium features

---

## Section E: Case Progress (3 Rings)

### iOS UI Structure
- **Component**: `VisaFlow/ContentView.swift` (lines 628-770: calculation functions)
- **View**: `progressAndStatusView` (passed to OverviewSectionView)
- **Layout**: Three circular progress rings side-by-side
  1. **Progress %** (toward approval)
  2. **Case Age** (days since priority date)
  3. **Queue Status** (position relative to current processing)

### Data Source
- **Priority Date**: `selectedYear`, `selectedMonth`, `selectedDay` (from ContentView state)
- **Current Latest PD**: `ImmigrationProcessingUtilities.getCurrentLatestPD(formType:)`
- **Estimated Approval**: `ImmigrationProcessingUtilities.estimatedApprovalDateWithPace()`
- **Form Type**: `currentFormType` (from ProfileDataService)

### Business Logic - Exact Calculations

#### Ring 1: Progress % (Toward Approval)
**Function**: `calculateUserProgress()` (ContentView.swift line 631)

```
1. Get user Priority Date (from selectedYear/Month/Day)
2. Get current Latest PD: ImmigrationProcessingUtilities.getCurrentLatestPD(formType)
3. Calculate estimated approval: estimatedApprovalDateWithPace(userPD, customPace: effectivePace)
4. start = currentLatestPD
5. end = estimatedApproval
6. now = Date()
7. elapsed = days from start to min(now, end)
8. total = days from start to end
9. progress = elapsed / total (clamped 0.0 to 1.0)
```

**Edge Cases**:
- If form type doesn't support latest PD → returns 0.5 (neutral)
- If end <= start → returns 1.0 (already past)
- If currentLatestPD can't be parsed → returns 0.0

#### Ring 2: Case Age
**Function**: `calculateCaseAgeProgress()` (ContentView.swift line 665)

```
1. Get user Priority Date
2. daysSincePD = days from userPD to Date()
3. maxDays = 730 (2 years)
4. progress = daysSincePD / maxDays (clamped 0.0 to 1.0)
```

**Display**: `getCaseAgeDays()` returns actual days (not percentage)

#### Ring 3: Queue Status
**Function**: `calculateQueueProgress()` (ContentView.swift line 714)

```
1. Get user Priority Date
2. Get current Latest PD
3. If userPD <= currentLatestPD:
   return 1.0 (current/ready)
4. Else:
   daysBehind = days from currentLatestPD to userPD
   effectiveDaysBehind = daysBehind / max(effectivePace, 0.1)
   maxDaysBehind = 365 (1 year range)
   progress = 1.0 - (effectiveDaysBehind / maxDaysBehind)
   (clamped to 0.0 minimum)
```

**Status Text**: `getQueueStatus()` returns:
- "Current" if userPD <= currentLatestPD
- "{daysBehind} days" otherwise

### Inputs Used
- **Priority Date**: User-selected date (year, month, day)
- **Form Type**: From ProfileDataService
- **Current Latest PD**: From `ImmigrationProcessingUtilities.getCurrentLatestPD()`
- **Custom Pace**: `selectedPace` (user-adjustable, default 0.9)
- **Service Center**: Not directly used in ring calculations (used in approval estimation)

### Dependencies
- **ImmigrationProcessingUtilities**: Latest PD, approval date calculation
- **ProfileDataService**: Form type
- **No Firestore**: All calculations are local

### Edge Cases & Fallback UI
- **Form Type Not Supported**: Returns neutral progress (0.5) for Progress and Queue rings
- **Missing Latest PD**: Returns 0.0 for Progress, "Unknown" for Queue Status
- **Invalid Date**: Uses `Date()` as fallback

---

## Section F: "Your Queue Position" Module

### iOS UI Structure
- **Component**: `Views/QueuePositionCard.swift` (517 lines)
- **Location**: Embedded in `OverviewSectionView` (line 194)
- **Layout**:
  - Header with icon and title
  - Premium upsell section (if not subscribed)
  - Position display: "#X,XXX" with range
  - Days remaining indicator
  - Context message with trust signals
  - Confidence indicator (High/Medium/Low)
  - Last updated timestamp

### Data Source
- **Backend Collections**:
  1. **`i130Approvals`** (Firestore)
     - Fields: `formType`, `priorityDate` (Timestamp), `approvalDate` (Timestamp), `beneficiaryCountry`, `serviceCenter`, `notes`
     - Query: Last 30 days of approvals
  2. **`i129fApprovals`** (Firestore)
     - Fields: `formType`, `noa1Date` (Timestamp), `noa2Date` (Timestamp), `beneficiaryCountry`, `serviceCenter`, `notes`
     - Query: Last 30 days of approvals
  3. **`userCases`** (Firestore, optional)
     - User-submitted case data
     - Fields: `priorityDate` (Timestamp), `formType`

### Business Logic - Exact Calculation Method

#### Step 1: Calculate Current Processing PD
**Function**: `QueuePositionCalculatorService.calculateCurrentProcessingPD()` (line 321)

```
1. Fetch approvals from last 30 days:
   - For I-130: i130Approvals collection, where approvalDate > 30 days ago
   - For I-129F: i129fApprovals collection, where noa2Date > 30 days ago
2. Extract priority dates:
   - I-130: Use priorityDate field
   - I-129F: Use noa1Date field (NOA1 is the receipt date/PD)
3. Filter out non-standard cases:
   - Exclude if notes contain "expedite", "appeal", "denial", etc.
4. Require minimum 10 samples for reliability
5. Calculate median PD: sortedPDs[medianIndex]
6. Return currentProcessingPD = median
```

#### Step 2: Calculate Queue Position from Real Data
**Function**: `QueuePositionCalculatorService.calculateQueuePositionFromRealData()` (line 481)

```
1. Fetch all tracked cases:
   - From i130Approvals / i129fApprovals (all time, not just recent)
   - From userCases collection (optional)
   - Filter by formType
2. Sort cases by priorityDate ascending
3. Count cases ahead:
   casesAhead = count of cases where case.priorityDate < userPriorityDate
4. Calculate position rank (1-based):
   positionRank = casesAhead + 1
5. Calculate percentile:
   percentile = (positionRank / totalTracked) * 100
6. Determine if current:
   isCurrent = (userPriorityDate <= currentProcessingPD)
7. Calculate days remaining:
   daysRemaining = days from currentProcessingPD to userPriorityDate
   (if userPD is ahead of current PD)
```

#### Step 3: Apply Position Range & Confidence
**In QueuePositionCard.swift** (line 416):

```
1. Calculate position range (±10%):
   positionVariance = Int(position * 0.1)
   minPosition = max(50, position - positionVariance)
   maxPosition = min(50_000, position + positionVariance)
2. Determine confidence:
   - High: daysRemaining <= 30
   - Medium: daysRemaining <= 90
   - Low: daysRemaining > 90
```

### Data Inputs
- **User Priority Date**: From user profile
- **Form Type**: I-130 or I-129F
- **Processing Path**: Consular (required for I-130)
- **Approval Datasets**: 
  - `i130Approvals` collection (admin-entered approval records)
  - `i129fApprovals` collection (admin-entered approval records)
  - `userCases` collection (user-submitted cases, optional)
- **PD Pace Engine**: Not directly used (uses real approval data instead)

### What is Displayed in UI
- **Position Number**: "#X,XXX" (formatted with commas)
- **Position Range**: "Range: #X,XXX - #Y,YYY" (if available)
- **Days Remaining**: "{days} days until your PD becomes current"
- **Status**: "Your Priority Date is Current" (if isCurrent)
- **Context Message**: Explanation of calculation method
- **Confidence Indicator**: High/Medium/Low with color dot
- **Last Updated**: Relative time ("today at 3:45 PM", "yesterday", etc.)

### Dependencies
- **Firestore**: 
  - `i130Approvals` collection (read)
  - `i129fApprovals` collection (read)
  - `userCases` collection (read, optional)
- **QueuePositionCalculatorService**: Shared singleton with 15-minute cache
- **StoreKitManager**: Subscription check (premium-gated)

### Edge Cases & Fallback UI
- **Insufficient Data**: Shows empty state if < 10 recent approvals
- **Not I-130 Consular or I-129F**: Card not shown (gated in OverviewSectionView)
- **No Subscription**: Shows premium upsell section
- **Calculation Error**: Shows empty state with error message
- **PD Already Current**: Shows "Your Priority Date is Current" status instead of position number

---

## Section G: Current Processing Times Module

### iOS UI Structure
- **Component**: `Views/CurrentProcessingTimesCard.swift` (497 lines)
- **Location**: Embedded in `OverviewSectionView` (line 200)
- **Layout**:
  - Header with icon and "Official data updated regularly" badge
  - Subtitle: "Real-time processing dates from service centers"
  - USCIS badge
  - Last updated timestamp
  - Processing times content (blurred for non-subscribers)
  - "View Full Details" button

### Data Source
- **Firestore Collection**: `currentProcessingTimes`
- **Document**: `global`
- **Fields**:
  - `bodyText` (String): Formatted text with processing times
  - `updatedAt` (Timestamp): Last update time
  - `updatedBy` (String): Admin email
  - `version` (Int): Version number

### Business Logic

#### Fetching
- **Service**: `Managers/CurrentProcessingTimesService.swift`
- **Method**: Real-time listener (`addSnapshotListener`)
- **Update Frequency**: Real-time (updates immediately when admin publishes)
- **No Polling**: Uses Firestore listener for instant updates

#### Parsing
**Function**: `parseProcessingTimes(bodyText:)` (CurrentProcessingTimesCard.swift line 311)

```
1. Split bodyText by newlines
2. Identify form names (regex: "^I-\\d+|^N-\\d+|^K-1|^K-3")
3. Identify service center lines (pattern: "CSC: May 11, 2025")
4. Parse service center codes:
   - CSC → California
   - TSC → Texas
   - NBC → National Benefits
   - VSC → Vermont
   - NSC → Nebraska
   - etc.
5. Group by form name, extract service center dates
6. Return array of ProcessingTimeEntry objects
```

#### Display
- Shows up to 8 form entries
- Each entry shows: Form name, Service center badges, Dates
- If more than 8: Shows "... X more forms" indicator

### Dependencies
- **Firestore**: `currentProcessingTimes/global` document (read)
- **CurrentProcessingTimesService**: Shared singleton with real-time listener
- **StoreKitManager**: Subscription check (premium-gated content)

### Update Frequency
- **Real-time**: Updates immediately when admin publishes new data
- **Admin Publishing**: Via `CurrentProcessingTimesAdminManager.publishBodyText()`
- **Cooldown**: 10 seconds between publishes (prevents spam)

### Edge Cases & Fallback UI
- **No Data**: Shows "Processing times will appear here once updated."
- **Not Subscribed**: Shows blurred content with premium overlay
- **Parse Error**: Falls back to simple line-by-line display
- **Empty bodyText**: Shows empty state message

---

## Section H: Daily Approvals (I-130 and I-129F)

### iOS UI Structure
- **Component**: `Views/DailyApprovalCard.swift` (351 lines)
- **Location**: Embedded in `OverviewSectionView` (line 206-216)
- **Layout**:
  - Header with icon and title "I-130 / I-129F Daily Approvals"
  - Segmented control to switch between I-130 and K-1 (I-129F)
  - Premium upsell message (if not subscribed)
  - Scrollable vertical list of approval cards (if subscribed)
  - Each card shows: Title, Body, Timestamp

### Data Source
- **Firestore Collections**:
  1. **`dailyApproval`** (I-130)
     - Collection of documents (not single document)
     - Fields: `title`, `body`, `createdAt` (Timestamp)
     - Ordered by: `createdAt` descending
     - Limit: 50 most recent
  2. **`i129fApprovals`** (I-129F)
     - Same structure as I-130
     - Fields: `title`, `body`, `createdAt` (Timestamp)

### Business Logic

#### Fetching
- **ViewModel**: `DailyApprovalViewModel` (Models/DailyApproval.swift line 44)
- **Method**: Real-time listener (`addSnapshotListener`)
- **Query**:
  ```swift
  db.collection(approvalType.collectionName)
    .order(by: "createdAt", descending: true)
    .limit(to: 50)
    .addSnapshotListener { ... }
  ```

#### Filtering/Sorting
- **Sorting**: By `createdAt` descending (newest first)
- **Limit**: 50 most recent approvals
- **Filtering**: None (shows all approvals in collection)
- **Type Switching**: User can switch between I-130 and I-129F via segmented control

#### UI Layout
- **Vertical ScrollView**: Cards stacked vertically
- **Card Component**: `ApprovalCardItem` (private struct in DailyApprovalCard.swift)
- **Card Content**:
  - Title (bold, 17pt)
  - Body (regular, 14pt, multi-line)
  - Timestamp (small, 11pt, with clock icon)
- **Max Height**: 400pt (allows scrolling if many approvals)

#### Tap Actions
- **No Tap Action**: Cards are display-only (no navigation)
- **Future**: Could add tap to view full details (not currently implemented)

### Dependencies
- **Firestore**: 
  - `dailyApproval` collection (read, I-130)
  - `i129fApprovals` collection (read, I-129F)
- **DailyApprovalViewModel**: Manages listener lifecycle
- **StoreKitManager**: Subscription check (premium-gated)

### Edge Cases & Fallback UI
- **Not Subscribed**: Shows premium upsell message with "Upgrade to Pro" button
- **Loading**: Shows "Loading approvals..." with ProgressView
- **Empty**: Shows "Approval data will appear here" message
- **Error**: Shows error message with exclamation icon
- **No Form Type Match**: Defaults to I-130, but user can switch to I-129F

---

## Web Mapping Plan

### Recommended Next.js Component Breakdown

#### Main Home Page
- **File**: `app/page.tsx` (or `app/home/page.tsx`)
- **Type**: Server Component (for initial data fetching)
- **Structure**:
  ```tsx
  export default async function HomePage() {
    // Server-side data fetching
    const initialNews = await fetchNews()
    const processingTimes = await fetchProcessingTimes()
    
    return (
      <HomePageClient 
        initialNews={initialNews}
        processingTimes={processingTimes}
      />
    )
  }
  ```

#### Client Wrapper
- **File**: `components/HomePageClient.tsx`
- **Type**: Client Component (for interactivity)
- **Purpose**: Wraps all interactive sections, handles client-side state

#### Section Components (Client Components)
1. **`components/home/NewsFeedSection.tsx`**
   - Pull-to-refresh, filtering, search
   - Client component (needs interactivity)

2. **`components/home/LiveUSCISStatusCard.tsx`**
   - Display-only, can be server component
   - "Edit Profile Setup" button → client component wrapper

3. **`components/home/TimelineSection.tsx`**
   - Complex calculations → client component
   - Or: server component with pre-calculated dates

4. **`components/home/PremiumServicesSection.tsx`**
   - Navigation → client component

5. **`components/home/CaseProgressRings.tsx`**
   - Calculations → client component

6. **`components/home/QueuePositionCard.tsx`**
   - Real-time data → client component

7. **`components/home/CurrentProcessingTimesCard.tsx`**
   - Real-time data → client component

8. **`components/home/DailyApprovalsCard.tsx`**
   - Real-time data → client component

### Server vs Client Component Strategy

#### Server Components (Use For):
- **Initial Data Fetching**: News feed (first load), processing times (first load)
- **Static Content**: Headers, labels, non-interactive cards
- **SEO**: News articles, processing times (for search engines)

#### Client Components (Use For):
- **Real-time Updates**: Firestore listeners (Queue Position, Daily Approvals, Processing Times)
- **Interactivity**: Pull-to-refresh, filtering, search, navigation
- **Calculations**: Timeline dates, progress rings, queue position
- **State Management**: Form inputs, selected filters, expanded/collapsed states

### Data Fetching Approach

#### Option 1: Server Actions + Client Listeners (Recommended)
```tsx
// Server Component (initial load)
const initialData = await fetchInitialData()

// Client Component (real-time updates)
useEffect(() => {
  const unsubscribe = onSnapshot(collectionRef, (snapshot) => {
    // Update state
  })
  return () => unsubscribe()
}, [])
```

#### Option 2: API Routes + SWR/React Query
```tsx
// API Route: app/api/queue-position/route.ts
export async function GET() {
  const data = await calculateQueuePosition()
  return Response.json(data)
}

// Client Component
const { data } = useSWR('/api/queue-position', fetcher, {
  refreshInterval: 60000 // Poll every minute
})
```

#### Option 3: Cloudflare Worker (For News Feed)
- Deploy worker to fetch RSS feeds
- Cache responses (12 hours)
- Return JSON to Next.js
- Reduces server load

### Firestore Integration

#### Setup
- Use `firebase/firestore` in client components
- Use `firebase-admin` in API routes (for server-side operations)
- Create custom hooks: `useQueuePosition()`, `useDailyApprovals()`, etc.

#### Example Hook
```tsx
// hooks/useQueuePosition.ts
export function useQueuePosition(userPD: Date, formType: string) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'i130Approvals'), ...),
      (snapshot) => {
        const result = calculatePosition(snapshot)
        setData(result)
        setLoading(false)
      }
    )
    return () => unsubscribe()
  }, [userPD, formType])
  
  return { data, loading }
}
```

### Implementation Checklist

#### Section A: News Feed
- [ ] Create `components/home/NewsFeedSection.tsx` (client component)
- [ ] Implement RSS fetching (server action or API route)
- [ ] Add caching (12-hour cache, similar to iOS)
- [ ] Implement pull-to-refresh (use `useSWR` with `mutate` or custom hook)
- [ ] Add filter picker (All, Breaking, Urgent)
- [ ] Add search functionality
- [ ] Style cards to match iOS design
- [ ] Handle empty/error states

#### Section B: Live USCIS Status Card
- [ ] Create `components/home/LiveUSCISStatusCard.tsx`
- [ ] Map CaseStage enum to status text (reuse iOS logic)
- [ ] Add badge display (Confirmed vs Official)
- [ ] Add "Edit Profile Setup" button (links to `/profile-setup`)
- [ ] Gate by `hasPriorityDate` (only show if user has profile)

#### Section C: VisaNova Timeline
- [ ] Create `components/home/TimelineSection.tsx` (client component)
- [ ] Port `TimelineEngine` logic to TypeScript
- [ ] Implement three-section layout (USCIS, NVC, Embassy)
- [ ] Calculate stage dates using same formulas as iOS
- [ ] Add expand/collapse functionality
- [ ] Style timeline with connecting lines
- [ ] Handle AOS forms (no NVC/Embassy stages)

#### Section D: Premium Services
- [ ] Create `components/home/PremiumServicesSection.tsx`
- [ ] Add three pills: Case Tools, Expedite, Action Plan
- [ ] Implement coin system (or subscription check)
- [ ] Create routes: `/tools/case-tools`, `/tools/expedite`, `/tools/action-plan`
- [ ] Port CaseToolsView logic
- [ ] Port ExpediteRequestView logic
- [ ] Port NextStepsView (Action Plan) logic

#### Section E: Case Progress Rings
- [ ] Create `components/home/CaseProgressRings.tsx` (client component)
- [ ] Port calculation functions:
  - `calculateUserProgress()` → TypeScript
  - `calculateCaseAgeProgress()` → TypeScript
  - `calculateQueueProgress()` → TypeScript
- [ ] Create circular progress ring components (use SVG or library)
- [ ] Display percentages and labels
- [ ] Handle edge cases (form type not supported, missing data)

#### Section F: Queue Position
- [ ] Create `components/home/QueuePositionCard.tsx` (client component)
- [ ] Port `QueuePositionCalculatorService` to TypeScript
- [ ] Set up Firestore listeners for `i130Approvals` and `i129fApprovals`
- [ ] Implement calculation logic (current PD, position rank, percentile)
- [ ] Display position number, range, days remaining
- [ ] Add confidence indicator
- [ ] Gate by subscription (show upsell if not subscribed)
- [ ] Handle I-130 Consular and I-129F only

#### Section G: Current Processing Times
- [ ] Create `components/home/CurrentProcessingTimesCard.tsx` (client component)
- [ ] Set up Firestore listener on `currentProcessingTimes/global`
- [ ] Port parsing logic (`parseProcessingTimes`)
- [ ] Display formatted entries (form name, service centers, dates)
- [ ] Add premium blur overlay (if not subscribed)
- [ ] Add "View Full Details" button (opens modal/sheet)
- [ ] Show last updated timestamp

#### Section H: Daily Approvals
- [ ] Create `components/home/DailyApprovalsCard.tsx` (client component)
- [ ] Set up Firestore listeners:
  - `dailyApproval` collection (I-130)
  - `i129fApprovals` collection (I-129F)
- [ ] Add segmented control (I-130 / K-1 toggle)
- [ ] Display approval cards (title, body, timestamp)
- [ ] Gate by subscription (show upsell if not subscribed)
- [ ] Handle loading/empty/error states
- [ ] Limit to 50 most recent (ordered by createdAt desc)

#### General Infrastructure
- [ ] Set up Firestore client SDK in Next.js
- [ ] Create custom hooks for Firestore listeners
- [ ] Set up subscription/payment system (Stripe or similar)
- [ ] Create shared types file (CaseStage, QueuePositionResult, etc.)
- [ ] Port utility functions (date formatting, calculations)
- [ ] Set up error boundaries for each section
- [ ] Add loading skeletons
- [ ] Implement responsive design (mobile-first)

---

## Missing/Unclear Logic

### Areas Needing Further Investigation

1. **I130USCISApprovalEstimator Implementation**
   - **File**: Not found in search results
   - **Where to Look**: `VisaFlow/I130USCISApprovalEstimator.swift` or similar
   - **What's Needed**: Exact algorithm for I-130 approval date estimation

2. **PostDQGapProvider Implementation**
   - **File**: Not found in search results
   - **Where to Look**: `VisaFlow/PostDQGapProvider.swift` or `Managers/PostDQGapProvider.swift`
   - **What's Needed**: Country-specific embassy timing data structure

3. **CountryWaitTimeManager Full Implementation**
   - **File**: Referenced but not fully read
   - **Where to Look**: `VisaFlow/CountryWaitTimeManager.swift`
   - **What's Needed**: Complete country wait time data

4. **NextStepsView (Action Plan) Logic**
   - **File**: `Views/NextStepsView.swift` (not fully read)
   - **What's Needed**: How it determines "next steps" based on timeline stage

5. **Case Tools Individual Tool Implementations**
   - **Files**: RFEResponseView, DocumentPackView, etc. (not found)
   - **What's Needed**: What each tool does, what data it uses, what it generates

---

## Notes

- **iOS uses UserDefaults extensively** for caching and state persistence. Web should use localStorage or cookies for similar functionality.
- **iOS uses @AppStorage** for simple state. Web should use React state or context.
- **Firestore listeners are real-time** in iOS. Web should use `onSnapshot` for same behavior.
- **Coin system** in iOS uses StoreKit. Web will need alternative (Stripe, PayPal, etc.).
- **Premium gating** is consistent: Check `store.isSubscribed` before showing content.
