# Help Center Migration Implementation Plan

## Status: In Progress

### Completed
- ✅ iOS Help Center Audit document
- ✅ TypeScript type definitions
- ✅ Interview Prep Q&A data (15 questions)
- ✅ Documents & Sponsors data

### In Progress
- 🔄 Data models and content files
- ⏳ Component implementation

### Remaining
- ⏳ FAQ data extraction and porting
- ⏳ Country Guidance data extraction and porting
- ⏳ Process Timeline data
- ⏳ All component implementations (A through I)
- ⏳ Route setup
- ⏳ Build verification

## Implementation Order

1. **Data Layer** (Current)
   - ✅ Interview Prep data
   - ✅ Documents & Sponsors data
   - ⏳ FAQ data (extract from FAQSeedData.swift)
   - ⏳ Country Guidance data (extract from GuidanceLibrarySeedData.swift)
   - ⏳ Process Timeline data (extract from VisaJourneyGuideView.swift)

2. **Core Components**
   - ⏳ Help Center main page (enhance existing)
   - ⏳ Interview Prep Pack
   - ⏳ Flashcards
   - ⏳ Mock Interview
   - ⏳ Documents & Sponsors
   - ⏳ Country Guidance
   - ⏳ FAQs
   - ⏳ Process Timelines
   - ⏳ Timeline Scenarios

3. **Routes & Navigation**
   - ⏳ Update existing routes
   - ⏳ Add missing routes
   - ⏳ Breadcrumb navigation

4. **Testing & Verification**
   - ⏳ Build verification
   - ⏳ Feature parity check
   - ⏳ Responsive design check

## Notes

- All data must match iOS exactly
- No placeholders or mock data
- Preserve iOS naming and ordering
- Use client components only for interactive features
- Server components for static content where possible
