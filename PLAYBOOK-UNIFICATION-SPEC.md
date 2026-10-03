# Playbook Unification Specification

**Objective:** Make the Playbook the center of Axiom, unifying the entire release journey in one visual, progressive-disclosure experience.

**Current State:**
- Release list: `/dashboard/releases` (lists with metadata)
- Release detail: `/dashboard/releases/[id]` (shows metadata, readiness, cherry-picks, violations, evidence)
- Separate pages: readiness, advisor, freeze, notes, audit
- Playbook view: Does NOT exist yet; needs creation

**Target State:**
One unified release playbook showing the complete journey:
```
REQUEST → READINESS → PLAYBOOK → RISK → APPROVAL → EXECUTION → VALIDATION → EVIDENCE → CLOSURE
```

---

## Data Model

### Unified Release Record
```typescript
interface UnifiedReleasePlaybook {
  // Identity
  id: string
  releaseTag: string | null
  commitSha: string | null
  repository: { id: string; displayName: string; provider: string }
  
  // Journey Timeline
  lifecycle: {
    requestedAt: Date
    requestedBy: string
    scopeFinalizedAt: Date | null
    readinessScoredAt: Date | null
    playbookApprovedAt: Date | null
    riskReviewedAt: Date | null
    approvalGrantedAt: Date | null
    executionStartedAt: Date | null
    validationCompleteAt: Date | null
    evidenceSignedAt: Date | null
    closedAt: Date | null
  }
  
  // Content by Stage
  request: {
    summary: string
    intent: string
    owner: string
    targetEnvironment: string
    plannedWindowStart: Date
    plannedWindowEnd: Date
  }
  
  readiness: {
    overallScore: number
    riskLevel: "low" | "medium" | "high" | "critical"
    blockerCount: number
    topBlockers: BlockerItem[]
    evaluatedAt: Date
  }
  
  playbook: {
    proposedSteps: PlaybookStep[]
    cherryPickRequests: CherryPick[]
    policyViolations: PolicyViolation[]
    changeTickets: TicketLink[]
    rollbackContext: RollbackPlan | null
  }
  
  risk: {
    blastRadius: "low" | "medium" | "high" | "critical"
    affectedServices: ServiceImpact[]
    dependencies: ReleaseDependency[]
    assumptions: string[]
    reviewedAt: Date
  }
  
  approval: {
    required: ApprovalRequirement[]
    granted: ApprovalRecord[]
    exceptions: ExceptionWaiver[]
    status: "pending" | "granted" | "conditional" | "denied"
  }
  
  execution: {
    status: "not_started" | "in_progress" | "completed" | "failed" | "rolled_back"
    plannedAt: Date
    startedAt: Date | null
    completedAt: Date | null
    providerAction: {
      provider: "github" | "aws" | "azure" | "gcp" | "other"
      actionId: string
      actionUrl: string
      status: string
      result: unknown
    } | null
  }
  
  validation: {
    plan: ValidationStep[]
    results: ValidationResult[]
    status: "not_run" | "in_progress" | "passed" | "failed"
    completedAt: Date | null
  }
  
  evidence: {
    pack: {
      id: string
      generatedAt: Date
      signedAt: Date | null
      signer: string | null
      contentHash: string
    } | null
    artifacts: EvidenceArtifact[]
    auditTrail: AuditEvent[]
  }
  
  closure: {
    status: "open" | "completed" | "cancelled" | "rolled_back"
    reason: string | null
    closedAt: Date | null
    postmortem: PostmortemLink | null
  }
  
  // Audit & History
  audit: {
    createdAt: Date
    createdBy: string
    updatedAt: Date
    versions: ReleaseVersion[]
  }
}
```

---

## UI Layout: Progressive Disclosure

### Top-Level Navigation
```
[← Back to releases]
[Release Tag]  [Status Badge]  [SHA short]
[Owner]  [Environment]  [Window dates]
```

### Three Progressive Tabs

