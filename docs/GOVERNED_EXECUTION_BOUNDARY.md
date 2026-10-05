# Governed Execution Boundary — Prerequisites and Canonical Contract

Status: **design only. No real cloud mutation is enabled by this document.**
`TERRAFORM_LEGACY_APPLY_ENABLED` and `AWS_IAM_MUTATION_ENABLED` remain
default-deny. This document does not change that. It defines what must be
true before any live execution path is allowed to flip from "simulated" to
real, and the one contract every such path must implement identically.

## Why one canonical contract, not one per action type

This codebase currently has three independent places that each reinvent a
version of "is this action allowed to run for real":

1. `lib/terraform/runner.ts` — `legacyApplyEnabled()`, env-var gated, route
   returns 403 `legacy_apply_disabled` before ever calling `terraformApply()`.
2. `lib/plugins/aws/disable-unused-access-key.ts` — `legacyIamMutationEnabled()`,
   same shape, independently implemented.
3. `lib/axiom/applyEngine.ts` — no kill-switch at all; every handler is
   unconditionally `simulated: true` because nothing has ever been wired to
   a real SDK call in the first place.

Three independent implementations of the same safety property is itself a
risk — the next one added by habit, not by this contract, could get it
wrong. This document is the single contract all three (and any future
execution path) must satisfy before real execution is permitted.

## The six prerequisites (all six, not some)

A code path may only transition from `simulated`/`blocked` to real
execution once **all** of the following exist and are CI-tested:

1. **Tenant authorization** — the caller's `organizationId` is verified to
   own the target resource (cloud account, repository, IAM principal)
   through a real, queried binding — never inferred from the request body,
   never a client-supplied identifier taken at face value (this is exactly
   the class of bug fixed this session in `app/api/github/sync/route.ts`).
2. **Role check** — the caller's `OrgRole` (or, once it ships, their
   SSO-mapped role per `docs/ENTERPRISE_IDENTITY_DESIGN.md`) is checked
   against a named minimum role for this specific action class — not just
   "is authenticated."
3. **Explicit human approval** — a real, persisted approval record exists
   for this specific action, with an identified approver distinct from the
   requester, following the existing `AxiomApprovalChain` pattern already
   used for releases. A approval UI that defaults to "approved" or infers
   consent from inaction does not satisfy this.
4. **Environment safeguards** — the target is confirmed non-production, or
   production execution has its own additional, stricter gate (e.g. a
   second approver, a maintenance-window check) — modeled on
   `isSandboxWorkspace`/`assertNotDemoLeak`'s existing workspace-kind
   pattern, extended to "is this execution target itself a production
   resource."
5. **Immutable evidence** — a `correlationId`-bearing audit event is written
   *before* the mutating call fires (intent) and again after (outcome),
   following `lib/audit/secureAudit.ts`'s existing `AuditAction` closed
   union — new action names added there, never a loose string.
6. **Rollback/recovery + post-execution validation** — a rollback plan
   exists and has itself been validated as executable (not just generated
   text, per the `rollbackPlanner.ts` honesty gap noted in
   `docs/COMPLIANCE_CONTROL_MAPPING.md`), and a real post-execution read
   confirms the intended end state — not the `verifyAppliedAction()` stub
   fixed to `not_verified` this session, a genuine tenant-bound read.

## The canonical kill-switch contract

Every execution path must implement this exact shape — copied from the
Terraform kill-switch, the one implementation that's been through
hardening, tests, and a real production verification:

```ts
// 1. A named, exported, pure predicate. No inline env checks scattered
//    through the route.
export function <action>Enabled(): boolean {
  return process.env.<ACTION>_ENABLED === "true"; // exact-match "true" only
}

// 2. Gate at the route/entry-point layer, BEFORE any of the six
//    prerequisites are even evaluated, let alone the real SDK call.
if (!<action>Enabled()) {
  const correlationId = `<action>_block_${crypto.randomUUID()}`;
  await logAudit({ action: "<domain>.blocked_kill_switch", correlationId, reasonCode: "<action>_disabled", ... });
  return NextResponse.json(
    { success: false, code: "<action>_disabled", error: "...", correlationId },
    { status: 403 },
  );
}

// 3. Only past this point do the six prerequisite checks run, then the
//    real call. Tests must prove the SDK/mutation function is NEVER
//    constructed or invoked when the switch is off — not just that the
//    HTTP response looks right.
```

## What "ready to flip the switch" looks like in a PR

A PR proposing to enable any real execution path must include, in the PR
description, a checklist against the six prerequisites above with a file:line
citation for each one — not a prose assertion that they're "handled." CI
must contain a test for each prerequisite proving the negative case (missing
approval → blocked; wrong role → blocked; cross-tenant resource → blocked)
in addition to the positive case. Absent that evidence, the PR should not
be approved regardless of how contained the blast radius looks.

## Explicitly not addressed here

This document does not propose enabling any specific execution path. The
next real decision point is: which single, lowest-risk action (likely AWS
read-only-adjacent, e.g. a tag-only mutation) is worth building all six
prerequisites for first, once a safe test/pilot cloud account exists to
validate against. That is a separate, later decision — not a byproduct of
writing this contract.
