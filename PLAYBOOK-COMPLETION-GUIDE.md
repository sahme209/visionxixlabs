# Playbook-First Release Workspace: Completion Guide

**Status:** Frontend + Backend skeleton complete. Ready for data completion and testing.  
**Primary files:** `app/api/dashboard/release-playbook/[id]/route.ts`, `app/dashboard/releases/[id]/playbook/page.tsx`  
**Component:** `components/dashboard/ReleasePlaybookStageCard.tsx`

---

## Phase 1: Complete Backend Data Aggregation (1-2 hours)

The endpoint currently queries 4 data sources but has 5 TODO items for stage calculations. Add these in order:

### TODO 1: Approval Chain (30 min)

**File:** `app/api/dashboard/release-playbook/[id]/route.ts` (line ~165)

**Current:** `approval.required` and `approval.granted` are hardcoded to 0

**What to do:**
```typescript
// After the existing Promise.all, add:
const approval = await prisma.axiomApprovalRequest.findFirst({
  where: {
    resourceId: releaseId,
    organizationId: orgId,
  },
  include: {
    votes: true,
  },
});

// Then populate in response:
approval: {
  required: approval?.approversRequired ?? 0,
  granted: approval?.votes.filter(v => v.outcome === "approved").length ?? 0,
  status: approval?.status ?? "pending",
},
```

**Test:** After fix, check `/dashboard/releases/[id]/playbook` "What is happening?" tab — Approval card should show real vote counts.

---

### TODO 2: Policy Violations (30 min)

**File:** `app/api/dashboard/release-playbook/[id]/route.ts` (line ~175)

**Current:** `playbook.policyViolationCount` is 0

**What to do:**
```typescript
// Add to Promise.all:
const policyViolations = await prisma.policyViolation.count({
  where: {
    releaseId,
    organizationId: orgId,
  },
});

// Populate:
playbook: {
  // ... existing fields ...
  policyViolationCount: policyViolations,
},
```

**Test:** "What needs attention?" tab should show warning if count > 0.

---

### TODO 3: Cherry-pick Count (20 min)

**File:** `app/api/dashboard/release-playbook/[id]/route.ts` (line ~170)

**Current:** `playbook.cherryPickCount` is 0

**What to do:**
```typescript
const cherryPicks = await prisma.releaseCherry.count({
  where: {
    releaseId,
    organizationId: orgId,
  },
});

// Populate:
playbook: {
  // ... existing ...
  cherryPickCount: cherryPicks,
},
```

---

### TODO 4: Validation Results (30 min)

**File:** `app/api/dashboard/release-playbook/[id]/route.ts` (line ~185)

**Current:** `validation.planCount` and `validation.resultsCount` are 0

**What to do:**
```typescript
const validationPlans = await prisma.releaseValidationPlan.findMany({
  where: { releaseId, organizationId: orgId },
  include: { results: true },
});

const planCount = validationPlans.length;
const resultsCount = validationPlans.reduce((sum, p) => sum + (p.results?.length ?? 0), 0);

// Populate:
validation: {
  planCount,
  resultsCount,
  status: validationPlans.length === 0 ? "not_run" : "completed",
},
```

---

### TODO 5: Service Impact Count (20 min)

**File:** `app/api/dashboard/release-playbook/[id]/route.ts` (line ~155)

**Current:** `risk.affectedServiceCount` is 0

**What to do:**
```typescript
const affectedServices = await prisma.releaseServiceImpact.count({
  where: {
    releaseId,
    organizationId: orgId,
  },
});

// Populate:
risk: {
  // ... existing ...
  affectedServiceCount: affectedServices,
},
```

---

## Phase 2: Frontend Testing (1 hour)

### Test in Browser

1. **Start dev server:**
   ```bash
   npm install  # If not already done
   npm run dev
   ```

2. **Visit page:**
   - Go to `http://localhost:3000/dashboard/releases`
   - Click a release card (or create a test release)
   - Click "Playbook" tab on release detail

