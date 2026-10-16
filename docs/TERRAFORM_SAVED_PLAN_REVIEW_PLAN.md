# Inactive saved-plan artifact and desktop read boundary

Approved scope, 2026-10-16; base `2682ba73`. No live planning, backend, provider, apply, signing, quota, installer or approval mutation is enabled. Storage SQL is a proposal outside Prisma migration discovery. No existing Prisma model gains a column. The ECS review core is unchanged; Terraform approval remains explicitly unavailable.

The internal capture reader accepts a trusted owned producer context and exact binary bytes, writes an exclusive private snapshot, runs only a fixed executable's `show -json`, and hashes the same bytes before and after. It never accepts a caller-supplied show document, working-directory command or environment. Executable SHA256 and reported Terraform version must match the trusted context. Fixture pin 1.9.8 is not a customer CLI requirement. New fixture execution must not set or repurpose HOME: use TF_CLI_CONFIG_FILE/TF_DATA_DIR, an empty provider mirror and an allowlisted environment without credentials. The earlier feasibility probe used a task-owned HOME; that is an environment qualification, corrected by the checked-in runner.

Immutable binding covers organization/request/version, environment, target/configuration/provider-lock digests, Terraform executable identity, backend/workspace/state identity, credential connection revision and expiry. Local fixture binding explicitly has no remote backend or cloud credentials. Customer remote binding requires an authoritative producer that is deliberately absent. No API converts request assertions, a legacy lead, generated HCL or existing approval IDs into this authority.

Exact binary and derived JSON are encrypted using the existing scoped AES-GCM primitive with a new artifact-domain AAD (organization/request/artifact/digest/purpose), not a credential context. Public projection contains only resource address/provider/action counts, digest, expiry, evidence scope and explicit unavailable approval/backend authority. It never contains values, output/config/state, encryption envelopes or internal paths.

`savedPlanStore` uses parameterized raw SQL and probes feature table/catalog shape/constraints/immutable trigger and exact proposal checksum before artifact queries. No marker/tables means not installed; partial/marked missing/wrong shape means drift; query failure means unavailable. None grants authority. Tables cannot be silently adopted. Proposal requires parent tenant/request/version integrity at INSERT and forbids artifact UPDATE/DELETE; fixture tests install only in a new empty owned database. Runtime storage reads remain unavailable until separate storage approval/application.

Paired GET routes under `/api/desktop/deployments/:id/terraform-plans` require current workspace membership, pipeline:read, workspace:read and disallow API keys. Parent request tenant ownership is checked before optional storage. List/detail verify encrypted contents and binding against current request/version. Missing trusted backend/target/credential producer is displayed as unavailable, never current or approved. Read returns stored artifact evidence with `executionEnabled:false`; stale/tampered artifacts are blocked. No creation/upload/approval/apply endpoint exists.

Desktop adds a selected-request read panel via existing DeploymentRequestsView, no App/Settings changes. Selecting another request or changing transport credential discards prior content and late results. Only an explicit read fetches artifacts. Errors show recovery text and retain no stale summary. Backend unavailable, empty and expired are distinct from a successful plan or no changes.

Implementation plan (inline, no subagents):

- [ ] TDD exact-byte capture/strict decoding and artifact envelope; reuse summarizeTerraformPlan and the existing Terraform capability boundary.
- [ ] TDD proposed storage/readiness and immutable tenant-bound store; no new Prisma migration/model.
- [ ] TDD paired list/detail read handlers and actual desktop panel/client methods.
- [ ] Update Desktop App Pairing demo and customer acceptance documentation in the same commit.
- [ ] Focused tests/lint/diff; root schedules heavy checks and owned PostgreSQL/HTTP acceptance, owns review/push/PR/merge.

Acceptance: genuine pinned Terraform builtin terraform_data saved binary -> own show -> encrypted record -> exact sanitized list/detail, corrupt/substituted binaries, unknown action/incomplete plans, mixed tenants, absent/partial/drift storage, stale request versions, ciphertext/summary mutation and session/request changes. Owned PostgreSQL verifies proposal rollback, atomic immutable insert, tenant/version rejection and optional-read fallback. Actual paired HTTP tests use existing owned fixture when the coordinator opens that window. Genuine local artifacts and synthetic tenant authority are labelled separately; cloud backend locks, current approval, apply and recovery remain unverified.

Execution ledger:

- Baseline: 12 existing summarizer/kill-switch tests passed; no product changes before approved plan.
- Ruling: no approval-core extraction or new approval engine; all new DTOs fix approval to unavailable and execution to false.
- Ruling: no runtime producer implementation for remote customer plans; local CLI capture proves bytes-to-show behavior only.
