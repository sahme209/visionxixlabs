# Product Vision

Last updated: 2026-10-01

## Authority

The unchanged 36-section **MASTER BUILD PROMPT — TAURI DEPLOYMENT OPERATIONS PLATFORM** is the baseline specification. It must be stored verbatim at `docs/MASTER_BUILD_PROMPT_TAURI_DEPLOYMENT_OPERATIONS_PLATFORM.md` when the source attachment is available. This file records later decisions; it does not replace or shorten the master specification.

## Mission

The deployment request becomes the deployment playbook. An engineer unfamiliar with a deployment must be able to understand scope and rationale, confirm affected applications/clients/repositories/environments, verify readiness and authority, identify the production trigger, execute exact manual and automated steps, validate production, preserve evidence, troubleshoot/escalate/roll back, manage deferred validation, close under policy, and export a complete versioned audit-ready runbook.

## Delivery model

- Customers use the downloadable desktop application.
- The public website explains the product, provides an isolated labeled demonstration and documentation, and distributes verified installers.
- Direct browser sign-in opens a lightweight signed-in Axiom companion for account status, no-charge pilot access, installation, integration guidance, settings guidance, and help. It is not an operational control plane.
- The installed desktop application remains the only customer surface for governed release records, approvals, connection management, execution guidance, validation, and closure.
- Shared services, databases, identity providers, and secure system-browser authentication redirects support both the companion and desktop pairing. Browser account creation remains desktop-initiated and bound to a short-lived device challenge.
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
9. A recognized identity, a paired desktop session, pilot entitlement, and production authority are separate states. Account creation never grants operational access by itself.
10. Early Axiom access is invite-only and no-charge while the governed deployment workflow is proven with design partners. No fixed self-serve price, credit-card checkout, or promise of unrestricted production authority is advertised.

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

## Current refinement objectives · 2026-10-02

These objectives extend the existing mission; they do not authorize a redesign, a renaming, or a claim beyond the evidence available in the released build.

1. **Governed Playbook story.** Make the Playbook the center of the product: **Intent → Playbook → Govern → Execute → Prove**. The public story and desktop workflow should make one deployment understandable from request through readiness, risk, approval, validation, evidence, and closure.
2. **Security-first product discipline.** Treat every integration, identity handoff, provider credential, release decision, and evidence record as a least-authority boundary. Require explicit human authority for any consequential action; default to read-only validation; expire and consume consent state once; encrypt provider credentials; record meaningful audit facts; and fail closed rather than simulate production success.
3. **Regulated-environment readiness.** Build practical controls and evidence suitable for customers in healthcare, defense, and other high-assurance environments: tenant isolation, human approval, credential boundaries, change evidence, revocation, retention review, and independent verification of deployed behavior. Do not describe Axiom as HIPAA compliant, CMMC compliant, FedRAMP authorized, military certified, or certified under any framework unless the exact approved evidence exists.
4. **Truthful integration delivery.** GitHub is the first release-evidence source and remains repository-scoped and read-only until a separately authorized capability is verified. Slack, Microsoft, AI providers, CI/CD, ticketing, observability, and cloud systems must each have a dedicated lifecycle: consent, minimum scope, tenant binding, live validation, status, revocation, audit, and external-provider testing before the interface calls them connected.
5. **Deployment rehearsal investigation.** Explore isolated pre-production rehearsal for dependencies, Terraform plans, policies, secrets, rollback artifacts, and other appropriate checks. Do not call it a sandboxed execution environment until tenancy isolation, egress/resource control, secret handling, no-production-credential defaults, evidence, and failure tests prove the boundary.
6. **Calm, original product experience.** Keep Axiom's dark, minimal visual identity and strong existing components. Use Cursor only as a quality benchmark—not as a source for copied layout, art, motion, or language. Reduce visual noise, use progressive disclosure, and make believable Axiom states guide the eye through one governed release story.
7. **One product story everywhere.** Keep homepage, Product, Capabilities, Architecture, Security, Docs, Download, Changelog, FAQ, Pricing, mobile navigation, signed-in companion, and desktop behavior aligned. Preserve what works; classify changes as Keep, Refine, Consolidate, or Fix before altering a surface.
8. **Verification before promotion.** Before a consolidated release, run the available build/tests and check desktop/mobile navigation, CTAs, accessibility, performance, installer behavior, and capability accuracy. A passing source check is not a substitute for a clean-host desktop launch or an end-to-end provider verification.
