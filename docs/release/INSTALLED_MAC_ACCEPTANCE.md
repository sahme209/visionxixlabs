# Installed Mac acceptance — release candidate

Record exact source SHA, app version/build, macOS version/architecture, bundle signing/notarization result, tester and date. A green renderer test or native CI build is not installed-app acceptance. No installer publication, Gatekeeper bypass, paid AI request, billing write or cloud execution is authorized by this checklist.

## Preparation

Use an isolated local fixture repository and test organization. Confirm the built bundle corresponds to the candidate source; an older installed release cannot validate new code. Follow desktop/package.json and existing build documentation for the candidate; stop if signing or native dependencies are unavailable. Never paste tokens, cookies, connection strings or keychain values into evidence. Real provider and sandbox execution require separately authorized credentials and costs.

## Reproducible customer journey

1. Launch the actual macOS bundle. Check first-run navigation, settings persistence, keyboard navigation and restart behavior. Record crashes and visible errors.
2. Pair with an authorized test account. Verify expected organization, logout/restart, expired/replayed pairing rejection and revoked-session behavior. Credentials must remain in the intended secure store.
3. Connect GitHub, select an authorized repository and branch. Verify tenant/repository restrictions and rejection of an unauthorized repository. Connecting GitHub alone must not initiate an Axiom charge; GitHub's own usage charges are separate.
4. Select an environment; switch repository/branch/environment while a proposal or verification is pending. Old results must not become applicable in the new context. Do not execute production deployments.
5. Select a permitted model. With separately authorized real-provider access, verify text arrives incrementally before completion, error handling, cancellation and policy denial. Capture sanitized timings and usage only. Synthetic SSE tests do not satisfy this step.
6. Ask for an existing-file edit and a coordinated multi-file change. Inspect each diff, reject once, then explicitly approve application. Verify disk contents and stale baseline refusal. For a candidate containing PR #195, create a new file with explicit consent; existing files and symlink paths must be refused rather than overwritten. Preserve evidence of partial application on failure; do not assume a transaction.
7. Run a detected, explicitly approved verification command. Verify stdout/stderr, nonzero exit, output bounds, timeout and stale-result rejection. With the cancellation candidate installed, cancel before launch and during execution; ensure no late PASS. Verify unrelated processes survive. Direct-child cancellation does not establish descendant cleanup.
8. Exercise chat-to-proposal-to-diff-to-application-to-verification in one actual app session. Confirm model and organization policy remains enforced through tool calls and cancellation.
9. For deployments, inspect readiness, immutable artifact identity, approval requirements and audit evidence without executing. Sandbox execution and rollback remain blocked until an explicit sandbox/cost authorization exists.
10. For billing, only an approved isolated Stripe TEST binding may exercise checkout, verified webhook, subscription, included credits, renewals, cancellation, payment failure and credit exhaustion. No live checkout, product creation or credential changes are authorized. Fixture events alone are not payment acceptance.

## Evidence and cleanup

For each step record PASS, FAIL or BLOCKED; source SHA/bundle, exact action, expected/actual result and sanitized evidence. Keep provider, native-process, installed-app and billing acceptance separate. Remove only the isolated fixture files/resources you created and are authorized to remove. Never delete account records, production resources or credentials as cleanup.

Current environment: Linux, without Rust/macOS GUI or configured provider credentials. Installed-Mac, native-process and real-provider acceptance are BLOCKED, not passed.
