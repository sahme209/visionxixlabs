# AXIOM AGENT — COMPLETE THE ENTIRE PROJECT

**This is a direct execution order. Finish Axiom Agent as a complete, production-ready commercial product. Do not stop at individual features, passing tests, partial integrations, or documentation.**

You are responsible for driving the entire existing mission to completion, coordinating all available agents and parallel workstreams.

## 1. Execution rules

- Continue all existing workstreams immediately. Do not restart, abandon, duplicate, or unnecessarily reprioritize work already in progress.
- Review the entire repository, existing specifications, mission trackers, architecture, completed PRs, outstanding requirements, and unresolved blockers.
- Identify every incomplete, disconnected, broken, inaccessible, or unverified feature.
- Assign independent work to parallel agents wherever safe. Keep development, integration, testing, and review progressing simultaneously.
- Reuse existing implementations. Do not rebuild working systems unnecessarily.
- Every completed feature must be accessible, functional, secure, tested, and integrated into the actual application.
- Continue independently through implementation, testing, code review, GitHub PRs, and validated merges. Do not repeatedly ask for instructions already provided.
- Escalate only genuine blockers or actions requiring explicit authorization.

## 2. Complete the entire Axiom platform

Finish and integrate all existing capabilities, including:

**Authentication and accounts:** Signup, password login, Google/GitHub authentication, email verification, password recovery, organization/workspace management, roles, permissions, desktop pairing, revocation, session security, and account switching.

**Cloud integrations:** AWS, Azure, GCP, account enrollment, secure credential management, provider validation, inventory discovery, cloud resources, monitoring, and safe disconnect/reconnect.

**GitHub and development:** Repository discovery through dropdowns, branches, commits, pull requests, environments, CI/CD, source tracking, and deployment automation.

**Deployment engineering:** Deployment intake, readiness validation, environment selection, artifact verification, approval workflows, execution, monitoring, rollback, audit history, and recovery.

**Governance:** Tenant isolation, role-based approvals, concurrency protection, immutable deployment targets, evidence collection, policy enforcement, approval expiration, and complete audit trails.

**Terraform and infrastructure:** Infrastructure planning, validation, drift detection, controlled execution, infrastructure workflows, and rollback/recovery where supported.

**Airflow:** DAG discovery, batch monitoring, execution status, dependency-aware scheduling, deployment triggers, and automated workflows based on verified completion conditions.

**AI Agent:** Functional conversational interface, context-aware engineering assistance, repository and infrastructure analysis, governed tool execution, AI model integration, credit consumption, usage limits, and reliable error handling.

**Automation:** Scheduled deployments, approval-aware execution, dependency conditions, workflow orchestration, notifications, and safe retries.

**Desktop application:** Complete native macOS experience, settings, integrations, navigation, menus, notifications, credential handling, installation, updating, and release readiness.

Do not mark unsupported provider operations or unimplemented execution paths as complete. Build them safely, or explicitly document their remaining external prerequisites.

## 3. Complete website, pricing, and Stripe

Make the website and desktop application one connected customer experience.

- Restore clear access to the existing `/pricing` page.
- Reconcile every displayed plan with the canonical billing catalog.
- Connect every pricing CTA to the correct authenticated Stripe checkout flow.
- Verify subscriptions, upgrades, downgrades, renewals, cancellations, payment failures, and billing recovery.
- Provision the correct AI credits, entitlements, usage limits, and application capabilities after verified payment.
- Enforce those entitlements consistently in the backend and desktop application.
- Complete the customer journey from website signup through payment, desktop pairing, onboarding, and actual feature usage.
- Preserve the existing support-page Stripe integration without altering or breaking its checkout, webhooks, or payment handling.
- Maintain separate, appropriate messaging for project supporters and AI-company partnership opportunities.

Use isolated Stripe test environments for acceptance testing. Never activate live billing or change production prices without approval.

