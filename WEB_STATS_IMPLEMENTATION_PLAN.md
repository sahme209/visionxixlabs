# Web Stats Implementation Plan

## Component Tree

```
StatsPage (app/stats/page.tsx)
├── Section A: SystemHealthAndRiskSection
│   ├── SnapshotGrid (System Overview Cards)
│   │   ├── I130PendingCard
│   │   ├── ImmigrationBacklogCard
│   │   ├── LastMonthApprovedCard
│   │   └── DailyAverageCard
│   └── RiskAssessmentCard (conditional, if user profile exists)
├── Section B: (Same as Section A - System Overview)
├── Section C: TodaysUpdateSection
│   └── TodaysUpdateCard
│       ├── PeriodSelector (Daily/Monthly/Yearly)
│       ├── DonutChart
│       └── MetricsList (with expand/collapse)
├── Section D: MoreCasesApprovedThisMonthSection (already exists, verify)
├── Section E: ApprovalRFERateSection (already exists, verify)
├── Section F: WeeklyApprovalBreakdownSection
│   └── WeeklyApprovalChart (I-130 + I-129F)
├── Section G: ApprovalTrendsSection
│   ├── ApprovalTrendsChart (I-130)
│   └── SummaryCards (Total, Avg, Peak, Trend)
├── Section H: ProcessingTimeI130Section
│   └── ProcessingTimeChart (I-130 distribution)
├── Section I: I129FApprovalTrendsSection
│   ├── I129FApprovalTrendsChart
│   └── SummaryCards
├── Section J: ProcessingTimeI129FSection
│   └── ProcessingTimeChart (I-129F distribution)
├── Section K: QuietOfficesSection
│   └── QuietOfficesChart (days since last approval per center)
└── Section L: MostActiveCentersSection
    └── MostActiveCentersChart (approvals in last 30 days)
```

## Data Layer

### Enhanced statsService.ts

**New Methods Needed:**

1. **`getI130ApprovalDataByDate(daysBack: number)`**
   - Fetches from `/i130Approvals`
   - Groups by approval date
   - Returns `ApprovalData[]`

2. **`getI129FApprovalDataByDate(daysBack: number)`**
   - Fetches from `/i129fApprovals`
   - Groups by `noa2Date`
   - Returns `ApprovalData[]`

3. **`getServiceCenterStats()`**
   - Groups by `serviceCenter`
   - Calculates stats per center
   - Returns `ServiceCenterStats[]`

4. **`getLatestPD(formType: string)`**
   - Finds most recent approval
   - Returns latest PD string

5. **`getLiveData()`**
   - Last 24 hours approvals
   - Returns pace, latest PD, approval count

6. **`getAverageProcessingTime(formType: string)`**
   - Calculates average processing days

7. **`getI129FProcessingTimes()`**
   - Calculates `noa2Date - noa1Date` for each

8. **`getQuietOffices()`**
   - Days since last approval per center

9. **`getMostActiveCenters(days: number = 30)`**
   - Approval counts per center in last N days

10. **`getProcessingTimeDistribution(formType: string)`**
    - Distribution of processing times
    - Returns histogram data

### Types (lib/types.ts)

**Already Defined:**
- `SystemDailyStats`
- `SystemMonthlyStats`
- `SystemCoverage`
- `TrendsData`
- `PDStats`
- `RFEStats`
- `CalendarApprovals`

**New Types Needed:**

```typescript
export interface ApprovalData {
  date: string; // YYYY-MM-DD
  approvals: number;
}

export interface ServiceCenterStats {
  name: string;
  avgDays: number;
  latestPD: string;
  status: "improving" | "delays" | "steady";
  count: number;
  daysSinceLastApproval?: number;
}

export interface ProcessingTimeDistribution {
  range: string; // e.g., "300-350"
  count: number;
  average: number;
  median: number;
  min: number;
  max: number;
}

export interface WeeklyApprovalData {
  date: string;
  i130: number;
  i129f: number;
}

export interface ApprovalTrendSummary {
  total: number;
  average: number;
  peak: { date: string; count: number };
  trend: "increasing" | "decreasing" | "stable";
  last7DaysDelta: number;
}
```

