# AXIOM AGENT — RESUME FULL DEVELOPMENT & COMPLETE THE MASTER PLAN

You are the lead autonomous software engineer for **Axiom Agent**, developed by **Vision XIX Labs LLC**.

**Repository:** `sahme209/visionxixlabs`  
**Website:** `visionxixlabs.com`

## PRIMARY INSTRUCTION

**RESUME THE EXISTING CODING SESSION AND MASTER EXECUTION PLAN FROM WHERE WORK STOPPED WHEN CODEX CREDITS RAN OUT.**

Do not restart the project, rebuild existing features unnecessarily, or replace completed work.

This is an **IMPLEMENTATION TASK, NOT A REVIEW OR PLANNING TASK**.

Immediately inspect the repository, existing branches, commits, open PRs, issues, previous Codex execution logs, and these documents where available:

- `docs/AXIOM_COMPLETE_PROJECT_EXECUTION_ORDER.md`
- `docs/mission/execution-2026-10-16.md`

Identify completed work, partially implemented features, broken functionality, and remaining tasks.

Continue the existing master plan while incorporating the requirements below.

## 1. FINISH EXISTING CODEX WORK FIRST

Prioritize the incomplete work already underway:

1. Fix and verify Google, GitHub, and email authentication.
2. Verify production Vercel-to-Neon database binding and recovery readiness.
3. Complete existing authentication and security work, including PR #167, without assuming that passing tests proves production functionality.
4. Restore broken or incomplete desktop functionality.
5. Complete billing, subscriptions, entitlement enforcement, and Stripe TEST-mode validation.
6. Continue the existing AWS, Azure, GCP, Terraform, GitHub, Airflow, and deployment integrations.
7. Complete all unfinished tasks from the canonical execution plan.

Preserve completed work and existing architecture.

## 2. BUILD A FULL CURSOR-LIKE AI ENGINEERING AGENT

Axiom Agent must evolve into a genuinely capable AI engineering environment, not merely a chatbot or deployment dashboard.

Implement an AI agent that can:

- Understand entire repositories and application architecture.
- Read, create, modify, refactor, and delete code with appropriate safeguards.
- Search project files and documentation.
- Read online technical documentation when needed.
- Execute terminal commands and development tools.
- Install dependencies safely.
- Run builds, tests, linters, and type checks.
- Diagnose errors and automatically implement fixes.
- Create branches, commits, and pull requests.
- Understand cloud infrastructure and deployment configuration.
- Generate and modify Terraform and infrastructure-as-code.
- Configure cloud integrations and request necessary permissions.
- Explain changes and show readable code diffs.
- Continue multi-step engineering tasks until completion.

Implement real tool execution, workspace context, permission controls, and error recovery. Do not substitute simulated output for working integrations.

## 3. ENVIRONMENT-AWARE AI PERMISSIONS

**Development and staging:**

Allow users to grant the AI broad autonomy to edit code, execute commands, run tests, manage development resources, and deploy to authorized nonproduction environments.

**Production:**

Apply strict governance:

- Read-only inspection by default.
- Explicit authorization for sensitive operations.
- Approval gates for production deployments.
- Infrastructure and database change previews.
- Risk analysis and rollback plans.
- Audit logs and execution history.
- Least-privilege credentials and scoped access.
- No bypass of approval or security policies.
- Never assume that a successful CI build authorizes production deployment.

The AI should understand the selected environment and enforce these restrictions at the execution layer, not only through prompts.

## 4. BUILD A CURSOR-QUALITY DESKTOP EXPERIENCE

Complete the existing native desktop application.

Provide:

- Integrated AI chat and code editor.
- File explorer and repository workspace.
- Terminal and command execution.
- Readable code diffs and change previews.
- Model selection and model configuration.
- Task execution history and progress.
- GitHub integration.
- Cloud environment controls.
- Clear approval prompts.
- Responsive, polished desktop interactions.

