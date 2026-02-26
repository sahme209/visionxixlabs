# iOS Help Center Audit

## Overview
This document provides a comprehensive audit of the iOS Help Center implementation, serving as the source of truth for the Web migration.

## Key Files Structure

### Main Entry Point
- **File**: `VisaNova-IOS/Views/HelpCenterView.swift`
- **Purpose**: Main Help Center landing page with AI Smart Assist and section navigation
- **Features**:
  - AI Smart Assist search box (optional, keyword-based routing)
  - Section organization: Interview Preparation, Resources
  - Navigation to all sub-features
  - Technical tip footer

### Core Components
- **File**: `VisaNova-IOS/Views/HelpCenterComponents.swift`
- **Purpose**: Reusable UI components (BigPrimaryButton, InfoCard, ChecklistCard, etc.)

---

## Feature-by-Feature Mapping

### A) Search Box
**iOS Implementation**: 
- Located in `HelpCenterView.swift` (lines 207-344)
- **Smart Assist View**: Optional text input with keyword detection
- **Search Logic**: Simple keyword matching (not full-text search)
- **Keywords Detected**:
  - Documents & Sponsors: `i864`, `i-864`, `joint sponsor`, `affidavit`, `sponsor`, `documents`
  - FAQs: `track`, `status`, `refused`, `ap`, `administrative processing`, `passport`, `221g`, `stuck`, `delay`, `mandamus`, `expedite`, `too long`, `waiting`, `vpn`, `network`, `can't open`, `won't load`
- **Results**: Shows suggestion button linking to relevant section
- **No Global Search**: Help Center itself doesn't have a global search - search is per-section

**Data Source**: No separate data source - uses keyword matching on input text

---

### B) Interview Preparation
**iOS Implementation**: 
- **Main View**: `VisaNova-IOS/VisaFlow/CaseToolsView.swift` (lines 3662-4246)
- **Entry Point**: `InterviewPrepView` struct
- **Features**:
  1. **Header Section**: Description and important tips
  2. **Readiness Section**: Progress tracking (viewed questions count, progress bar)
  3. **Practice Mode Section**: Two buttons:
     - Question Review (Flashcards) → Opens `FlashcardsView`
     - Practice Interview Session → Opens `MockInterviewView`
  4. **Questions Section**: All 15 Q&A pairs organized by category
  5. **Notes Section**: Text editor for interview notes

**Data Source**: 
- **Hardcoded**: `InterviewPrepView.defaultQAPairs` (lines 3683-3714)
- **15 Questions Total**, organized in categories:
  - Personal Information (3 questions)
  - Background & History (3 questions)
  - Employment & Education (2 questions)
  - Family & Relationships (2 questions)
  - Purpose & Intent (2 questions)
  - Language & Communication (1 question)
  - Financial (1 question)
  - Documents & Evidence (1 question)

**Progress Tracking**:
- Uses `@AppStorage` for persistence
- Tracks viewed questions by ID (Set<Int>)
- Auto-saves notes

**Navigation**:
- Opens Flashcards as sheet modal
- Opens Mock Interview as sheet modal

---

### C) Question Review Flashcards
**iOS Implementation**: 
- **File**: `VisaNova-IOS/VisaFlow/CaseToolsView.swift` (lines 4248-4428)
- **View**: `FlashcardsView`
- **Features**:
  - Shuffled questions on appear
  - Progress indicator: "X of Y" + ProgressView
  - Flip animation: Tap card to toggle question/answer
  - Navigation: Previous button (disabled on first), Next/Finish button
  - Card shows: Question side (question text + category) or Answer side (answer + tips)
  - Animation: Spring animation on flip

**Data Source**: Receives `questions: [InterviewQAPair]` as parameter (same as Interview Prep)

**Behavior**:
- Questions are shuffled on appear
- Current index state tracks position
- `showAnswer` state toggles card side
- Previous button disabled when at index 0
- Next button shows "Finish" on last question
- Dismisses when finished

---

### D) Mock Interview
**iOS Implementation**: 
- **File**: `VisaNova-IOS/VisaFlow/CaseToolsView.swift` (lines 4456-4700+)
- **View**: `MockInterviewView`
- **Features**:
  - Progress bar at top (shows current/total)
  - Question card with category and question text
  - Answer input: TextEditor for user to type response
  - Suggested answer section (disclosure group, shows after user submits answer)
  - Navigation: Previous (if not first), Next/Finish button
  - Completion view: Summary screen when finished

**Data Source**: Receives `questions: [InterviewQAPair]` as parameter

**State Management**:
- `currentIndex`: Current question index
- `userAnswers: [Int: String]`: Dictionary mapping question ID to user's answer
- `currentAnswer`: Current text input
- `isFinished`: Boolean for completion state

**Flow**:
1. User sees question
2. User types answer in TextEditor
3. User clicks Next → answer saved, moves to next question
4. After moving, suggested answer section appears (disclosure group)
5. Repeat until finished
6. Show completion view

---

