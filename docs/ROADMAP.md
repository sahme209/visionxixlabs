# Roadmap

Last updated: 2026-09-29

## P0 — integrity and authoritative scope

1. Complete packaged verification of the new browser-to-app return: fresh install, Log in, Create account, provider cancel/error, expired challenge, approval, automatic focus, single consumption, restart, logout, and revoked session on macOS, Windows, and Linux.
2. Configure and live-verify the approved commercial fulfillment path: confirm written prices/terms, production payment processor account and webhook secret if self-serve checkout is desired, tax/invoice policy, refund/cancellation policy, and entitlement provisioning owner. Until then, keep requirements-based production access and the fail-closed desktop wall. Existing customers use the bearer-authenticated desktop portal endpoint only when a real tenant Stripe customer record exists; verify portal return and webhook-driven entitlement with an approved test customer.
3. Complete live pairing verification now that the production migration is applied: expiry, replay denial, concurrent approval/consumption, revocation, logout, tenant attribution, and the unentitled-account handoff into the desktop access wall.
4. Add verified-email issuance/expiry/replay handling for credentials accounts, or formally require a configured enterprise/OAuth identity provider; do not describe password possession as verified email identity.
5. Complete clean-host acceptance for the published 0.1.10 native HTTP bridge on every target; verify login/signup native return, billing return, TLS failures, redirect denial, timeouts, sleep/wake, and secret redaction before broader rollout.
6. Replace each hidden legacy dashboard module with a desktop-session-authenticated, tenant-scoped end-to-end journey before reintroducing it to customer navigation; prioritize execution, validation, evidence, deferred follow-up, rollback, and closure.
7. Remove or migrate the remaining desktop dashboard-cookie endpoints: each installed-app screen must use an explicit bearer-authenticated desktop/v1 service route with enforced permissions.
8. Preserve the reattached 36-section master specification verbatim and expand `REQUIREMENTS_MATRIX.md` to one row per subsection, every section 11–20 detail, and scenarios A–L.
9. Wire every merge, release, tag, change, dispatch, environment approval, and rollback adapter through the now-migrated tenant-scoped operation ledger and tested reconciliation policy.
10. Continue the new desktop request/playbook path through immutable revision editing and diffs, approval/readiness, execution, validation/deferred follow-up, and closure.
11. Audit every browser route against the verified desktop-only edge policy; keep dashboard/operator and unsolicited auth entry points redirected while retaining shared-service callbacks and native system-browser PKCE support.
12. Add SBOM generation and independent clean-host evidence to the recorded v0.1.10 commit/version/checksum/signing/notarization evidence.
13. Configure and verify the production contact sender; exercise durable acceptance, provider delivery, bounce/failure visibility, and abuse controls.
14. Replace preview cloud paths with live SDK validation only after safe-tenant contract tests; keep the claim map synchronized.

## P1 — missing original behavior

1. Replace the linear playbook with dependency-aware branching and parallel joins; make rollback conditional and escalation/retry policy explicit.
2. Complete immutable request editing/diffs and playbook history retrieval, including active/superseded policy.
3. Separate technical and functional validation ownership and evidence.
4. Implement KT/shadow sessions, consent, source evidence, unresolved questions, and readiness.
5. Implement Word/PDF/Confluence export verification.
6. Implement scenarios A–L exactly after source restoration.

## P2 — recovery and integration

1. Startup/reconnect/sleep/wake/crash reconciliation and stale-data indicators.
2. Provider-sandbox tests for identity, SCM, workflows, change systems, communications, environment approval, and cloud validation.
3. Deferred-validation scheduling, ownership, monitoring triggers, reminders, and closure policy.
4. Backup/restore and supported-version migration exercises.
5. Signed updater with rollback/recovery behavior, or explicit absence in product/UI.
6. Add outcome-memory retention/deletion controls and store-level tenant scoping; verify the same behavior through the packaged desktop journey.

## P3 — usability, accessibility, performance

1. A mission-focused desktop information architecture centered on active deployments rather than disconnected modules.
2. Field-level blocker messages, verified defaults, progress, and recovery guidance.
3. Keyboard, screen-reader, contrast, scaling, reduced-motion, and platform accessibility passes.
4. Large-record, offline-cache, and reconnect performance tests.
5. Verify the responsive website on real Mobile Safari and Chrome/Android at 320, 390, 430, and 768 CSS pixels, including menu focus, safe areas, scrolling, CTA overlap, reduced motion, and every download/documentation link.

## Exit criteria for “ready”

- Every authoritative requirement has implemented and independently verified evidence.
- All ten templates and scenarios A–L pass normal and failure journeys.
- Exact packaged artifacts pass clean install, upgrade, recovery, auth, integrations, and accessibility on every claimed platform.
- No high/critical unresolved security defect; other risks are explicitly accepted with owner and expiry.
- Website claims match the delivered verified release.
