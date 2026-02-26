# StatsView Unification - Implementation Output

## Summary

This document tracks the complete refactoring of StatsView on both iOS (SwiftUI) and Web (Next.js) to have EXACTLY 10 sections + Charts & Trends (Simple) block, with all data from real Firestore sources.

## Required Final Structure

### SECTION 1: What Changed Today
- New Approvals (+delta vs yesterday)
- Priority Date Movement (+days vs yesterday)  
- Active Cases processed last 24h
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}`
- **Condition**: Show ONLY if real daily stats exist for today

### SECTION 2: Daily Impact Analysis
- Time Saved
- Queue Position + moved spots (hide if cannot compute)
- Progress % + delta
- ETA days + improved by
- **Data Source**: `/systemDailyStats/{YYYY-MM-DD}` + profile

### SECTION 3: AI Insights
- Up to 3 insight cards (hide section if none computable)
- **Data Source**: `/trends/{scopeId}`, `/rfeStats/{scopeId}`, `/pdStats/{scopeId}`

### SECTION 4: System Health + Your Risk
- System Health (only if real telemetry exists)
- Your Risk (derived from cohort stats + profile completeness)
- **Data Source**: Real telemetry + `/rfeStats/{scopeId}`

### SECTION 5: What Happens Next For You
- Personalized next-steps/timeline
- **Data Source**: Profile + processing/timeline engine
- **Condition**: Show CTA if profile incomplete

### SECTION 6: Today's Update
- **ACTION**: Check if duplicates Section 1 - if yes, merge them

### SECTION 7: More Cases Approved This Month
- Monthly summary with filters
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}`

### SECTION 8: Approval & RFE Rate
- Approvals count, RFE count, RFE rate %
- Breakdown by service center + optional country
- **Data Source**: `/rfeStats/{scopeId}`

### SECTION 9: Approval Trends
- Trend chart (show ONLY if >= 7 real trend points exist)
- **Data Source**: `/trends/{scopeId}`

### SECTION 10: All Service Centers
- All Service Centers aggregate + individual center cards
- **Data Source**: `/systemMonthlyStats/{YYYY-MM}` + service center breakdown

### Charts & Trends (Simple) Block
- 6 charts (hide each if data missing)
- **Data Source**: Various aggregates

## Implementation Progress

Starting implementation now...
