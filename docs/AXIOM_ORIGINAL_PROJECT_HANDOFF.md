# AXIOM AGENT — PROJECT HANDOFF & REMAINING MASTER MISSION

You are taking over as my engineering coordinator for **Axiom Agent**, a product owned by **Vision XIX Labs LLC**.

I have been developing this product extensively with Codex and Claude. This is an existing, substantial codebase — **NOT a new project**.

**Repository:** https://github.com/sahme209/visionxixlabs  
**Website:** https://visionxixlabs.com

## 1. FIRST PRIORITY — FIX LOGIN

The production Axiom website currently has an authentication problem.

Observed behavior:
- Email/password login reports "Invalid email or password."
- Google OAuth reaches the Google account selection page, but redirects back to Axiom with "Access Denied — You do not have permission to sign in."
- GitHub OAuth appears to encounter the same authorization problem.

Investigate the actual root cause:
- OAuth callback handling for Google and GitHub
- Authentication provider configuration and environment variables
- User provisioning and existing account records
- Organization membership and tenant assignment
- Founder/admin roles and permissions
- Allowlist, pilot-access, and account-approval restrictions
- Session cookies, redirects, and production database consistency
- Whether recent paired-desktop authentication migrations affected web authentication

**Do not bypass authorization, disable security, or automatically grant administrator access to arbitrary users.**

Identify the legitimate founder account through existing records and restore its correct access using the established secure authorization model.

Add regression tests for Google, GitHub, email/password, authorized users, and unauthorized users.

Fix this in a focused pull request. Verify the build, required tests, and deployment before considering the issue resolved.

## 2. PRODUCT VISION

Axiom Agent is an AI-native, governed DevOps/cloud engineering desktop application.

The vision is **Cursor-like usability for cloud operations and DevOps**.

A nontechnical person should be able to accomplish complex infrastructure tasks through clear, click-first workflows, while experienced engineers retain advanced controls.

Core capabilities include:
- AWS infrastructure and ECS deployment operations
- Azure and Google Cloud integrations
- GitHub repository, PR, and deployment management
- Terraform infrastructure workflows
- Apache Airflow 3 integration and dependency-aware scheduling
- AI-assisted troubleshooting and engineering
- Deployment readiness, approvals, execution, validation, rollback, and closure
- Audit logs, tenant isolation, RBAC, and governed automation
- Desktop application for engineering operations
- Web companion for account management, governance, billing, integrations, and downloads

**Never confuse a working UI with a verified real-world integration.**

## 3. CURRENT DEVELOPMENT STATUS

Prior working estimate: approximately **85% complete**, with 15% remaining. This is an informal estimate, not a verified code audit.

Recent engineering work includes:
- Paired-session bearer authentication for desktop workflows
- Release workspace, application, onboarding, and repository inventory migrations
- AGI cockpit desktop authentication migration
- AI call logs restricted to the authenticated workspace
- Removal of unsafe cross-workspace desktop observability
- AI billing using settled Vercel AI Gateway cost and 1.5x customer pricing
- Durable, idempotent Stripe invoice-item settlement implementation
- Atomic monthly per-workspace spending caps
- Strict test-mode-only Stripe execution gates
- Desktop and GitHub CI/security tests

Recent pull requests and branches include PRs #88–#94 and subsequent AGI cockpit hotfix work.

**Important:** These statuses may have changed. Inspect GitHub before making assumptions about which branches are open, merged, conflicting, passing, or deployed.

Recent hotfix branch:
`codex/fix-agi-cockpit-route-config`

Recent hotfix commit:
`102a7565`

The hotfix addressed invalid Next.js route exports, including unsupported `maxDuration` exports and a reusable command incorrectly exported from an API route. The reusable command was moved to a library module.

Its CI status and merge status must be verified.

Do not recreate completed features or repeatedly resume obsolete PR #75 work.

## 4. REMAINING CODEX MASTER MISSION

After fixing login, audit the latest main branch, open PRs, tests, deployment state, and existing documentation.

Then complete only genuinely unfinished work, prioritizing:

**A. Desktop security and authentication**
- Finish remaining paired-session authentication migrations.
- Preserve tenant isolation and capability-based authorization.
- Resolve existing PR conflicts safely.
- Verify native desktop security checks.

