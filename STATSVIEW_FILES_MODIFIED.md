# StatsView Unification - Files Modified/Created

This document tracks all files that will be modified or created during the refactoring.

## iOS Files

### Modified:
1. `VisaNova-IOS/Views/StatsView.swift` - MAIN FILE (major refactoring)
2. `VisaNova-IOS/Views/SystemUpdatesComponents.swift` - Extract Sections 7 & 8
3. `VisaNova-IOS/Managers/StatsDataService.swift` - May need extensions for new data sources

### Created:
1. `VisaNova-IOS/Views/WhatsNextForYouSection.swift` - Section 5 component
2. `VisaNova-IOS/Views/ChartsTrendsSimpleSection.swift` - Charts & Trends block

## Web Files

### Modified:
1. `VisaNovaWeb/app/stats/page.tsx` - MAIN FILE (major refactoring)
2. `VisaNovaWeb/components/stats/SystemUpdatesSection.tsx` - Extract Sections 7 & 8
3. `VisaNovaWeb/lib/statsService.ts` - May need extensions for new data sources

### Created:
1. `VisaNovaWeb/components/stats/WhatsNextForYouSection.tsx` - Section 5 component
2. `VisaNovaWeb/components/stats/ChartsTrendsSimple.tsx` - Charts & Trends block

## Firestore Security Rules

### Modified:
- Rules already updated in `firestore-security-rules-final.txt`
- All new collections already have read/write rules

## Status

Starting implementation now...
