# Roadmap

Last updated: 2026-09-28

## P0 — integrity and authoritative scope

1. Apply and live-test the persisted desktop pairing challenge migration; verify expiry, replay denial, concurrent approval/consumption, revocation, logout, and tenant attribution.
2. Compile and security-review the native HTTP bridge on every target; verify TLS failures, redirect denial, timeouts, sleep/wake, and secret redaction before distributing 0.1.8.
3. Replace each hidden legacy dashboard module with a desktop-session-authenticated, tenant-scoped end-to-end journey before reintroducing it to customer navigation; prioritize execution, validation, evidence, deferred follow-up, rollback, and closure.
4. Remove or migrate the remaining desktop dashboard-cookie endpoints: each installed-app screen must use an explicit bearer-authenticated desktop/v1 service route with enforced permissions.
5. Preserve the reattached 36-section master specification verbatim and expand `REQUIREMENTS_MATRIX.md` to one row per subsection, every section 11–20 detail, and scenarios A–L.
6. Apply and verify the tenant-scoped operation-ledger migration; wire every merge, release, tag, change, dispatch, environment approval, and rollback adapter through the tested coordinator and reconciliation policy.
7. Continue the new desktop request/playbook path through immutable revision editing and diffs, approval/readiness, execution, validation/deferred follow-up, and closure.
8. Audit every browser route against the verified desktop-only edge policy; keep dashboard/operator and unsolicited auth entry points redirected while retaining shared-service callbacks and native system-browser PKCE support.
9. Build a fresh artifact from a committed tree; record commit/version/checksum/SBOM/signing/notarization.
10. Configure and verify the production contact sender; exercise durable acceptance, provider delivery, bounce/failure visibility, and abuse controls.
11. Replace preview cloud paths with live SDK validation only after safe-tenant contract tests; keep the claim map synchronized.

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
