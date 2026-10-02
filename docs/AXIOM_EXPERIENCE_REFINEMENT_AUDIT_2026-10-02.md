# Axiom Experience Refinement Audit

## Purpose

Refine the existing Axiom Agent product and marketing experience without replacing its identity, design system, or working product surfaces. Cursor is a quality reference for calm, legible, product-first presentation only; no Cursor artwork, language, or interaction design is copied.

## Keep

- Desktop-first delivery, with the browser as an account and companion surface rather than an operational control plane.
- The dark Axiom canvas, original scenic artwork, near-white type, and restrained orange accents.
- The honest lifecycle demo, explicit approval boundary, evidence language, and distinction between recorded, validated, and unknown state.
- The public Security page's statement of limits and its refusal to imply independent certification.
- The signed-in companion's protected navigation and account-setting boundaries.

## Refine

- Make the homepage demonstrate one governed deployment story before listing implementation details.
- Make **Playbook** the central object connecting intent, risk, approval, execution, validation, evidence, and closure.
- Reduce broad capability inventories and dense status-card treatments through progressive disclosure.
- Align secondary pages to the same calm canvas and truthful, desktop-first product narrative.
- Improve human consequences alongside technical terms: explain what the operator can know, decide, and prove.

## Consolidate

- Treat legacy browser-first, cloud-automation, generic AI-agent, and pricing copy as historical unless it agrees with `docs/PRODUCT_VISION.md`.
- Keep one source of truth for browser vs. desktop behavior, execution authority, integration state, and verified installer availability.
- Keep compliance language at practical control/evidence mapping; do not imply HIPAA, CMMC, FedRAMP, SOC 2, or military certification without completed evidence and required agreements.

### Route decisions

| Route | Classification | Decision |
| --- | --- | --- |
| `/` | Keep + refine | Keep the existing cinematic Axiom preview; make the Playbook lifecycle the primary story and reduce supporting status noise. |
| `/product` | Keep + refine | Keep the desktop-first product surface; use the same Intent → Playbook → Govern → Execute → Prove language as the homepage. |
| `/axiom` | Consolidate | Preserve the legacy URL but route visitors to `/product`; the older browser-first autonomous cloud-operations story conflicts with the current product boundary. |
| `/capabilities` | Refine | Preserve the evidence-backed capability inventory, but lead with one governed Playbook and reveal technical controls progressively. |
| `/plans` | Keep | Keep the no-charge, invite-only pilot message and explicit non-promises. |
| `/resources` | Keep | Keep focused getting-started, workflow, trust, and desktop guide paths. |
| `/security` | Keep + refine | Keep controls and limitations; add security principles and practical regulated-environment boundaries without certification claims. |
| `/download` | Keep + refine later | Current dynamic manifest and explicit installer limitations are correct; refine first-five-minutes onboarding only after installed-app behavior is verified. |
| `/docs` and `/docs/releaseops` | Refine | Keep detailed reference material; ensure entry points distinguish Get Started workflows from deep reference and maintain desktop-first claims. |
| `/changelog` | Refine | Preserve history, but lead each release with user impact and progressively disclose internal kernel/test details. |
| `/faq` | Keep + refine later | Keep serious-buyer questions; audit answers for current desktop, integrations, and compliance truthfulness. |

## Fix

- Any page that promises a live integration, cloud mutation, autonomous execution, or installer capability without service-side verification.
- Navigation or CTAs that take a signed-in user out of the companion without a clear boundary.
- Visual drift that makes product, capabilities, pricing, resources, and account surfaces feel unrelated.

## Deployment Rehearsal assessment

Existing code includes dry-run planning, a Terraform plan runner, preview-only simulations, and container-related reference modules. Those are useful inputs, but they do **not** prove that Axiom currently provides an isolated Docker rehearsal environment for customer changes.

Do not advertise Deployment Rehearsal until it has all of the following:

1. An ephemeral, tenant-isolated execution environment with a documented lifecycle and destruction guarantee.
2. Explicit image provenance, dependency/SBOM and vulnerability checks, resource limits, network egress policy, and no default production credential access.
3. A controlled secret-injection mechanism with short-lived credentials, redaction, audit events, and revocation.
4. A defined contract for Terraform plan, policy checks, dependency checks, rollback-artifact verification, and the exact limits of each check.
5. Human approval before any rehearsal that can reach an external system, plus evidence and cleanup status written back to the Playbook.
6. Provider-sandbox and failure-path tests proving that a rehearsal cannot become a production apply.

Until then, use the truthful language **“review and dry-run planning”** rather than “rehearsal” or “sandboxed execution.”

## Refinement sequence

1. Request-to-Closure homepage and Product narrative.
2. Capabilities and secondary-page hierarchy: explain trust boundary first, implementation details on demand.
3. Signed-in companion clarity and mobile navigation review.
4. Security, download, docs, changelog, and pricing claim audit.
5. End-to-end build, desktop/mobile, CTA, accessibility, performance, and capability-accuracy verification.
