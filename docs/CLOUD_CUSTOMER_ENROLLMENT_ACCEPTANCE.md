# Cloud customer enrollment and governed execution acceptance

Reviewed 2026-10-15 against main `3df6d03f92d2eaa198ba021adfda86825c2c1a32` (PR #138). This is a read-only source audit. No customer credential, provider connection, deployed schema, cloud operation, or real customer acceptance was exercised. Passing fixtures and an existing SDK do not establish a working customer journey.

## Acceptance matrix

| Customer step | What is actually implemented | Unfinished work / acceptance boundary |
|---|---|---|
| GitHub installation | Desktop `/api/desktop/integrations/[provider]/connect` provides GitHub consent handoff; `resolveTenantScopedToken.ts` selects an organization-owned active installation and repository-scoped token. | Real customer installation, callback, revocation and repository access remain unverified in this audit. |
| Website cloud enrollment | `/api/cloud-operator/start` creates a Lead and signed starter token. `/api/connectors/link` verifies that token, requires a cloud-operator Lead, applies tier/feature/rate gates, validates AWS/Azure/GCP through connector modules and persists encrypted connector data in the Lead payload. | This is existing enrollment code, not an absent feature. Its Lead-token authority is not an accepted-member desktop workspace connection contract. No live enrollment was attempted. |
| Website AWS quick-create callback | `/api/aws/cfn-callback` verifies starter token, validates role/account/external-ID shape, performs STS validation, and saves encrypted role configuration. Both callback and link bridge AWS status into a personal workspace derived from email. | End-to-end callback, account identity binding, token/challenge scope, workspace bridge and actual permissions require acceptance review; a derived personal workspace is not proof of membership in an arbitrarily selected team workspace. |
| Website setup UI reachability | `app/dashboard/connect-cloud/page.tsx` calls start/link and reuses provider setup components under `app/operator/onboarding`. | Current `proxy.ts` redirects `/dashboard/*` and `/operator/*` browser pages to download. The APIs still exist; historical UI implementation is not a currently reachable hosted onboarding journey. Do not remove preserved functionality or change routing as part of this audit. |
| Desktop cloud enrollment | `desktop/src/views/ConnectorsView.tsx` explicitly says enrollment is unavailable for AWS/Azure/GCP; setup view routes there and reads lifecycle digest. | Missing scoped desktop cloud enrollment flow. The desktop consent endpoint supports GitHub/Slack/Teams/Linear, not cloud enrollment. This desktop gap must not be described as proof that all website enrollment code is absent. |
| Provider connection and inventory | AWS STS, Azure subscription/resource SDK reads and GCP project/compute/storage SDK reads exist in connector/adapter and snapshot modules. `/api/scan/trigger` can locate a cloud-operator Lead by authenticated user/email, decrypt AWS role configuration and run inventory. | Actual configured tenant identity, least privilege, inventory correctness and durable shared-workspace ownership are unverified; format-only validator outcomes are not live validation. |
| AI proposal | Agent repository tools and snapshot-driven cost/execution-plan generation exist. Agent writes are proposed for human approval. | No complete authenticated customer cloud-data-to-proposal journey verified. Generic cloud plans do not imply executable adapters. |
| Governed approval | Desktop approve route requires `agent:approve`; `browserApprovalDecision.ts` checks tenant proposal, digest, expiry, no self-approval, current Agent policy and atomic decision claim. | Runtime acceptance still depends on schema, customer membership/roles, configured policy and real provider access. |
| AWS generic cloud apply/verify/rollback | AWS adapter dispatches existing simulated apply handlers; verification module returns `not_verified`; rollback returns a generated plan. | No generic live optimization executor, provider-read verification or executed rollback is established. Registry booleans indicating a method exists must not be read as live capability certification. Legacy IAM live mutation remains default-denied pending tenant authorization. |
| AWS ECS deployment | Separate tenant GitHub/OIDC workflow can restart an existing ECS service, wait for stability and select the previous task definition on failure. | Restart is not an approved source/artifact deployment. Immutable artifact/task-definition/approval binding and real sandbox health/rollback receipts remain missing acceptance. Existing PR #135 safeguards are preserved, not duplicated here. |
| Azure/GCP execution and rollback | Connection/snapshot methods exist; `AzureAdapter` and `GCPAdapter` apply/rollback return `provider_not_implemented`. | Real mutation and rollback adapters are missing implementation, separately from provider credentials. |
| Complete customer acceptance | No verified receipt chain from new customer signup through cloud connection, AI proposal, approval, execution, observed health and rollback was established by this audit. | Keep the overall journey unverified. Production authentication recovery and approved sandbox/provider acceptance remain dependencies. |

## Durable storage and existing vault boundaries

These are three distinct existing storage paths:

1. **Lead-based legacy connector storage exists.** `Lead` has tracked creation migrations (`20250225180000_add_lead`, `20260219120000_add_lead_model`); link/callback store `fullPayload.connectors[provider].encryptedCredRef`. Despite its name, this field contains an encrypted envelope, not evidence of a separately scoped vault record. `lib/security/credentialVault.ts` provides AES-GCM encryption. This path must be preserved until a reviewed migration/compatibility decision.
2. **Organization lifecycle storage exists in tracked migrations.** `20260525150000_add_connector_setup_session/migration.sql` creates `ConnectorSetupSession` and `ConnectorSetupTransition`. It deliberately uses provider text because the legacy CloudProvider enum has no tracked SQL definition. Lifecycle rows do not themselves bind a cloud account or credential to an organization.
3. **CloudAccount schema is not a verified migration contract.** `prisma/schema.prisma` declares `CloudAccount` with `organizationId`, provider/external account uniqueness and a `credentialRef`. A search of all tracked `prisma/migrations` at the audited commit found no CloudAccount definition/reference or CREATE TABLE statement. Application code reads/toggles existing CloudAccount rows, but no `cloudAccount.create/upsert` enrollment call was found. This proves a repository migration/creation gap, not that the actual production table is absent: historical out-of-band creation is possible. Protected read-only schema inspection and migration-ledger comparison are required before proposing exact reconciliation SQL. Do not run db push or infer a safe create from a missing search result.

The existing legacy credential reader in `lib/plugins/credentials.ts` loads a Lead by caller-supplied credentialsKey and decrypts its connector. That helper's lookup has no organization predicate; Azure/GCP retrieval parameters explicitly ignore userId. Its comment saying per-tenant retrieval is not an authorization mechanism. Do not wire new desktop enrollment or shared-workspace reads directly to this helper. Likewise, AES-GCM without tenant additional authenticated data protects ciphertext integrity but does not establish ownership. Existing scoped `encryptScopedCredential`/`decryptScopedCredential` helpers can bind new envelopes to organization/provider/record context; adopt only through a reviewed storage contract, without silently rewriting legacy records or rotating keys.

## Highest-impact next independently executable milestone

**Deliver tenant-scoped desktop AWS enrollment through verified read-only inventory.** This closes an actual first-step customer blocker while preserving the website Lead-token path. It is not permission to perform production enrollment, provision IAM trust, migrate production storage or execute a workload.

### Dependency order and minimum reviewed contract

1. **Inventory the durable schema in an isolated fixture and prepare protected read-only production inspection.** Reconcile CloudAccount/CloudProvider creation history, existing credential representations and lifecycle relations. Produce an additive, reviewed storage proposal if necessary. Do not append speculative production history fixes or mix them into auth-only recovery. Any production SQL requires the existing backup/restore and explicit exact-change approval gates.
2. **Define canonical cloud connection authority.** Server derives organization/user from a bearer desktop session, requires accepted membership and `connections:manage`, and selects the account within that organization. Request JSON cannot choose another organization or authorize a vault reference. Read, validate, replace and disconnect operations must all enforce this authority.
3. **Bind a short-lived enrollment challenge.** Bind provider, intended organization, initiating operator, expected account, role/external-ID context and expiry. Replays, changed account/role and cross-workspace callbacks fail closed. Keep broker credentials server-side; no customer access-key field is needed for the first AWS role-based slice.
4. **Reuse real read-only validation through a tenant-aware IO boundary.** STS AssumeRole/GetCallerIdentity must match the intended AWS account and role before connected is persisted. `valid_format_only`, missing broker, denied role or unavailable provider do not become connected. No IAM role/trust creation or policy write occurs in this operation.
5. **Persist only verified identity and scoped configuration.** Choose the reviewed account/vault contract from step 1; encrypt any new sensitive configuration with organization/provider/record binding. Record lifecycle/audit evidence and validation time without secrets. Do not bulk adopt legacy Lead connections or infer team access from email. Mark unavailable/migration-pending honestly if required storage is absent.
6. **Read inventory using the same connection.** Accepted membership, connection organization, enabled state, exact account/role and least-privilege credential scope remain enforced at every read. Revocation disables access; inventory and AI proposals use actual observations, never sandbox samples in a real workspace.
7. **Wire desktop enrollment/status/recovery to that service.** Preserve existing design and pairing, show format-only versus provider-verified state, permit safe explicit retry, prevent stale completions overwriting newer configuration, and retain unavailable states for Azure/GCP until their corresponding enrollment contracts are implemented.

### Independently executable regression acceptance

Run real desktop components and route/IO composition against simulated provider boundaries plus an isolated PostgreSQL fixture for the reviewed schema. Cover accepted admin enrollment to exact-account inventory, operator/read-only denial, revoked membership, cross-tenant Lead/vault references, wrong account/role, expired/replayed challenge, preview-only validation, provider outage, concurrent replace/disconnect, context-bound ciphertext substitution, secret-free responses/audit, missing tables and preserved legacy signed-token flows. These tests prove implementation behavior, not live customer acceptance.

## Separate external acceptance and approval gates

- **Read-only provider acceptance:** use an explicitly identified nonproduction customer workspace/account and authorized read-only role. Verify actual identity, least privilege and bounded inventory against known resources. Record sanitized receipts. Existing access must be supplied securely; do not request or paste connection secrets. A connection test is not permission to create or modify IAM/cloud resources.
- **Provider infrastructure/setup:** any new role, trust, service principal, key, bucket, branch, policy or resource needs explicit approval. In particular, do not invoke `/api/aws/quick-deploy-url` during a supposedly read-only audit: its `ensureTemplatePublished()` path can create a bucket/policy and upload a template.
- **Governed write acceptance:** a later separately approved sandbox plan must bind approved artifact/source, immutable image digest, exact tenant target, provider permissions, cost bounds, health checks, prior artifact and rollback procedure before dispatch. Prove denial and induced-failure rollback, then reconcile audit/provider receipts. Connection approval does not authorize deployment, Terraform apply, production routing or billing.
- **Production readiness:** production login, intended database binding, usable recovery point and verified restore remain separate gating work. This document is a dependency plan, not production execution approval or a completed customer journey.


## Follow-up read-only schema evidence

A catalog-only SELECT on the previously inspected Neon main target confirms
CloudAccount and CloudProvider are absent, while ConnectorSetupSession and
ConnectorSetupTransition are present. See
`docs/mission/neon-readiness-inspection.json`. No account rows, credentials,
DDL or migration history were changed. The serving deployment/preflight resource
binding remains unverified, so this finding is scoped to the inspected target.
Do not mix cloud enrollment schema reconciliation into the proposed auth-only
repair or assume code can safely use CloudAccount before its reviewed storage
dependency is satisfied.
## Owned local AWS HTTP rehearsal

The explicit test-only `AXIOM_RUN_LOCAL_AWS_HTTP=1` option extends the owned
`AXIOM_RUN_LOCAL_AUTH_HTTP=1 node scripts/run-owned-local-auth-http.mjs` launcher.
The default authentication rehearsal remains unchanged. No product runtime test
flag, entitlement grant, credential-row seed, or provider override was added.

The extension uses the actual Next routes, accepted signup/pairing identity,
Prisma storage, scoped credential encryption, enrollment service and installed
AWS SDK. A separate owned literal-loopback Query/XML fixture answers only
AssumeRole, GetCallerIdentity and DescribeInstances. A process preload installed
before Next patches Node HTTP/HTTPS entry points, synchronizes ESM builtins,
rejects destinations outside owned loopback ports, and substitutes fixed native
agents. Every SDK wire request must have a matching process/sequence stamp;
fixture readiness precedes cloud IO. This is bounded native-SDK transport
containment, not universal Node network isolation or real AWS IAM validation.

The child omits HOME, ignores inherited NODE_OPTIONS/AWS settings, disables EC2
metadata, uses `/dev/null` shared AWS configuration and synthetic keys, and uses
SDK-native STS/EC2 endpoint settings. No external AWS requests are intended or
permitted through this guarded path. New SDK transports require review before
adding them to this fixture.

Assertions cover actual role challenge/completion, route-created canonical
account and context-bound encrypted configuration, challenge replay denial,
metadata-only foreign-account denial before provider reads, bounded inventory,
local disconnect/version invalidation, and denied subsequent inventory without
more provider traffic. The foreign row is owned synthetic metadata, has no
credential, and is removed in `finally`. No paid plan, deployment execution or
Terraform job may be created. App, protocol server, mail capture, Prisma client
and the exact owned PostgreSQL container have independent cleanup paths; the
wire server forcibly closes active sockets with a bounded close deadline.

This complements schema/CAS fixtures. It does not prove a real AWS account,
actual IAM trust/permissions, production schema or database binding, native UI,
OAuth, Stripe checkout, governed deployment execution or rollback. Those retain
separate acceptance and approval gates.

### Verified local result (2026-10-16)

Committed source `644f539d0c86f0d2c5acddd82cfb35717eb8b769` passed the owned
PostgreSQL 17 + actual Next HTTP extension: all existing 25 authentication,
pairing and approval assertions plus 10 cloud lifecycle assertions. Five stamped
SDK requests were observed in one guarded Next process, exactly AssumeRole,
GetCallerIdentity, AssumeRole, GetCallerIdentity, DescribeInstances. The owned
container was removed. No paid entitlement or provider write was performed.
The first run reached enrollment completion HTTP 200 but failed because this
new test read `.data` instead of the existing `.data.account` response; the
fixture-only parsing correction preceded the successful committed-source rerun.
No application response contract changed. See
`docs/mission/local-cloud-http-acceptance.json` for scoped evidence.

The same explicit owned HTTP/PostgreSQL17 run also passed on committed combined
source `b98f6587` after normal integration of main #155/#156 (`cdb3996d`). All 35
assertions and the exact five stamped SDK wire requests passed again, and owned
container removal was confirmed. The original `644f539d` report remains intact;
this later result is stored under `additionalSourceRuns`. No real AWS/IAM or
commercial acceptance claim is added.