**B. AI billing**
- Confirm settlement ledger, idempotency, 1.5x pricing, spending caps, credit reservation, and replay/failure behavior.
- Preserve the existing implementation.
- Finish missing production-grade code and tests.
- Live Stripe end-to-end validation will be done separately on my personal laptop with an isolated Stripe test environment.
- Do not charge real customers or activate live billing without my explicit approval.

**C. Real integrations**
- Audit AWS, Azure, GCP, GitHub, Terraform, and Airflow 3.
- Finish missing integration code, error handling, authorization, and tests.
- Clearly distinguish implemented code from live-validated operations.
- Real cloud-account and deployment validation will be done on my personal laptop.

**D. Governed automation**
- Deployment request → readiness → approval → execution → validation → rollback/closure.
- Support scheduled and dependency-aware deployments.
- Ensure auditability, retries, failure recovery, and approval gates.
- Never perform unauthorized production infrastructure operations.

**E. Desktop usability and release readiness**
- Complete click-first repository, environment, provider, and deployment selection.
- Preserve advanced engineering controls.
- Verify native Mac desktop packaging, installation, updates, settings, navigation, and releases.
- Fix broken functionality and incomplete integration wiring.
- Validate frontend/backend contracts and CI.

**F. Website**
- Keep account, team, integration, billing, and governance workflows functional.
- Ensure the website and desktop app connect correctly.
- Preserve existing working design and branding.
- Avoid unnecessary redesign.

## 5. RESPONSIBILITY SPLIT

**CODEX — IMPLEMENTATION**
Own engineering, backend, frontend functionality, security fixes, integrations, testing, CI, and releases.

**CLAUDE — DESIGN & GOVERNANCE**
Reserve for a later, focused review of UX, visual design, user journeys, architecture, and governance policy. Do not spend Claude resources repeating completed Codex engineering.

**CURSOR — OPTIONAL**
May be used on my personal laptop for local code inspection, desktop debugging, manual testing, and small focused edits. It is not required if Codex can finish the work.

**ME — FOUNDER**
I will handle actual cloud-account access, live nonproduction AWS/Azure/GCP tests, Stripe test-account validation, deployment approvals, and final acceptance.

## 6. NON-NEGOTIABLE SAFETY RULES

1. Inspect the existing repository and current main branch before editing.
2. Read `CLAUDE.md` and project-specific engineering guidance.
3. Never overwrite, delete, or unnecessarily redesign working functionality.
4. Never force-push, reset, or discard someone else's work.
5. Avoid duplicate implementation and overlapping PRs.
6. Use small, focused branches and pull requests.
7. Run TypeScript, Vitest, desktop-native security checks, and applicable CI.
8. Resolve merge conflicts carefully and preserve both valid changes.
9. Never claim a feature is deployed or validated merely because code was pushed.
10. Never expose secrets or copy production credentials into chat, logs, or commits.
11. Never weaken RBAC, approval gates, tenant isolation, or billing protections to make tests pass.
12. Do not merge, deploy, charge customers, or change production infrastructure without the appropriate explicit authorization.
13. Use actual integrations for final validation, not mock demonstrations presented as real-world success.
14. Coordinate with Claude/Cursor by separating ownership, not duplicating their work.

## 7. HOW TO PROCEED

**Step 1:** Connect to and inspect the GitHub repository and current PR/CI status.

**Step 2:** Investigate and fix the production authentication issue first.

**Step 3:** Identify exactly which parts of the original master mission are already complete, partially complete, unmerged, or still missing.

**Step 4:** Continue Codex engineering in priority order, one safe and testable milestone at a time.

**Step 5:** Separate work that requires my personal laptop or external credentials from work Codex can complete independently.

**Step 6:** Prepare a concise final handoff for Claude and, if useful, Cursor.

## 8. COMMUNICATION

Keep progress updates extremely short.

For every update, tell me:
- Approximate overall completion percentage
- What was actually completed
- What's left
- Any blocker or action required from me

Do not increase completion percentage just because another commit or PR exists.

**Start by investigating the login failure. Do not begin another broad refactor or redesign.**