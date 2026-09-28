# Product Vision

Last updated: 2026-09-28

## Authority

The unchanged 36-section **MASTER BUILD PROMPT — TAURI DEPLOYMENT OPERATIONS PLATFORM** is the baseline specification. It must be stored verbatim at `docs/MASTER_BUILD_PROMPT_TAURI_DEPLOYMENT_OPERATIONS_PLATFORM.md` when the source attachment is available. This file records later decisions; it does not replace or shorten the master specification.

## Mission

The deployment request becomes the deployment playbook. An engineer unfamiliar with a deployment must be able to understand scope and rationale, confirm affected applications/clients/repositories/environments, verify readiness and authority, identify the production trigger, execute exact manual and automated steps, validate production, preserve evidence, troubleshoot/escalate/roll back, manage deferred validation, close under policy, and export a complete versioned audit-ready runbook.

## Delivery model

- Customers use the downloadable desktop application.
- The public website explains the product, provides an isolated labeled demonstration and documentation, and distributes verified installers.
- There is no customer-facing browser product and no website sign-in.
- Shared services, databases, identity providers, and secure system-browser authentication redirects may support the installed app.
- Closing the desktop app does not imply cancellation of work already running externally.
- Production state must never silently fall back to demo data or simulated success.

## Users

Requesters, deployment engineers, application owners, technical validators, functional validators, approvers, change managers, auditors, tenant administrators, support/escalation owners, and authorized integration operators.

## Product boundaries

Axiom Agent is a deployment-operations product, not a generic dashboard, chatbot, ticket tracker, autonomous cloud executor, or collection of unrelated AI screens. Every surface must support the governed request-to-playbook-to-closure mission or be explicitly secondary/internal.

Private organizations, repositories, groups, clients, and operational examples are tenant configuration. Public documentation and demos use fictional data only.

## Authoritative later decisions

1. Desktop delivery supersedes hosted-web delivery.
2. “TAURI” in the original title is a product name, not a framework mandate.
3. Existing records identify the current customer-facing name as **Axiom Agent** and the package as `axiom-desktop` 0.1.7. This is a discrepancy with the master title, not authorization to rename.
4. The repository separately records a deliberate Tauri 2 framework decision in `desktop/README.md`. Keep it unless a new architecture decision supersedes it.
5. Preserve the approved Axiom visual design and working behavior.
6. Release Compliance Automation and Root Cause Analysis are separate concepts.
7. Approval, merge authority, workflow dispatch, environment approval, release publication, tags, and deployment triggers remain separate configurable controls.
8. Completed with Deferred Validation is not fully validated completion.
9. A recognized identity, a paired desktop session, and paid production access are separate states. Account creation never grants operational access by itself.
10. Until the product owner approves fixed prices and production payment configuration is verified, Axiom production access is contract-scoped through the durable contact path; no invented self-serve price or free tier is offered.

## Responsibility split

| Responsibility | Local desktop | Shared service | External system |
| --- | --- | --- | --- |
| Guided operator experience, secure local session, cached read models | Yes | No | No |
| Durable tenant records, audit, policies, playbook versions, operation ledger | Cached only | Yes | No |
| Authorization and separation-of-duties decisions | Display/enforce current decision | Authoritative | Identity/SCM facts |
| Merge, release, workflow, change, environment actions | Initiates only after gates | Coordinates/idempotency | Performs action |
| Long-running observation and reconciliation | Resumes after reconnect | Durable observer | Authoritative status |
| Credentials | OS secure storage for user-bound tokens only | Server-side secrets where required | Provider |
| Website demonstration | No | Isolated sandbox data | No |

## Non-negotiable truthfulness

Implementation and verification are separate. Mock, sandbox, provider-sandbox, and live results must be labeled distinctly. A screen, button, toast, generated message, or passing pure test is not proof of a persisted authorized integration outcome.

Public claims follow the same rule. Connector code does not imply a configured customer connection; a configured connection does not imply live discovery; discovery does not imply execution authority; product control mapping does not imply an independent certification. The current claim-to-evidence policy is recorded in `docs/CLAIM_EVIDENCE_MAP.md`.
