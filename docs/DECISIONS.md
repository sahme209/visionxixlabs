# Decisions

Last updated: 2026-09-27

| ID | Decision | Status | Evidence / consequence |
| --- | --- | --- | --- |
| ADR-001 | Customer product is downloadable desktop software. | Active; supersedes hosted-web delivery | Website may market, document, demo in isolation, and distribute installers; no customer browser product or website sign-in. |
| ADR-002 | Master specification remains authoritative and must be preserved verbatim. | Active | Source attachment is not currently present in repository; subsection reconciliation is blocked until reattached. |
| ADR-003 | Current product identity is Axiom Agent; do not casually rename it to TAURI. | Active pending owner confirmation | `desktop/package.json`, `desktop/src/App.tsx`, dated delivery audit, and release naming use Axiom Agent. |
| ADR-004 | “TAURI” did not mandate the Rust Tauri framework. | Active clarification | It does not itself require a re-platform. |
| ADR-005 | Tauri 2 + React/Vite/Rust is the recorded implementation choice. | Existing decision, not re-approved in this pass | `desktop/README.md` calls it locked and documents reasons. Revisit only with an explicit replacement ADR. |
| ADR-006 | Website demo data is isolated and fictional. | Active | `CLAUDE.md` requires sandbox workspace guards; production paths must fail honestly. |
| ADR-007 | Consequential operations use durable IDs and idempotency keys and reconcile uncertain outcomes before retry. | Added in this pass; provider integration pending | Reliability policy, coordinator, Prisma repository/schema/migration, and focused tests exist. The migration and live provider wiring remain unverified. |
| ADR-008 | Closing the app does not cancel possibly dispatched external work. | Active | Queued local work may cancel locally; attempted/unknown/running work requires continued shared-service observation and provider reconciliation. |
| ADR-009 | Permission and trigger distinctions are modeled separately. | Active | Template capability lists distinguish PR approval, merge, workflow run, environment approval, release, and change authority. UI/service enforcement needs journey-level verification. |
| ADR-010 | No final-release claim without exact packaged-build verification. | Active | Published 0.1.7 predates the most recently audited repair tree; native packaging and installed journeys were blocked in the prior report. |
| ADR-011 | Generating a playbook is a record-creation action, not deployment authorization or execution. | Active | The desktop/API persist a hashed version and audit event, and explicitly state that no merge, release, dispatch, or environment approval occurred. |
| ADR-012 | Public availability claims use the conservative capability coverage map and exact release evidence. | Active | Connector code, customer configuration, preview analysis, live execution, and certification are separate statuses. Marketing registry labels cannot override verification evidence. |
| ADR-013 | Durable contact acceptance and email delivery are reported separately. | Active | A stored lead/reference may succeed while notification delivery is failed or unconfigured; the UI must disclose that state and promise no response time. |
| ADR-014 | Unverified social proof is prohibited. | Active | No customer logo, testimonial, adoption figure, certification, active audit, or commercial entitlement is published without approval and supporting evidence. |

## Superseded instructions

- Any instruction that the customer application is delivered as a hosted web application.
- Any website CTA or copy implying that the browser dashboard is the customer product.
- Any interpretation that the word TAURI alone selects a desktop framework.

## Open decisions

- Product-owner confirmation of the Axiom Agent name versus the original TAURI title.
- Supported OS/platform matrix for the first production release.
- Shared-service ownership and persistence technology for the operation ledger.
- Approved identity provider and native PKCE/deep-link design.
- Policy for whether a deferred-validation change may close before follow-up completion.