### E) Resources - Documents & Sponsors
**iOS Implementation**: 
- **File**: `VisaNova-IOS/Views/DocumentsSponsorsView.swift`
- **View**: `DocumentsSponsorsView`
- **Structure**:
  - Topic selection screen (3 topics)
  - Detail screen per topic

**Topics** (enum `DocumentTopic`):
1. **221(g) / Missing docs**
2. **I-864 Affidavit of Support**
3. **Joint Sponsor**

**Data Source**: Hardcoded in view
- `definitionTitle(for:)`: Returns title string
- `definitionMessage(for:)`: Returns explanation string
- `checklistItems(for:)`: Returns array of checklist strings
- `uploadHint(for:)`: Returns submission instructions

**UI Components**:
- Uses `InfoCard` for definition
- Uses `ChecklistCard` for required documents
- Custom card for "Where to submit" hint

**Navigation**: Back button to return to topic list

---

### F) Country Guidance
**iOS Implementation**: 
- **Main View**: `VisaNova-IOS/Views/CountryGuidance/CountryGuidanceView.swift`
- **Detail View**: `VisaNova-IOS/Views/CountryGuidance/CountryDetailView.swift`
- **Models**: `VisaNova-IOS/Models/CountryGuidanceModels.swift`
- **Data Manager**: `VisaNova-IOS/Managers/GuidanceLibraryManager.swift`
- **Seed Data**: `VisaNova-IOS/Data/GuidanceLibrarySeedData.swift` (referenced but not shown)

**Structure**:
- Country list with search
- Country detail with sections:
  - Header (country name, visa type, warnings)
  - Official Sources (chips with links)
  - Search bar (filters sections)
  - Collapsible sections:
    - CEAC Upload
    - Interview Documents
    - Medical
    - Timeline
    - Local Quirks

**Data Source**: 
- `GuidanceLibraryManager.shared.library` (singleton)
- Contains `GuidanceLibrary` with array of `CountryPack`
- Each `CountryPack` has:
  - `countryName`, `visaType`, `warnings`, `officialSources`, `sections`
- Each `GuidanceSection` has `title`, `items: [GuidanceItem]`
- Each `GuidanceItem` has `text`, `tags` (Required/Optional/Official/Community/Needs Verification)

**Search**: Filters countries by name (case-insensitive contains)

**Countries Seeded** (from documentation):
- Pakistan, India, Bangladesh, Philippines, Mexico, United Kingdom, Canada

---

### G) FAQs (Facts/Q&A Knowledge Base)
**iOS Implementation**: 
- **Main View**: `VisaNova-IOS/Views/FAQViews.swift`
- **Models**: `VisaNova-IOS/Models/FAQModels.swift`
- **Seed Data**: `VisaNova-IOS/Data/FAQSeedData.swift` (1624+ lines)

**Structure**:
- **Home View**: `FAQHomeView`
  - Search bar
  - Categories grid (2 columns)
  - Filters categories by search text
- **Category Detail**: `CategoryDetailView`
  - Search bar
  - Filter chips (Form, Stage, Location, Verified Only)
  - FAQ items list
- **FAQ Detail**: `FAQDetailView`
  - Question title
  - Context card (if exists)
  - Tags row
  - Official Answer section (if verified)
  - Community Notes section (collapsible)
  - Disclaimer footer

**Data Model**:
- `FAQLibrary` → `categories: [CommunityFAQCategory]`
- `CommunityFAQCategory` → `id`, `title`, `subtitle`, `items: [CommunityFAQItem]`
- `CommunityFAQItem` → `id`, `question`, `context`, `forms`, `stage`, `tags`, `locationHint`, `officialAnswer`, `officialSources`, `communityNotes`, `isVerified`

**Categories** (from seed data):
1. AOS / I-485
2. NVC
3. K-1
4. ROC (Removal of Conditions)
5. Naturalization
6. Family
7. Entry
8. Misc
9. Global Scenarios
10. Real-Life Scenarios

**Search Logic**:
- Home: Filters categories by title/subtitle, filters items within categories
- Detail: Filters items by question, context, tags
- Filter chips: Filter by form, stage, location, verified status

---

### H) Process Timelines (Comprehensive Guides)
**iOS Implementation**: 
- **File**: `VisaNova-IOS/Views/VisaJourneyGuideView.swift`
- **View**: `VisaNovaGuideView`

**Structure**:
- Header section with description
- Search bar
- Categories grid (2 columns, 11 categories)

**Categories** (enum `GuideCategory`):
1. I-130 Family Petitions
2. I-129F K-1/K-3
3. I-485 Adjustment of Status
4. NVC Processing
5. Consular Interview
6. AOS Timeline
7. K-1 Fiancé Visa
8. K-3 Spouse Visa
9. CR-1/IR-1 Spouse Visa
10. I-751 Remove Conditions
11. N-400 Naturalization

**Detail View**: `VisaNovaCategoryDetailView` (not fully shown, but referenced)
- Shows timeline phases
- Shows process steps
- Category-specific data hardcoded in computed properties

**Data Source**: Hardcoded in view
- `categoryTimeline: [TimelinePhase]` - computed per category
- `processSteps: [String]` - computed per category
- Each category has specific timeline phases and steps