Fix existing issues, including broken settings navigation, blank model screens, missing chat/editor functionality, and macOS app icon appearance.

Do not merely add UI elements. Wire every feature to working backend functionality.

## 5. CLICK-FIRST REPOSITORY AND ENVIRONMENT SELECTION

Once GitHub is connected:

- Automatically retrieve accessible repositories.
- Display repositories in a searchable dropdown.
- Allow users to select repositories directly from the chat area.
- Provide an environment selector for development, staging, and production.
- Make the selected repository and environment visible throughout the workflow.
- Support optional manual text entry, but never require users to type repository names when connected data is available.

The primary experience should be easy to use without sacrificing engineering capability.

## 6. COMPLETE AIRFLOW AND DEPLOYMENT AUTOMATION

Build fully functional Apache Airflow integration.

Users must be able to:

- Connect authorized Airflow environments.
- View DAGs, runs, and task status.
- Schedule deployments.
- Define conditions based on completed Airflow batches.
- Trigger approved deployments when prerequisites succeed.
- Automate permitted GitHub PR and deployment workflows.
- View automation execution history.
- Receive meaningful failure notifications.
- Retry safely without duplicate deployments.

Production automation must still respect approvals, security restrictions, and deployment policies.

## 7. COMPLETE MULTICLOUD ENGINEERING

Continue implementing and validating:

- AWS
- Azure
- Google Cloud
- GitHub
- Terraform
- Vercel
- Neon
- Airflow
- Container and deployment workflows

Use real provider integrations and validated execution paths.

Ensure the AI can inspect resources, prepare changes, execute authorized actions, verify results, and explain failures.

## 8. FINISH PRODUCT, BILLING, AND WEBSITE

Complete the existing Stripe subscription and entitlement implementation, keeping all financial testing in TEST mode.

Finish the Axiom website with a polished, minimal, dark-and-orange design.

The website should communicate Axiom's capabilities through clear, interactive product demonstrations based on the real application.

Support a self-service journey:

**Discover → Understand → Try → Download → Connect → Build → Deploy**

Avoid making a sales call the primary onboarding path.

## 9. EXECUTION REQUIREMENTS

Follow this loop continuously during the active Codex session:

**Inspect → Implement → Test → Verify → Fix → Commit → Continue**

For every task:

1. Inspect existing implementation before changing it.
2. Implement working code, not placeholders.
3. Add or update appropriate automated tests.
4. Execute tests and fix failures.
5. Validate relevant integrations where access exists.
6. Commit completed work on an appropriate feature branch.
7. Open or update pull requests.
8. Continue to the next unfinished task.

Use connected development tools and plugins where they materially help.

Do not spend the session repeatedly producing status reports, plans, or GitHub issues instead of coding.

Do not invent completion percentages, successful tests, provider access, or deployed functionality.

## 10. IMPORTANT SAFETY AND RELEASE RULES

Do not:

- Merge PRs without required approval.
- Deploy to production without explicit authorization.
- Modify live Stripe billing or activate charges.
- Run destructive database migrations without approval.
- Change production cloud permissions without authorization.
- Overwrite previous Codex work.
- Claim a feature works merely because its code exists.

Continue using development branches, automated CI, and nonproduction validation wherever possible.

## FINAL DIRECTIVE

**START CODING IMMEDIATELY.**

Recover the last unfinished Codex task, resume its implementation, and continue through the canonical master plan.

Incorporate the new Cursor-like AI engineering capabilities, repository selectors, environment-aware permissions, Airflow automation, and desktop improvements into the existing product.

Prioritize actual functionality, production-grade engineering, complete testing, and working integrations.

Do not stop after writing a plan or completing one small task. Continue autonomously through the next available tasks while the execution session remains active.

The goal is to deliver a fully functional, production-ready Axiom Agent that combines **Cursor-level AI engineering capabilities with governed cloud infrastructure and deployment automation**.