# Compliance Control Mapping

**This is not a certification, and nothing in this document or in
`lib/compliance/controlRegistry.ts` should ever be read as one.** Axiom
Agent does not hold SOC 2, ISO 27001, HIPAA, HITRUST, FedRAMP, CMMC, or PCI
certification. Where a control is described as "aligned with" a framework,
that means it structurally matches a reference control in that framework —
never that an independent auditor has certified it.

## Source of truth

`lib/compliance/controlRegistry.ts` (`CONTROL_REGISTRY`, 570 lines as of this
writing) is the canonical, single list — the Trust Center, the security
review exporter, the copilot's enterprise-question answerer, and the audit
bundle generator all read from it. This document does not duplicate its
contents by hand (duplicated control text drifts out of sync with the code
the moment either one changes); it explains how to read it and adds the two
dimensions the registry's own schema doesn't yet enforce: a testing cadence
and an honest gap summary.

### Reading a control entry

Each `ComplianceControl` has:
- `status`: `implemented | partial | planned | not_applicable` — reflects
  actual code state, never aspiration.
- `evidence`: typed sources (`code_module`, `api_route`, `test_suite`,
  `audit_event_type`, etc.) with a file/route reference — the literal thing
  a reviewer would go open.
- `owner`: which subsystem layer is accountable (`security_layer`,
  `audit_layer`, `execution_layer`, etc.) — not a named person, since
  ownership here means "which code owns enforcing this," matching how this
  codebase's actual module boundaries work.
- `frameworkAlignments`: honest "aligned with" labels only.
- `lastVerifiedAt`: ISO timestamp of last manual verification — **see gap
  below, this field exists but is not yet populated anywhere.**

## Current counts (as of this writing — re-run `grep -c` against the
registry before trusting this table; it is a snapshot, not a live view)

| Status | Count |
|---|---|
| `implemented` | 15 |
| `partial` | 3 |
| `planned` | 1 |
| `not_applicable` | 0 |

## Known gaps (named, not hand-waved)

- **`ti.scope.required`** (tenant scope required for every customer-data
  query) — `partial`. The pattern is enforced in most routes but the
  registry itself marks this incomplete; do not read any single clean
  example in this codebase as proof of universal coverage.
- **Append-only audit log for sensitive actions** — `partial`. Audit writes
  exist and are extensive (`lib/audit/secureAudit.ts`), but the registry
  does not yet claim full append-only enforcement (e.g. DB-level
  insert-only constraints) across every table that should have it.
- **Desktop binaries signed + notarized before public distribution** —
  `planned`. Not yet implemented; do not describe desktop downloads as
  notarized until this control's status changes in the registry itself.
- **Dependency vulnerability scanning** — `partial`.
- **Testing cadence does not exist yet.** `lastVerifiedAt` is a real field
  on every control but is populated on **zero** of the current entries —
  every control's "implemented" status rests on the code review that added
  it, not on a recurring re-verification. See proposed cadence below.

## Proposed testing cadence (design only — not yet practiced)

A control's `status: "implemented"` claim should decay without a periodic
re-check — code drifts. Proposed minimum cadence, to be enforced by a
scheduled job once built (none exists yet):

| Category | Re-verify every |
|---|---|
| `access_control`, `tenant_isolation` | 30 days |
| `audit_logging`, `approval_enforcement`, `policy_enforcement` | 30 days |
| `credential_security`, `secret_redaction`, `connector_security` | 30 days |
| `ai_safety`, `desktop_security`, `release_security` | 60 days |
| `reliability`, `incident_recovery`, `data_export`, `supply_chain` | 90 days |

Re-verification means: the control's `evidence` entries are re-read against
current code (not just re-stamped), and `lastVerifiedAt` is only updated if
they still hold. A control whose evidence no longer matches reality should
be moved to `partial` or `planned`, not left at `implemented` with a stale
timestamp.

## Recovery and incident-response evidence (gap, not yet built)

There is currently no dedicated incident-response runbook or recovery
evidence model in this codebase distinct from the existing rollback-plan
generation (`lib/axiom/rollbackPlanner.ts`, itself plan-only — see
`DEPLOYMENT-REHEARSAL-SPEC.md`/this session's `applyEngine.ts` work) and the
general `AuditEvent` trail. A real incident-response control would need:
an `IncidentRecord` model (detected-at, declared-at, severity, affected
tenants, resolution, postmortem link), a closed-union incident status
(`detected | investigating | mitigated | resolved | postmortem_complete`),
and audit events at each transition — none of which exist today. Tracked
here as a named gap, not fabricated as a registry entry with no evidence.

## Access lifecycle (depends on Enterprise Identity Design)

Full access-lifecycle control (onboarding, role change, offboarding,
emergency revocation) for SSO-provisioned identities depends on
`docs/ENTERPRISE_IDENTITY_DESIGN.md` shipping first — today's lifecycle is
limited to `OrgMembership.acceptedAt`/manual removal, which the registry
should describe honestly as the current, narrower scope until that design
is implemented.
