# Decisions

Last updated: 2026-09-29

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
| ADR-010 | No final-release claim without exact packaged-build verification. | Active | The current 0.1.10 source has compile/build evidence and a local ad-hoc app bundle; it is not a verified customer release until release-CI signing/notarization and clean-host journeys pass. |
| ADR-011 | Generating a playbook is a record-creation action, not deployment authorization or execution. | Active | The desktop/API persist a hashed version and audit event, and explicitly state that no merge, release, dispatch, or environment approval occurred. |
| ADR-012 | Public availability claims use the conservative capability coverage map and exact release evidence. | Active | Connector code, customer configuration, preview analysis, live execution, and certification are separate statuses. Marketing registry labels cannot override verification evidence. |
| ADR-013 | Durable contact acceptance and email delivery are reported separately. | Active | A stored lead/reference may succeed while notification delivery is failed or unconfigured; the UI must disclose that state and promise no response time. |
| ADR-014 | Unverified social proof is prohibited. | Active | No customer logo, testimonial, adoption figure, certification, active audit, or commercial entitlement is published without approval and supporting evidence. |
| ADR-015 | A stored desktop credential is not authenticated state until the service verifies it during startup. | Active | Expired, revoked, malformed, or unknown credentials are cleared before the workspace shell and pollers mount. |
| ADR-016 | Browser approval and desktop connection are distinct states. | Active | Pairing challenges expire after ten minutes, require explicit device consent, and can be consumed once; the browser says approved until the installed app retrieves and verifies the session. |
| ADR-017 | Installed-app HTTP traffic uses a native, fixed-origin allowlist. | Active; packaged failure testing pending | The Rust bridge accepts only `/api/*` paths on `https://visionxixlabs.com`, denies redirects and unsupported methods/headers, and provides bounded timeout/failure semantics. The webview CSP and fetch bridge also reject requests to other HTTPS origins. Locked Rust checking and a local 0.1.10 release-app compile pass. |
| ADR-018 | Desktop connector enrollment fails closed until one canonical tenant-scoped management API exists. | Active | The legacy form used an incompatible starter-token browser API and accepted long-lived provider secrets. The candidate exposes verified status only and does not claim connection success. |
| ADR-019 | The installed customer shell exposes only verified mission workflows. | Active | Legacy cloud posture, AGI, billing, simulation, connector-health, synthetic audit, and cookie-auth dashboard screens remain source references but are not imported, rendered, or navigable in the 0.1.8 customer bundle. Missing requirements remain matrix gaps rather than decorative screens. |
| ADR-020 | Demonstration data belongs to the isolated website sandbox, not the installed production workspace. | Active | The desktop sample-mode entry was removed. Authentication is required before the shell mounts, and production errors/empty states never fall back to mock records. |
| ADR-021 | Identity verification does not grant commercial or operational access. | Active | Desktop startup calls `/api/desktop/access`; only a non-trial plan with `active` status mounts the workspace. No-plan, past-due, canceled, and legacy-trial tenants see a dedicated access wall. Deployment desktop APIs and public v1 API-key authentication enforce the same entitlement server-side. |
| ADR-022 | Account creation is desktop-initiated and never creates a free Starter entitlement. | Active | Credentials registration requires a live pairing challenge, explicit Terms/Privacy acceptance, bounded input, a 12-character minimum password, and rate limiting. The previous `plan: "starter"` grant and free-plan copy were removed. Browser pairing may establish identity, after which the installed app displays the commercial access wall. |
| ADR-023 | No self-serve checkout is published without approved commercial terms and verified production payment configuration. | Active | The current public `/plans` page truthfully uses requirements-based access. The access wall opens a durable production-access request. Existing Stripe infrastructure is not treated as verified product checkout evidence. |
| ADR-024 | Installer publication and customer download availability are separate gates. | Active | Release CI proves artifact construction and signing; website distribution also requires the production pairing, session, billing, request, and playbook stores to be readable. Uncertain or unavailable runtime state pauses redirects and returns 503 to machine clients. |
| ADR-025 | Desktop sign-in and account creation use distinct system-browser journeys and return to the installed app through a registered native scheme. | Active; packaged verification pending | The desktop starts a short-lived one-time pairing challenge with an explicit intent, browser auth returns to the same authorization request, and approval opens `axiom-agent://auth/complete`. The native app still retrieves the credential through the one-time status exchange; no credential is placed in the deep link. |
| ADR-026 | Customer Settings expose verified account, plan, workflow-safety, repository-trigger, and integration information—not legacy recovery internals. | Active | API-key paste, pairing JSON, arbitrary cloud-provider defaults, and scan controls were removed from customer Settings. Enterprise recovery credentials remain collapsed on the signed-out screen only. |
| ADR-027 | Optional website measurement requires an explicit privacy choice. | Active | Essential-only is the default until a visitor chooses; Vercel Analytics mounts only after optional consent. The choice is locally persisted and can be reopened. |
| ADR-028 | Desktop billing uses an authenticated one-time hosted portal session, not a browser dashboard page or embedded card form. | Active; live Stripe verification pending | A browser-paired desktop session requests the portal server-side; API-key credentials are rejected; the client accepts only HTTPS Stripe destinations; return to the app triggers entitlement re-verification. Stripe webhook state remains authoritative. |

## Superseded instructions

- Any instruction that the customer application is delivered as a hosted web application.
- Any website CTA or copy implying that the browser dashboard is the customer product.
- Any interpretation that the word TAURI alone selects a desktop framework.

## Open decisions

- Product-owner confirmation of the Axiom Agent name versus the original TAURI title.
- Supported OS/platform matrix for the first production release.
- Shared-service ownership and persistence technology for the operation ledger.
- Approved identity-provider list and whether the browser device flow must add formal OAuth PKCE beyond the current one-time signed desktop-session exchange.
- Policy for whether a deferred-validation change may close before follow-up completion.
