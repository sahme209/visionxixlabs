# Complete unified mission audit and execution — 2026-10-15

This records the founder's latest scope supplement. It adds to, and does not
replace, the original project handoff or unified master mission. Codex owns
all former Claude responsibilities. Existing production and financial gates
remain active; standing authorization covers validated PR merges and their
automatic Git-linked builds.

## Required audit areas

1. AI-native DevOps engineering: AWS, Azure, GCP, GitHub, Terraform, ECS, Airflow 3, troubleshooting, AI reasoning modes, and provider integrations.
2. Governed deployment automation: readiness, approvals, execution, scheduled deployments, Airflow dependencies, retries, rollback, validation, audit trails, and failure recovery.
3. Security and architecture: authentication, desktop pairing, RBAC, tenant isolation, authorization, credential handling, auditability, and reliability.
4. AI billing and business systems: Vercel AI Gateway, actual provider costs, 1.5x customer pricing, Stripe subscriptions, usage metering, spending caps, billing accuracy, refunds, and safe test-mode validation.
5. Desktop experience: Cursor-level usability and polish, click-first workflows, visual design, typography, spacing, icons, navigation, chat/editor experience, animations, settings, models, integration management, keyboard shortcuts, and native macOS behavior.
6. Website experience: premium visual design, consistent dark/orange branding, clear product messaging, animated product demonstrations, real product screenshots, onboarding, pricing, downloads, account management, integrations, support, accessibility, responsive layouts, and SEO.
7. Architecture and governance previously assigned to Claude: system design, user journeys, product information architecture, approval policies, role boundaries, risk controls, trust and security messaging, and consistency between website and desktop.
8. Product launch: first-run onboarding, documentation, installation, updates, release signing, automated tests, error handling, production monitoring, customer support, pricing transparency, and self-service customer adoption.
9. Existing blockers: production login, founder-account verification, Vercel deployment/routing issues, GitHub/Vercel account mapping, PR conflicts, and external validation requiring my personal laptop.

## Execution and reporting requirements

- Read CLAUDE.md, original mission, unified handoff, decisions, implementation plans, design guidance and current main; inspect open/merged PRs, branches, CI and deployments.
- Create permanent tracking with status, evidence and next engineering action for every available requirement.
- Use the five requested states: Implemented and verified; Implemented but not validated; Partially implemented; Missing; Blocked by external access.
- Explicitly confirm coverage of original Codex and former Claude responsibilities; identify missing source instead of claiming completeness.
- Preserve completed work, working functionality, integrations, brand, safety and approval gates; do not duplicate implementations.
- Fix real engineering blockers while improving design and usability incrementally.
- Prioritize login, security, deployment correctness, billing safeguards and critical integrations before cosmetic polish.
- Use actual application components and real functionality; no decorative mock features or unsupported claims.
- Use focused PRs and applicable validation; do not stop at routine milestones.
- Never change production infrastructure, enable live billing or perform destructive operations without explicit authorization.
- Record external blockers and continue independent work.
- Report estimated completion and evidence, verified work, partial/missing work, current execution, and laptop/credential/approval requirements concisely.
