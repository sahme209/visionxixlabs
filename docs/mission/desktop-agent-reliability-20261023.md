# Desktop Agent reliability and cockpit alignment

Local work verified on 2026-10-23. The accepted cockpit design, production deployment/database, provider configuration, permissions and published installers are unchanged. This is not a claim of complete Cursor parity or working live Agent execution.

## Changes completed

- Stop response now interrupts a stalled desktop read even when the transport ignores cancellation or never finishes cleanup. Late buffered response callbacks are suppressed. The UI retains recovery guidance instead of silently replaying the request.
- An uncertain provider dispatch, missing usage evidence or accounting failure cannot automatically trigger another paid Agent request. A malformed response can receive a separately admitted repair only after durable accounting.
- Agent receipts include both accounted attempts when a response needs repair. Missing or invalid token totals remain unknown rather than becoming a misleading partial total. Raw model output and parser details are not retained in the typed accounting error.
- Repairs now share the advertised Inspect/Engineer/DeepOps turn limit of 2/4/6 attempts. Regression tests first reproduced 4/8/12 attempts, then passed after the fix in both streaming and legacy paths. Current policy, billing admission, distinct repair keys and write approvals remain enforced.
- Desktop Plan & usage reads plan and allowance from the same existing billing helpers as the cockpit. It refreshes on focus or manually, ignores late responses from an old account/workspace, distinguishes unavailable data from zero credit, and reflects fresh billing-management roles. No payment customer IDs or credentials are returned. This changes presentation, not entitlement or Agent authority.
- An older service remains compatible and displays an explicit warning that its legacy access label is not a current subscription receipt. Native acceptance currently observes that older production service; the new Free/$2 presentation is verified with synthetic UI data and the new local service response. It requires a coordinated service/client release before live acceptance.
- Owned website test harness pins now match the committed Next16.4.2 lock. Official archive integrity and exact adaptations were reviewed; ownership, outbound-network, process, source and RSC validation guards remain strict. No dependency version or guard was weakened.

## Verification

- Full suite: **9,838 passed, 0 failed, 55 skipped**, across 855 test files, on Node24 with the canonical temporary-directory setup.
- Separately ran **19 conditional tests** that the default suite skips: 18 with local embedded PostgreSQL for actual billing route handlers/HMAC/service/SQL logic and synthetic SDK/auth boundaries; one on temporary Unix-socket-only PostgreSQL17.11 for tenant and UTC-month usage boundaries. All passed. These are additional conditional runs, not a second full-suite result. Thirty-six conditional cases remain unexecuted: 34 Docker-owned commercial cases, hosted Stripe checkout, and live Microsoft Learn MCP.
- Root TypeScript, website production build, desktop TypeScript/frontend build and unsigned macOS debug app bundle passed. No Windows/Linux or signed/notarized installer acceptance is claimed.
- Final committed-source real local Next HTTP/PostgreSQL journey passed: authenticated pairing/revocation, disabled Agent policy without inference, persisted governance response, foreign-conversation denial, public billing snapshot without customer/subscription creation, and fresh read-only role denial of billing management. Its isolated cluster was stopped and removed.
- Earlier in this work period, separate real local Next HTTP/PG17 Airflow, AWS and Azure SDK wire-fixture journeys passed with cleanup. They verify protocol, scoping, encrypted storage, revocation and failure behavior against synthetic provider responses, not real cloud credentials, consent or execution.
- Native candidate reopened with saved session/conversation restored. Billing refresh and the explicit old-service warning were observed. Real catalog search found Grok entries; approved-only correctly excluded unapproved entries. No model was enabled and no inference was sent.
- Visible browser fixture exercised stalled Stop, paused queued-follow-up recovery, explicit resume, formatted synthetic completion and shared billing refresh. Its banner explicitly excludes live AI/provider/payment actions.
- Independent reviews of cancellation/retry, receipts, billing and effort limits found no remaining actionable issues.

## Live Agent blocker

The approved temporary recovery rehearsal hit both Neon snapshot and branch capacity limits. No rehearsal resource was created, no existing branch/backup was deleted, and no production SQL ran. Existing $5 temporary-resource approval does not authorize deleting existing data or changing the provider plan. Actual provider billing was not independently measured.

A read-only inventory identified an archived idle preview branch with a merged PR as a possible later cleanup candidate. It still has a preview alias and may contain unique data. See `agent-recovery-capacity-candidate.md`; no deletion has been approved or attempted.

Before a live repair: prove the effective serving database binding, retain and verify a usable recovery point, rehearse the unchanged schema-only repair on an isolated restored copy, resolve the failed migration ledger safely, and obtain exact-target production SQL approval. No Agent enablement, model/tool approval or paid AI request is implied by restoring storage.

Remaining live acceptance includes real AI/Grok completion, coding/tool proposals and recovery, purchases/role propagation across web and desktop, configured cloud integrations/automation, and signed installers. The cockpit stays as accepted.

## Evidence

- `axiom-agent-reliability-verification.json`: redacted run summary and source bindings.
- `axiom-agent-stop-recovery-fixture.png` and `axiom-agent-queue-recovery-fixture.png`: synthetic local interactions.
- `axiom-desktop-shared-billing-fixture.png`: actual Settings component with synthetic Free/$2 data.
- `axiom-native-billing-legacy-service.png`: actual native compatibility with the current older production API; not proof the new billing extension is deployed.

Implementation source: ed5e5021b2e2e6a955e4487822127c15923be354. Local only, not pushed or deployed.