3. **Verify each tab:**

   **Tab: "What is happening?"**
   - [ ] All 9 stage cards visible
   - [ ] Status icons correct (✓/⏳/⚠️/🔴)
   - [ ] Colors correct (emerald/amber/orange/rose)
   - [ ] Facts render correctly (labels + values)
   - [ ] Links work ("View {stage} →")

   **Tab: "What needs attention?"**
   - [ ] Only shows if readiness.blockerCount > 0 (or violations, or pending approvals)
   - [ ] Blockers show in orange box with correct count
   - [ ] Violations show in red box
   - [ ] Pending approvals show in amber box
   - [ ] If nothing is wrong: shows "No blockers" message

   **Tab: "What changed?"**
   - [ ] Timeline shows in reverse chronological order (newest first)
   - [ ] Each event shows timestamp and type (Request created, Approval granted, etc.)
   - [ ] Dates format correctly (e.g., "10/3/2026 at 2:30:45 PM")

### Test Responsive Layouts

1. **Mobile (375px):**
   ```bash
   # In browser DevTools, set viewport to 375x812
   ```
   - [ ] Sidebar collapses to horizontal nav strip
   - [ ] Stage cards stack vertically (1 column)
   - [ ] Tab navigation readable
   - [ ] Touch-friendly spacing

2. **Tablet (768px):**
   - [ ] Stage cards in 2-column grid
   - [ ] Sidebar sidebar visible
   - [ ] All content accessible without horizontal scroll

3. **Desktop (1280px):**
   - [ ] Stage cards in 3-column grid
   - [ ] Sidebar on left
   - [ ] Full header visible

---

## Phase 3: Build Stage Detail Pages (2-3 hours)

Each of the 9 stages should have a detail view. Pattern:

**Files to create:**
```
app/dashboard/releases/[id]/playbook/request/page.tsx
app/dashboard/releases/[id]/playbook/readiness/page.tsx
app/dashboard/releases/[id]/playbook/playbook/page.tsx
app/dashboard/releases/[id]/playbook/risk/page.tsx
app/dashboard/releases/[id]/playbook/approval/page.tsx
app/dashboard/releases/[id]/playbook/execution/page.tsx
app/dashboard/releases/[id]/playbook/validation/page.tsx
app/dashboard/releases/[id]/playbook/evidence/page.tsx
app/dashboard/releases/[id]/playbook/closure/page.tsx
```

**Template for each** (example: REQUEST stage):