## Charting Library

**Current:** Recharts (already in use)

**Components Needed:**
- `DonutChart` - For Today's Update
- `LineChart` - For trends
- `BarChart` - For weekly breakdown, processing times, active centers
- `AreaChart` - For monthly comparison

**Already Available:**
- `LineChart`, `BarChart`, `PieChart` from recharts

## Caching Strategy

**Client-Side:**
- Use React Query or SWR for data fetching
- Cache TTL: 5 minutes (match iOS)
- Stale-while-revalidate pattern

**Server-Side (Optional):**
- ISR with 5-minute revalidation
- Or use API routes with caching headers

## Component Implementation Order

### Phase 1: Core Data Service
1. ✅ Enhance `statsService.ts` with all methods
2. ✅ Add missing types to `types.ts`

### Phase 2: System Overview (Section A)
3. ✅ Create `SystemHealthAndRiskSection.tsx`
4. ✅ Create `SnapshotGrid.tsx` component
5. ✅ Create `RiskAssessmentCard.tsx` (if user profile exists)

### Phase 3: Today's Update (Section C)
6. ✅ Create `TodaysUpdateSection.tsx`
7. ✅ Create `TodaysUpdateCard.tsx` with tabs and donut chart

### Phase 4: Charts & Trends
8. ✅ Create `WeeklyApprovalBreakdownSection.tsx`
9. ✅ Create `ApprovalTrendsSection.tsx` (I-130)
10. ✅ Create `ProcessingTimeI130Section.tsx`
11. ✅ Create `I129FApprovalTrendsSection.tsx`
12. ✅ Create `ProcessingTimeI129FSection.tsx`

### Phase 5: Service Center Analysis
13. ✅ Create `QuietOfficesSection.tsx`
14. ✅ Create `MostActiveCentersSection.tsx`

### Phase 6: Integration
15. ✅ Update `app/stats/page.tsx` to use all sections in correct order
16. ✅ Verify all sections match iOS order and functionality
17. ✅ Test build and fix errors

## File Structure

```
VisaNovaWeb/
├── app/stats/page.tsx (main page)
├── components/stats/
│   ├── SystemHealthAndRiskSection.tsx (NEW)
│   ├── SnapshotGrid.tsx (NEW)
│   ├── RiskAssessmentCard.tsx (NEW)
│   ├── TodaysUpdateSection.tsx (NEW)
│   ├── TodaysUpdateCard.tsx (NEW)
│   ├── WeeklyApprovalBreakdownSection.tsx (NEW)
│   ├── ApprovalTrendsSection.tsx (NEW)
│   ├── ProcessingTimeI130Section.tsx (NEW)
│   ├── I129FApprovalTrendsSection.tsx (NEW)
│   ├── ProcessingTimeI129FSection.tsx (NEW)
│   ├── QuietOfficesSection.tsx (NEW)
│   ├── MostActiveCentersSection.tsx (NEW)
│   ├── MoreCasesApprovedThisMonthSection.tsx (EXISTS - verify)
│   ├── ApprovalRFERateSection.tsx (EXISTS - verify)
│   ├── SystemUpdatesSection.tsx (EXISTS - may need updates)
│   ├── ChartsAndTrendsSection.tsx (EXISTS - may need updates)
│   └── WhatsNextForYouSection.tsx (EXISTS)
├── lib/
│   ├── statsService.ts (ENHANCE)
│   └── types.ts (ENHANCE)
└── hooks/
    └── useStats.ts (NEW - optional, for data fetching)
```

## Implementation Details

### Section A: System Health + Your Risk

**SnapshotGrid:**
- Fetch from `/systemMonthlyStats` for current and previous month
- Calculate: Daily Average = `approvalsTotal / daysInMonth`
- Calculate: Last Month = previous month's `approvalsTotal`
- I-130 Pending: Aggregate from `/i130Approvals` (count pending cases)
- Backlog: May remain hardcoded if no real source