#### Tab 1: WHAT IS HAPPENING?
Shows the current state in a clear, glanceable format:

```
REQUEST ✓
  Requested: 2 days ago by @alice
  Intent: Roll out new payment processor
  Environment: Production (us-east-1)
  Planned window: Tue 2pm-4pm UTC

READINESS ⚠️
  Score: 87/100 (Good)
  Risk: Medium
  Blockers: 1 (unit test coverage)
  → Open readiness report

PLAYBOOK 📋
  8 proposed steps
  3 cherry-pick approvals pending
  0 policy violations
  → View playbook details

RISK ✓
  Blast radius: Medium (2 services affected)
  Dependencies: 1 internal, 1 external
  → Risk assessment

APPROVAL ⏳
  Waiting for: DevOps lead approval
  1 of 2 approvals granted
  → View approval chain

EXECUTION 🚫
  Not started
  Planned for: Tue 2pm
  → View execution plan

VALIDATION 📊
  Plan ready: 5 checks
  → View validation plan

EVIDENCE 📦
  Pending until execution complete
  → Download preview pack

CLOSURE ⏳
  Release not yet complete
```

#### Tab 2: WHAT NEEDS ATTENTION?
Critical-only view with actionable items:

```
🔴 1 BLOCKER
  Unit test coverage below 80%
  File: src/payment/processor.ts
  [View diff] [Waive] [Extend deadline]

⚠️ 3 PENDING APPROVALS
  DevOps lead: pending 6h
  Security team: pending 12h
  Compliance (auto-waived): ✓ OK
  [Request reminder]

⚠️ EXECUTION WINDOW APPROACHING
  Release window starts in 18 hours
  Current readiness: Ready to proceed
  [Delay window] [Proceed with approval]
```

#### Tab 3: WHAT CHANGED?
Version diff and audit trail:

```
REVISIONS
  v3: 2 hours ago by @alice
    - Updated rollback plan
    - Added 1 cherry-pick request
    [View diff from v2]
  
  v2: 4 hours ago by system
    - Readiness scored
    - 1 blocker cleared
  
  v1: 2 days ago by @alice
    - Request created

AUDIT LOG
  [Latest 10 events showing: what, who, when, why]
  [View full audit (60+ events)]
```

---

## Component Structure

```
/dashboard/releases/[id]/unified-playbook/page.tsx
  ├── PlaybookHeader (tag, status, owner, window)
  ├── ProgressionTimeline (visual: request→closure)
  ├── TabNavigation (What / Attention / Changed)
  ├── TabPane_What
  │   ├── StageCard x 9 (request, readiness, playbook, risk, approval, execution, validation, evidence, closure)
  │   │   ├── StageBadge (✓/⚠️/🔴 status)
  │   │   ├── StageContent (key facts)
  │   │   ├── ActionLinks (deep-link to detail)
  │   │   └── StatusIndicator
  │   └── CallToAction (next step)
  ├── TabPane_Attention
  │   ├── BlockerList
  │   ├── PendingApprovalList
  │   ├── DeadlineWarnings
  │   └── ActionableItems
  └── TabPane_Changed
      ├── RevisionTimeline
      └── AuditLog
```

---

## Stage Details (Expanded Views)

Each stage links to a detailed view showing:

### REQUEST Detail
- Summary / intent
- Owner, environment, window
- Ticket links
- [Edit request]

### READINESS Detail
- Overall score + breakdown
- Risk level + factors
- Top 3 blockers + details
- Deadline extensions
- [Request waiver]

### PLAYBOOK Detail
- Proposed steps (ordered, numbered)
- Per-step: rationale, test plan, rollback
- Cherry-pick requests (with approvals)
- Policy violations (if any)
- [Edit playbook] [Request cherry-pick]

### RISK Detail
- Blast radius assessment
- Affected services + impact
- Dependencies + validation
- Assumptions + unknowns
- [Review with team] [Agree to risk]