```typescript
// app/dashboard/releases/[id]/playbook/request/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function ReleaseRequestDetailPage() {
  const params = useParams();
  const releaseId = String(params.id);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboard/release-playbook/${releaseId}`, { credentials: "include" })
      .then(r => r.json())
      .then(j => { if (j.ok) setData(j.data); })
      .finally(() => setLoading(false));
  }, [releaseId]);

  if (loading) return <div>Loading…</div>;
  if (!data) return <div>No data</div>;

  return (
    <div className="relative">
      <Link href={`/dashboard/releases/${releaseId}/playbook`} className="text-[12px] text-zinc-400 mb-6">
        ← Back to playbook
      </Link>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
        <h1 className="text-[24px] font-bold text-white mb-4">Request Stage</h1>

        <dl className="space-y-3 text-[13px]">
          <div>
            <dt className="text-zinc-400 mb-1">Summary</dt>
            <dd className="text-white">{data.request.summary || "(no summary)"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 mb-1">Owner</dt>
            <dd className="text-white">{data.request.owner || "(unknown)"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 mb-1">Target Environment</dt>
            <dd className="text-white">{data.request.targetEnvironment || "(no target)"}</dd>
          </div>
          <div>
            <dt className="text-zinc-400 mb-1">Planned Window</dt>
            <dd className="text-white">
              {data.request.plannedWindowStart
                ? `${new Date(data.request.plannedWindowStart).toLocaleString()} → ${new Date(data.request.plannedWindowEnd).toLocaleString()}`
                : "(no planned window)"}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
```

**Key point:** Keep each detail page focused on that stage only. Use the unified endpoint data but show full details + related audit events.

---

## Phase 4: Update Demo Scenarios (30 min)

**File:** `lib/demo/demoScenarios.ts`

Per CLAUDE.md living-docs rule: When you change dashboard surfaces, update demo scenarios.

**What to add:**
```typescript
// In DEMO_SCENARIOS array:
{
  id: "release_playbook_approval",
  title: "Release approval workflow",
  audience: "internal_only",  // Keep this internal
  steps: [
    {
      id: "release_playbook_step_1",
      surface: "/dashboard/releases/[id]/playbook",
      action: "View release playbook with all 9 stages",
    },
    {
      id: "release_playbook_step_2",
      surface: "/dashboard/releases/[id]/playbook",
      action: "Switch to 'What needs attention?' tab to see blockers",
    },
    {
      id: "release_playbook_step_3",
      surface: "/dashboard/releases/[id]/playbook",
      action: "Switch to 'What changed?' tab to see timeline",
    },
  ],
  approval: "internal",  // Or your org's approval mechanism
  lastReviewed: "2026-10-03",
},
```

**Validate:**
```bash
npx vitest run lib/demo/__tests__/demoScenarios.test.ts
```

---

## Phase 5: Website Audit (30 min - 2 hours)

**Requirement 3:** Verify visual consistency across public pages.

**Pages to check:**
1. `/` — homepage
2. `/product` — capabilities claims
3. `/pricing` — plan limits
4. `/security` — monitoring/security surface claims
5. `/download` — desktop app pairing UI
6. `/docs` — setup documentation

**Checklist for each page:**
- [ ] Header/footer consistent
- [ ] Color palette matches (violet, emerald, amber, rose)
- [ ] Typography scales correctly (heading sizes, line heights)
- [ ] Spacing consistent (padding, gaps)
- [ ] Buttons have consistent styling
- [ ] Icons from Heroicons library
- [ ] Responsive on mobile (375px), tablet (768px), desktop (1280px)
- [ ] No false claims about features
- [ ] All external links work
- [ ] Dark mode rendering correct

---

## Phase 6: v0.1.12 Desktop Build Fix (2-4 hours)

**Status:** All 4 platforms failing (macOS arm64, macOS intel, Windows x64, Linux x64)

**Diagnosis:** Likely transient npm/Tauri environment issue, not code issue.

**Steps:**
1. Checkout latest `main` branch in `/desktop` directory
2. Run on clean machine:
   ```bash
   cd desktop
   rm -rf node_modules package-lock.json
   npm install
   npm run build
   npx tauri build -- --target aarch64-apple-darwin
   ```
3. If same failure: check Tauri GitHub issues for v0.1.x
4. If different failure: fix and retry
5. Once successful: tag and push `desktop-v0.1.12`

**Expected:** All 4 platform binaries with valid signatures + GPG detached signatures.

---

## Testing Order

1. **Immediate (5 min):** TypeScript check: `npx tsc --noEmit`
2. **Quick (15 min):** Run tests: `npx vitest run`
3. **Integration (30 min):** Browser test with dev server
4. **Responsive (20 min):** Test on 3 viewport sizes
5. **Real data (30 min):** Run with staging database
6. **Production check (10 min):** Type-check against production types

---

## Known Issues & Workarounds

| Issue | Workaround |
|-------|-----------|
| Stage cards don't show real data | Ensure backend TODOs 1-5 are completed |
| Mobile layout broken | Check ReleasePlaybookStageCard grid classes |
| Approval counts wrong | Verify AxiomApprovalRequest schema matches query |
| Demo scenario fails validation | Run `npx vitest run lib/demo/__tests__/` to see error |

---

## Files Ready to Merge

- ✅ `app/api/dashboard/release-playbook/[id]/route.ts` — Needs TODOs completed
- ✅ `app/dashboard/releases/[id]/playbook/page.tsx` — Complete
- ✅ `components/dashboard/ReleasePlaybookStageCard.tsx` — Complete
- ✅ `PROGRESS-SESSION.md` — Reference document
- ✅ `.github/workflows/desktop-release.yml` — Version validation added

---

## Success Criteria

- [ ] Playbook page loads without errors
- [ ] All 9 stage cards display with correct data
- [ ] "What needs attention?" tab works
- [ ] "What changed?" tab shows timeline
- [ ] Mobile responsive (375px)
- [ ] Tablet responsive (768px)
- [ ] Desktop works (1280px)
- [ ] TypeScript passes
- [ ] Tests pass
- [ ] Demo scenarios updated and validated

---

**Next Steps:** Start with Phase 1 (Backend TODOs), then test in Phase 2. Branch ready to merge after phases 1-2.