**RiskAssessmentCard:**
- Only show if user has profile
- Fetch user profile from `/userProfiles/{uid}`
- Calculate case age from priority date
- Fetch service center stats
- Show risk factors based on case age, center, country

### Section C: Today's Update

**Data Fetching:**
- Daily: `/systemDailyStats/{today}`
- Monthly: `/systemMonthlyStats/{currentMonth}`
- Yearly: Aggregate from `/calendarApprovals` for all months in year

**Donut Chart:**
- Use Recharts `PieChart` with `innerRadius` for donut effect
- Show percentages on slices > 10%
- Center text shows current date/month/year

**Metrics List:**
- Show top 4 by default
- "See More" expands to show all
- Sort by percentage descending

### Section F: Weekly Approval Breakdown

**Data:**
- Fetch I-130 approvals for last 7 days
- Fetch I-129F approvals for last 7 days
- Group by date
- Display as grouped bar chart

**Chart:**
- X-axis: Dates (last 7 days)
- Y-axis: Approval count
- Two bars per date: I-130 (blue) and I-129F (purple)

### Section G: Approval Trends (I-130)

**Data:**
- Fetch I-130 approvals for last 90 days (or selected range)
- Group by date
- Calculate summary metrics

**Summary Cards:**
- Total: Sum of all approvals
- Average: Total / days
- Peak: Max approvals in single day
- Trend: Compare last 7 vs previous 7 days

**Chart:**
- Line chart showing daily approval counts
- X-axis: Dates
- Y-axis: Approval count

### Section H: Processing Time (I-130)

**Data:**
- Fetch all I-130 approvals
- Calculate `processingDays = approvalDate - priorityDate` for each
- Create distribution buckets (e.g., 300-350, 350-400, etc.)

**Chart:**
- Bar chart showing distribution
- X-axis: Time ranges
- Y-axis: Count of cases
- Show average, median, min, max as text

### Section K: Quiet Offices

**Data:**
- Fetch all I-130 approvals
- Group by `serviceCenter`
- Find most recent `approvalDate` per center
- Calculate days since that date

**Chart:**
- Bar chart or list
- X-axis: Service centers
- Y-axis: Days since last approval
- Sort ascending (most active first)

### Section L: Most Active Centers

**Data:**
- Fetch I-130 approvals from last 30 days
- Group by `serviceCenter`
- Count approvals per center

**Chart:**
- Bar chart
- X-axis: Service centers
- Y-axis: Approval count
- Sort descending (most active first)

## Testing Checklist

1. ✅ All sections render without errors
2. ✅ Data loads from Firestore correctly
3. ✅ Charts display with real data
4. ✅ Empty states show when no data
5. ✅ Loading states show while fetching
6. ✅ Error handling works (network errors, missing data)
7. ✅ Date calculations match iOS
8. ✅ Timezone handling is correct
9. ✅ User profile integration works
10. ✅ Build passes (`npm run build`)
11. ✅ No TypeScript errors
12. ✅ No linting errors

## Performance Considerations

1. **Data Fetching:**
   - Use React Query for parallel fetching
   - Cache aggressively (5 min TTL)
   - Use Firestore listeners only where real-time needed

2. **Chart Rendering:**
   - Lazy load chart components
   - Use `ResponsiveContainer` from Recharts
   - Limit data points for large date ranges

3. **Bundle Size:**
   - Tree-shake Recharts imports
   - Code-split stats page if needed

## Accessibility

1. **Charts:**
   - Add ARIA labels
   - Provide text alternatives
   - Ensure keyboard navigation

2. **Cards:**
   - Proper heading hierarchy
   - Semantic HTML
   - Screen reader friendly

## Responsive Design

1. **Mobile:**
   - Stack cards vertically
   - Simplify charts on small screens
   - Touch-friendly controls

2. **Tablet:**
   - 2-column grid for cards
   - Full-width charts

3. **Desktop:**
   - 3-4 column grid for cards
   - Side-by-side charts where appropriate