**Search**: Filters categories by name/description

---

### I) Timeline Scenarios
**iOS Implementation**: 
- **Wrapper**: `VisaNova-IOS/Views/ScenariosWrapperView.swift`
- **Main View**: `VisaNova-IOS/VisaFlow/ScenariosView.swift` (ScenariosPillView)

**Structure**:
- Wrapper provides user data (priority date, form type, country, pace)
- `ScenariosPillView` displays interactive timeline scenarios
- Shows different processing speeds (0.6x, 0.9x, 1.2x, 1.5x, 2.0x)
- Calculates ETA dates using `TimelineEngine`

**Data Source**: 
- User profile data (priority date, form type, processing path, country)
- Uses `TimelineEngine.calculateUSCISApprovalDate()` for calculations
- Pace comparison chips show different scenarios

**Features**:
- Custom pace slider
- Day offset adjustment
- Comparison chips for different paces
- Confidence bands (best/likely/worst case)
- Delta days from baseline

---

## Data Sources Summary

| Feature | Data Source | Location |
|---------|------------|----------|
| Interview Prep Q&A | Hardcoded array | `CaseToolsView.swift` lines 3683-3714 |
| Documents & Sponsors | Hardcoded in view | `DocumentsSponsorsView.swift` |
| Country Guidance | Singleton manager | `GuidanceLibraryManager.shared` |
| FAQs | Seed data file | `FAQSeedData.swift` (1624+ lines) |
| Process Timelines | Hardcoded in view | `VisaJourneyGuideView.swift` |
| Timeline Scenarios | User profile + calculations | `ScenariosView.swift` + `TimelineEngine` |

---

## Navigation Flow

```
HelpCenterView (Main)
├── Interview Prep Pack → InterviewPrepView
│   ├── Flashcards → FlashcardsView (sheet)
│   └── Mock Interview → MockInterviewView (sheet)
├── Question Review (Flashcards) → FlashcardsStandaloneView → FlashcardsView
├── Mock Interview → MockInterviewStandaloneView → MockInterviewView
├── Documents & Sponsors → DocumentsSponsorsView
│   └── [Topic Detail] → (same view, different state)
├── Country Guidance → CountryGuidanceView
│   └── [Country Detail] → CountryDetailView
├── FAQs → FAQHomeView
│   ├── [Category Detail] → CategoryDetailView
│   │   └── [FAQ Detail] → FAQDetailView
├── Process Timelines → VisaNovaGuideView
│   └── [Category Detail] → VisaNovaCategoryDetailView
└── Timeline Scenarios → ScenariosWrapperView → ScenariosPillView
```

---

## UI Patterns & Components

### Reusable Components (HelpCenterComponents.swift)
- `BigPrimaryButtonContent`: Main action button with icon, title, subtitle
- `InfoCard`: Title, message, icon, icon color
- `ChecklistCard`: Title, items array, icon
- `OutsideNormalProcessingCard`: Warning card with expedite CTA
- `ProCTAButton`: Pro feature call-to-action

### Design System
- Uses `CopilotTheme` for colors
- Dark mode support via `@Environment(\.colorScheme)`
- Background: `CopilotBackgroundView()` in dark mode, `Color(.systemGroupedBackground)` in light
- Cards: Rounded corners (16-20px), shadows, gradient fills in dark mode

---

## Pro/Subscription Gating
- **None found** in Help Center features
- All features appear to be free

---

## Edge Cases & Fallback UI

### Empty States
- **Country Guidance**: "No countries found" with globe icon
- **FAQs**: "No FAQs match your filters" with magnifying glass icon
- **Search**: Filters out empty sections/categories

### Loading States
- **None explicitly shown** - data appears to be synchronous/local

### Error States
- **None explicitly shown** - assumes data is always available

---

## Notes for Web Migration

1. **Search**: iOS uses simple keyword matching, not full-text search. Replicate this behavior.
2. **Data Porting**: Most data is hardcoded. Port to JSON/TypeScript files in `/data` or `/lib`.
3. **State Management**: iOS uses `@State`, `@AppStorage`. Web should use React state + localStorage.
4. **Navigation**: iOS uses NavigationStack/NavigationLink. Web should use Next.js routing.
5. **Modals**: iOS uses `.sheet()`. Web should use modal components or separate routes.
6. **Animations**: iOS uses SwiftUI animations. Web should use CSS transitions/animations or Framer Motion.
7. **Progress Tracking**: iOS uses `@AppStorage`. Web should use localStorage.
8. **Shuffling**: iOS uses `.shuffled()`. Web should use array shuffle utility.

---

## Missing Content

- **Country Guidance Seed Data**: Referenced but file not shown. Need to extract from `GuidanceLibraryManager` or find seed data file.
- **Process Timeline Detail Views**: `VisaNovaCategoryDetailView` implementation not fully shown. Need to read full file.

---

## Next Steps

1. Extract all hardcoded data to JSON/TypeScript files
2. Create data models matching iOS structure
3. Implement each feature in order (A through I)
4. Test navigation flows
5. Verify data matches iOS exactly
6. Ensure responsive design for web
7. Test build on Vercel