## 4. Deliver Cursor-level product design quality

Build an exceptionally polished, minimal, intuitive interface inspired by Cursor's usability, while preserving Axiom's unique identity and dark/orange design system.

Every button, dropdown, menu, modal, navigation item, form, and contextual action must work.

Prioritize click-first experiences: users should select connected repositories, environments, cloud accounts, deployments, and configurations instead of manually entering identifiers wherever possible.

Validate loading states, success messages, failures, empty states, accessibility, responsiveness, keyboard shortcuts, and navigation.

Use the existing Figma integration where useful for coordinated design review and implementation.

**Do not interrupt critical engineering for a broad visual redesign.** Continue functional UI improvements now, then execute a consistent final design-polish pass when core journeys are stable.

## 5. Prove the application actually works

Automated unit tests alone are insufficient.

Perform real application-level acceptance testing covering:

1. Website signup and authentication.
2. Desktop installation, launch, and pairing.
3. Workspace creation and onboarding.
4. GitHub and cloud-provider connections.
5. Repository and environment selection.
6. AI Agent interactions and credit accounting.
7. Deployment preparation, governance, approvals, execution, monitoring, and rollback.
8. Terraform and Airflow workflows.
9. Stripe test checkout and actual entitlement provisioning.
10. Settings, navigation, buttons, errors, account switching, and recovery.

Use Playwright for applicable web workflows, real PostgreSQL integration tests, isolated provider environments, and native macOS testing where supported.

Clearly distinguish simulated tests, local HTTP tests, provider-backed tests, native application acceptance, and verified production behavior. Never claim one proves another.

## 6. Resolve every release blocker

Prioritize verified recovery of production authentication, including the exact serving database binding, migration history, restore readiness, and reviewed repair procedure.

Do not blindly deploy Prisma migrations or change the production database.

Complete security reviews, dependency checks, race-condition protection, credential handling, billing enforcement, and release verification.

Ensure the native installer contains the validated source and passes actual installation and launch acceptance.

Preserve the existing published installer and production website until replacements are explicitly approved.

## 7. Maintain strict production safeguards

You are authorized to continue local development, isolated testing, code reviews, GitHub CI, and validated source merges.

**You are NOT authorized to:**
- Trigger automatic or manual Vercel deployments.
- Change production domain routing.
- Modify production databases or secrets.
- Perform unapproved live AWS/Azure/GCP mutations.
- Activate live Stripe transactions or alter production pricing.
- Publish or overwrite public desktop installers.
- Delete infrastructure, data, branches, or releases without approval.

Prepare validated release candidates and exact approval requests for these actions.

Keep Vercel deployment manual-only where supported, without disrupting GitHub development or CI.

## 8. Completion standard

Do not declare the project complete because code exists, PRs merged, or thousands of tests passed.

A capability is complete only when its implementation is integrated, accessible through the intended interface, secure, tested at the appropriate level, and supported by verifiable evidence.

Maintain a single authoritative mission tracker showing:

- Completed and verified.
- Implemented but awaiting integration.
- Partially functional.
- Missing or broken.
- Blocked by external services or approval.
- Ready for release.

For every blocker, provide the exact cause, impact, proposed resolution, and next action.

Continue building and closing requirements until no actionable engineering work remains.

## 9. Final objective

Deliver **Axiom Agent as a fully integrated, secure, reliable, commercially viable, beautifully designed, production-ready AI-native DevOps platform**.

The website, desktop application, AI Agent, cloud integrations, deployment governance, automation, billing, credits, and customer experience must operate together as one product.

**Execute. Coordinate your agents. Validate real functionality. Merge verified improvements. Fix remaining gaps. Keep moving without unnecessary interruptions.**

Only stop for genuine external blockers, required approvals, or when all remaining work has been completed and independently verified.

Do not confuse release readiness with authorization to deploy. Prepare everything possible safely, then present the exact production actions requiring my approval.