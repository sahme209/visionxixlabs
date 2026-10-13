# ADR: Web governance, desktop operations, backend enforcement

Status: Accepted for incremental implementation. This ADR does not enable a production route or migrate customer data.

## Context

Axiom currently has three overlapping surfaces: a reachable account companion, a desktop engineering workspace, and legacy `/dashboard` pages that middleware redirects to `/download`. Some legacy dashboard pages contain static demonstration state. Enabling that namespace wholesale would expose unauthoritative data and create a second operations interface.

The desktop already uses bearer-token desktop sessions and operational APIs. Browser administration uses server-side browser identity. Protected writes are executed by backend responders and connectors. These boundaries must become explicit without replacing working integrations or duplicating data.

## Decision

- The signed-in website is the organization governance control plane.
- The desktop is the engineering operations workspace.
- The backend is the only authorization, policy, quota, credit, approval, credential, execution, and audit authority.
- A client may display status from another surface, but it cannot become the enforcement boundary.
- New governance pages will live under `/control`. The legacy `/dashboard` and `/operator` namespaces remain closed until audited; static demonstration state is never promoted into the authenticated product.
- Website governance and desktop operations reuse existing organization records, integrations, policies, and APIs. There is no parallel organization or policy store.

The executable ownership registry is `lib/platform/capabilityOwnership.ts`.

| Capability | Website | Desktop | Backend |
|---|---|---|---|
| Organization, members, roles, sessions | Configure | Show current access | Authenticate, authorize, revoke |
| Repository access | Approve repositories and policy | Browse, edit, branch, commit, PR | Scope tokens and enforce actions |
| Integrations | Consent, scopes, revoke, health | Use approved connection | Store/refresh scoped credentials |
| Environments | Targets, restrictions, approval rules | Select permitted target and request work | Enforce isolation and policy |
| AI and agents | Models, identities, autonomy, budgets | Select approved model; initiate work | Meter, authorize tools, execute |
| Billing and credits | Plans, seats, wallet, transactions | Read-only allowance status | Reserve, settle, enforce |
| Approvals | Central inbox and policy administration | Request and show operational context | Validate decision and prevent replay |
| Audit and security | Search, export, sessions, events | Task-local evidence | Append authoritative evidence |
| Autonomous workflows | Configure bounded authority | Start/cancel/show status | Persist, resume, retry, cancel, recover |

## Enforcement services

Existing enforcement remains in place while being consolidated behind common decisions:

- Browser identity and organization context: `currentContext()` and authenticated server routes.
- Desktop identity: `resolveRequestDesktopSession()` and organization-scoped bearer sessions.
- Policy: `lib/security/permissionEngine.ts` plus domain policy responders.
- Agent governance: `governedAiCall`, the tool registry, action proposals, and approval responders.
- Execution: backend GitHub, AWS, Airflow, and other connector responders; clients do not receive provider credentials.
- Financial controls: deployment quota reservations, organization entitlements, AI credit reservations, and authoritative Gateway settlement.
- Evidence: secure audit services and persisted action/approval records.

Every protected route must reconstruct identity and organization scope, evaluate policy, validate an unexpired approval when required, reserve quota/credits idempotently, execute through a scoped connector, and append outcome evidence. UI visibility is not authorization.

## Durable autonomous workflow model

Persistent agents use an explicit server-side state machine:

`received -> planning -> policy_check -> awaiting_approval|awaiting_dependency -> authorized -> executing -> observing -> completed|recovering|failed|cancelled`

Each transition records organization, agent identity, objective, policy decision, tool scope, idempotency key, attempt, deadline, and actor. Workers use leases and heartbeats; expired leases may be reclaimed without duplicating an external write. Approval records bind to the exact action digest and expire. Cancellation and revocation are checked before every transition and external call. Recovery and rollback are separate authorized actions, never model discretion alone.

## Migration

1. Keep `/dashboard` and `/operator` redirected. Inventory and remove static authenticated product state.
2. Build `/control` with real organization data only: Overview, Governance, AI & Agents, Integrations, Usage & Billing, Audit & Security.
3. Make web governance APIs the single administration path while desktop settings remain compatible and become read-only status plus deep links.
4. Migrate administrative desktop sections one capability at a time; preserve operational model/repository/environment selectors.
5. Add durable workflow persistence and workers behind existing proposal/approval contracts.
6. Remove transitional writes only after authorization parity, migration, rollback, and end-to-end tests pass.

Existing organization IDs and records remain authoritative. Migrations are additive and backward compatible. No live billing, production route, integration credential, or desktop release changes occur without explicit approval.

## Enterprise onboarding

An administrator creates or joins an organization on the web, establishes identity/session policy, grants repository and integration scopes, configures environments, approves models/budgets, and invites members. Engineers pair the desktop to that organization and receive only the policies and resources permitted to them. Revocation invalidates server sessions and scoped credentials; the desktop cache cannot preserve authority.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Two sources of truth during migration | One backend record; transitional clients read the same APIs |
| Legacy fictional dashboard data | Keep namespace closed; require real-data acceptance tests for `/control` |
| Browser/desktop auth drift | Shared organization authorization tests for equivalent actions |
| Stale desktop permissions | Short-lived sessions, policy version checks, server enforcement |
| Approval replay | Action digest, expiry, organization binding, single-use execution key |
| Agent runaway or duplicate writes | Bounded tools, budgets, leases, idempotency, cancellation checks |
| Local secret exposure | OS vault for session only; provider credentials remain server-side |
| Broader web attack surface | CSRF protection, secure cookies, CSP, rate limits, audit and session revocation |

## Acceptance gates

- No authenticated portal metric is static or invented.
- Organization isolation and equivalent web/desktop authorization tests pass.
- Direct API and approval-replay bypass tests pass.
- Session, device, credential, and agent revocation stop the next protected transition.
- Concurrent quota/credit reservations and external dispatches remain idempotent.
- Desktop administrative controls are removed only after the matching web control is functional.
- Autonomous recovery is demonstrated from persisted state without an open desktop.
- Accessibility, keyboard navigation, responsive layouts, and empty/error states are verified.

