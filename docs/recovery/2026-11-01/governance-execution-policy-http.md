# Local execution-policy HTTP composition

The user-approved persisted numeric-ceiling issuer now has a paired desktop HTTP entry point, behind the existing default-OFF Governance flag. This is local code only, not production activation or a full Governance MVP.

The exact endpoint supports reading a saved revision, proposing a strict policy, independently approving its exact digest/version, activating with exact parent/pointer CAS, and revoking. Tenant, caller and session come from the paired server resolver. Request fields cannot supply approval actors, provider permission, unknown actions, a precomputed policy digest or an execution-authority Boolean. Current roles, sessions, independent principals, DB-clock expiry, immutable request markers and CAS remain enforced by the actual durable service/store.

An active numeric ceiling remains executionAuthorized=false. It does not enroll a baseline, establish executor coverage, grant provider access or authorize a provider write. Incomplete production coverage still refuses enrollment/admission.

## Verification

- Eleven HTTP tests: initial stub returned503 and all11failed; implemented handler passed all11. These use simulated paired resolver/service ports to isolate boundary checks.
- One actual owned isolated PostgreSQL HTTP→request-service→durable-store journey passed (four older cases deliberately filtered/skipped): requester self-approval refused, genuine distinct fixture reviewer accepted, pointer activation persisted, executor could not activate, revocation removed numeric authority, historical revision remained readable. Paired authentication was simulated; memberships, sessions, policy rows, request records and audit history used the isolated real database. No real human approval, provider read/write or customer data.
- Scoped production TypeScript including the actual route passed.
- Independent source review found no important issues.
- Owned PostgreSQL fixture stopped in finally; no existing database/Neon branch was touched, migrated or deleted.

No client form or signed-app acceptance is claimed by this increment. Native policy authoring/review/activation and full executor coverage remain. No new environment setting, deployment, CI, permission, credential or provider action occurred.

Logs: /private/tmp/axiom-execution-policy-http-{red,green,types,pg}.log. Exact full production build is recorded separately after the source commit.
