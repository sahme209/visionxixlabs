# Axiom Agent — Master Plan Continuation & Priority Refinement

Continue the existing Axiom Agent master plan exactly where you left off; do not restart, change priorities outside the refinements below, or deviate. Preserve the existing execution order, mission tracker, completed work, security boundaries, tests, and ongoing engineering streams.

**This is a priority refinement, not a new project. Continue implementing and testing real working functionality, not just producing plans or status reports.**

## Priority 0 — Fix website login and access denied

**This is the immediate blocker. Investigate and fix it before starting new feature development.**

Website authentication worked approximately 2–3 weeks ago but now returns "Access denied."

1. Reproduce the failure using the actual deployed website and current authentication flow.
2. Trace the entire authentication chain: identity provider, OAuth callbacks, redirect URLs, cookies, sessions, middleware, environment variables, domain configuration, deployment settings, database access, and authorization policies.
3. Compare the last known working authentication configuration with the current implementation using Git history and deployment evidence.
4. Identify the actual root cause. Do not simply suppress the error or bypass authentication.
5. Restore secure sign-in and correct post-login navigation to the **latest polished Axiom cockpit**, not the older unfinished interface.
6. Verify the website, desktop sign-in, session persistence, logout, and authorization boundaries wherever applicable.
7. Test authenticated and unauthenticated users, expired sessions, denied permissions, and recovery behavior.

Do not report success until the real deployed authentication flow is verified. If credentials or an interactive sign-in are required, request the minimum necessary user assistance.

## Priority 1 — Cursor-quality website redesign

Research the current Cursor website deeply, including its homepage, product presentation, navigation, interactive demonstrations, pricing, and visual hierarchy.

Our goal is to match Cursor's **level of polish, simplicity, spacing, typography, visual balance, and professional credibility**, while preserving Axiom's independent identity.

### Design direction

- Remove excessive orange glows, gradients, borders, shadows, and distracting accents.
- Replace the cheap-looking orange treatment in the homepage application preview with a clean, restrained, realistic product presentation.
- Use sophisticated charcoal, black, white, and neutral-gray surfaces.
- Retain orange only as a subtle, intentional brand accent where it genuinely improves the design.
- Adopt Cursor-like typography, restrained animations, consistent spacing, clear hierarchy, and premium editorial composition.
- Avoid oversized cards, crowded sections, repeated marketing statements, and excessive decorative effects.
- Make navigation between pages visually consistent and effortless.
- Ensure desktop, tablet, and mobile layouts feel equally considered.
- Preserve accessibility, keyboard navigation, reduced-motion support, and performance.

**Do not copy Cursor's logos, proprietary assets, source code, or distinctive branded content. Reproduce the quality and interaction principles through an original Axiom design.**

### Pages requiring attention

**Homepage:** Rebuild the hero composition and application preview into a convincing, beautifully presented product experience. The interface must resemble the latest actual Axiom application, not an invented or obsolete cockpit.

**Product tours:** Reduce oversized cards and improve the proportions, transitions, demonstrations, and layout. Show realistic coding, Agent, GitHub, Terraform, cloud, and approval workflows. Make the demos visually impressive without misrepresenting simulated actions as real executions.

**Pricing:** Create a premium, straightforward pricing experience with clear plan comparisons, credible typography, restrained card sizes, and honest descriptions of available versus planned capabilities.

**Support XCM:** Give this page special editorial attention. It is intended for outreach to major philanthropists, technology leaders, AI companies, and potential supporters. Make it exceptionally credible, elegant, transparent, and professional. Clearly explain the mission, why support matters, how funds would be used, and what supporters can expect. Do not invent endorsements, partnerships, impact metrics, or charitable status.

**All remaining public pages:** Apply one coherent design system instead of polishing only the homepage.

Use real product screenshots and implementation evidence wherever available. Use animations and illustrative walkthroughs only where they improve clarity.

## Priority 2 — Desktop application and real AI experience