### APPROVAL Detail
- Approval chain (who, what role, when needed)
- Per-approval: granted/pending/waived
- Exception waivers (if any)
- Approval history
- [Request approval] [Revoke] [Grant]

### EXECUTION Detail
- Execution plan + timing
- Provider integration (GitHub, AWS, etc.)
- Live status of provider action
- Logs / output from provider
- [Pause] [Resume] [Rollback]

### VALIDATION Detail
- Validation plan (checks to run)
- Per-check: type, expected outcome, owner
- Validation results (if execution complete)
- [View logs] [Re-run]

### EVIDENCE Detail
- Evidence pack preview
- Artifacts (logs, configurations, state)
- Audit trail (all events)
- Signature status
- [Download as MD/JSON] [Sign]

### CLOSURE Detail
- Status (open / complete / rolled_back)
- Completion date + time
- Postmortem link (if failed)
- Final artifacts
- [Mark complete] [Rollback]

---

## Mobile Layout

All stages stack vertically on mobile.
Tab navigation becomes horizontal scroll at bottom.
Expanded details use full-screen modal.

---

## Existing Components to Consolidate

| Existing | Where | Maps to Playbook Stage |
|----------|-------|------------------------|
| `/dashboard/releases/[id]` | Overview | REQUEST |
| `/dashboard/release-readiness` | Sidebar | READINESS |
| `/dashboard/release-advisor` | Sidebar | PLAYBOOK |
| Release detail "cherry-picks" | Modal | PLAYBOOK |
| Release detail "violations" | Modal | PLAYBOOK |
| `/dashboard/release-freeze` | Sidebar | EXECUTION |
| `/dashboard/release-notes` | Sidebar | EVIDENCE |
| `/dashboard/release-audit` | Sidebar | CLOSURE / Audit trail |

---

## Implementation Phases

### Phase 1: Structure (4-6 hours)
- Create unified playbook data fetcher (GraphQL or REST endpoint)
- Build layout / tab navigation
- Create stage-card components
- Wire up "WHAT IS HAPPENING" tab with real data

### Phase 2: Progressive Disclosure (3-4 hours)
- Build "WHAT NEEDS ATTENTION" tab
- Build "WHAT CHANGED" tab
- Add action buttons for common workflows

### Phase 3: Integration (4-6 hours)
- Link to detailed views (expand each stage)
- Merge existing pages into detail views
- Unify approval workflow
- Test with real release scenarios

### Phase 4: Polish (2-3 hours)
- Mobile layout
- Accessibility (keyboard nav, ARIA)
- Performance (lazy-load details)
- Dark mode verification

---

## Success Criteria

- [ ] One unified release detail page at `/dashboard/releases/[id]`
- [ ] Three progressive-disclosure tabs (What / Attention / Changed)
- [ ] All 9 stages visible on one screen (scrollable, mobile-responsive)
- [ ] Status indicators at a glance
- [ ] Action buttons for each stage
- [ ] Deep links to details work smoothly
- [ ] Tested with real release scenarios
- [ ] Mobile layout intentional
- [ ] Accessibility verified (keyboard, screen reader)
- [ ] Performance acceptable (<2s load)

---

## Data Flow

### Fetching Unified Record
```typescript
// Single endpoint returns all stage data
GET /api/dashboard/release-playbook/[id]

Returns: UnifiedReleasePlaybook
(may call multiple internal endpoints server-side)
```

### Mutations (Stage Transitions)
```typescript
POST /api/dashboard/release-playbook/[id]/transition
  { stage: "approval", action: "grant", approverRole: "devops" }

POST /api/dashboard/release-playbook/[id]/update
  { stage: "playbook", field: "proposedSteps", value: [...] }
```

---

## Backward Compatibility

The existing detail pages (`release-readiness`, `release-advisor`, etc.) remain as deep-link targets from the unified playbook. Over time, they can be deprecated as the playbook becomes the primary interface.
