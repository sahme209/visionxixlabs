# Associated Jira remote-link and reviewed transition outbound composition

Local only. The existing associated ticket flow retains two separate durable human decisions: deployment/ticket provenance association and exact provider action approval. Actual production request composition now checks the canonical issuer before existing credential preflight or claim, then uses the durable reservation/submission-intent protocol for an exact associated remote-link or closure transition. The canonical issuer always refuses; no identity, coverage or activation is supplied.

The claimed DB reader reuses existing history, current action, independent approval membership, connection readiness, original publication and accepted-link/association evidence checks. Jira records an action approver actor/action digest/version/client ID, not a reviewer-session ID; no missing historical session is invented. The actual current executionScope must equal the persisted scope, leaseOwner is the action ID, and original attempt-one state is retained. Existing Jira candidates have no BotTask field; no fabricated task authority is added. Executor session, lease and exact candidate expiry conservatively bound private freshness, and enrollment absence is checked under the same organization lock.

Postclaim persisted write-credential resolution follows reservation. Exact fixed payload serialization precedes committed intent, and retained current-authority plus one-use intent proofs run synchronously before the fixed POST fetch. Closure retains its existing fresh terminal-transition GET and exact native status readback. No provider-side CAS guarantee or extra transition is introduced. Existing preclaim credential/catalog reads reuse a persisted bearer; its earlier lifetime remains unqualified.

ServiceNow logic and consumed history, including the already-written unknown note, remain unchanged. Its branch ignores the optional trusted Jira helper argument. No Jira historical confirmation is resent or rewritten. Legacy Jira publication/unassociated routes are outside this adoption and are not claimed covered.

## Verification

- Seven focused files: 90 pass, including new private physical-edge tests and existing associated service, Jira store/transport and ServiceNow request-composition regressions. Positive issuer/authorization/provider ports are simulated.
- Corrected actual-source scoped TypeScript: pass. Initial union-narrowing failures retained; the correction makes the existing publish refusal explicit without changing accepted profiles. No broad build.
- Root-owned actual mounted request-service PostgreSQL: 12/12 pass; fixture stopped. Actual stores, session/membership/connection locks, separate durable approval histories, claims, drain and fixed transport compose end to end. Historical source collection, request identity, provider responses and positive issuer are explicit simulations. Each link/close profile has positive, canonical refusal, lost POST acknowledgement, lost reservation acknowledgement, revoked association and enrollment-after-claim cases. See actual-pg.log and actual-pg-fixture.json.
- Independent frozen source review: pass, no important findings.

No real provider access, ticket action, deployment, settings, schema migration, grant, new credential, spending, native experiment or production enablement occurred.