After the authentication blocker and priority website improvements, continue the existing desktop engineering work.

The downloadable macOS application must visibly deliver a modern Cursor-class experience, not merely have implementation code merged into GitHub.

### Desktop requirements

1. Modern, functional chat, code editor, repository explorer, file navigation, integrated terminal, and contextual AI Agent.
2. Click-first GitHub repository, branch, and environment selection, including selection directly from chat.
3. Working AI model selection with clear provider/model availability, authentication, and errors.
4. Investigate the previously discussed Vercel AI Gateway or other appropriate model-routing integration. Verify the actual provider architecture before implementing it.
5. Agent capabilities to inspect repositories, propose and edit code, run authorized commands, execute tests, and explain changes.
6. Preserve the existing dev/staging permissions and production approval boundaries.
7. Verify that improvements appear in the **actual downloadable desktop build**, including clean installation, sign-in, onboarding, and native end-to-end tests.

Do not claim the desktop is working solely because web components, unit tests, or CI builds pass.

## Priority 3 — Plugin marketplace and enterprise administration

Build a practical extension experience inspired by ChatGPT's plugin discovery and Cursor's development ecosystem.

### Plugin marketplace

- Add an obvious **Plugins / Extensions** entry in the desktop navigation.
- Provide searchable categories, installed extensions, available integrations, connection status, permissions, and management controls.
- Support appropriate integrations such as GitHub, cloud platforms, Terraform, Airflow, deployment services, and development tools.
- Explore .NET/C#, Java, Python, JavaScript/TypeScript, and other language tooling through suitable language servers, debuggers, build tools, or extensions.
- Support secure OAuth or other provider-approved connection flows, with clear permission review.
- Do not promise one-click installation for integrations that require additional setup, licenses, or administrative authorization.

### Enterprise controls

Introduce organization-level administrative controls:

- Admin-managed plugin allowlists and denylists.
- Approved AI models and providers.
- Role-based permissions and organization policies.
- Restrictions on external integrations, credential access, and production environments.
- Clear user-facing messaging such as **"This integration is restricted by your organization administrator."**
- Audit trails, approval workflows, and policy enforcement on the backend, not merely disabled UI controls.

Keep the architecture extensible, secure, and manageable for both individuals and enterprise customers.

## Engineering execution requirements

- Inspect the current master plan and execution ledger before changing code.
- Continue existing workstreams without discarding completed progress.
- Investigate root causes rather than applying cosmetic workarounds.
- Use small, reviewable PRs with meaningful tests and evidence.
- Keep billing in TEST mode until explicitly authorized otherwise.
- Preserve cloud isolation, least privilege, production approvals, rollback plans, and auditability.
- Do not deploy to production, weaken security, or incur new cloud costs without authorization.
- For website changes, use an authorized Vercel Preview and verify rendered behavior, not just source tests.
- For desktop changes, verify the actual packaged application.
- Keep simulations explicitly labeled.
- Avoid excessive status messages, repeated planning, and unnecessary review cycles. Focus on implementation.

## Execution order

**First:** Diagnose and restore real website login, including navigation into the latest cockpit.

**Second:** Upgrade the entire website to Cursor-level visual quality, especially homepage, product tours, pricing, and Support XCM.

**Third:** Continue native desktop AI/model functionality and verify the actual downloadable application.

**Fourth:** Implement the plugin marketplace and enterprise administrative controls in alignment with the existing architecture and master plan.

Continue other established engineering tasks according to their existing dependencies and safety requirements. Do not silently abandon Stripe TEST validation, cloud deployment acceptance, Terraform, Airflow, or other active workstreams.

## Reporting expectations

For each meaningful milestone, report:

- What was actually implemented.
- What was tested and where.
- What is verified working versus still unverified.
- PR and CI evidence.
- Blockers requiring user action.
- The next engineering action.

**Start now with the website Access Denied root-cause investigation. Do not spend the first cycle redesigning the website while authentication is broken.**