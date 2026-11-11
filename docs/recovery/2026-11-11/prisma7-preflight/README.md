# Prisma 7 migration — local candidate

The earlier preflight/migration checkpoint is preserved verbatim in [INITIAL-PREFLIGHT-RECORD.md](INITIAL-PREFLIGHT-RECORD.md); its incomplete local-work statements describe that earlier checkpoint. The unresolved live-target/schema findings remain current.

Prisma/client/adapter 7.10.1 replaces the legacy runtime with the modern generated client and explicit PostgreSQL adapter. Workflow-generated lockfiles only; retained TypeScript 5.9 API, native 7 checks. The schema generator/datasource metadata changes; all 175 models/enums/relations and migration SQL are unchanged.

## Preserved behavior and tested changes

- Every application constructor retains its exact selected target, isolated-runtime marker checks and private instance separation. AST migration manifests record 114 import changes and 40 constructor conversions. Eleven ordinary Node script sources retain their target expressions and guards; none of their write/rehearsal entrypoints was executed.
- Missing database configuration refuses before a network connection, without ambient PG fallbacks. Explicit identities/password callbacks, public search path, finite pool/wait limits and verified remote TLS are tested against actual driver construction.
- Generated-schema required-field tests compare actual generated metadata with current source and reject stale generation, absent models and new required fields.
- Current-source recipe helper uses reviewed Prisma 7 CLI/schema/engine pins, URL-free schema input and `/2` unqualified output. Four mocked tests and six old-driver tests pass. Old `/1` packet driver refuses the new command; historical packets/receipts are unchanged. No actual schema-engine export, native issuer or custody qualification occurred. [Pin review](OFFLINE-RECIPE-REVIEW.md).

## Local validation

- Root native TypeScript: pass.
- Full Vitest rerun: 1,569 files / 17,835 tests pass, 100 files / 893 tests skipped, one expected failure. No unexpected failures. This run predates adding the three opt-in PG tests; no later application runtime changes.
- Actual fresh owned PostgreSQL: three additional tests pass for generated JSON/date CRUD and P2002, parent/child atomic rollback, and concurrent Serializable transactions producing one commit plus P2034. Uses only a new socket-only cluster and synthetic records; existing DurableAgentWorkflow migration sets up that fixture. No production/customer/provider activity. Server stopped and confirmed; files preserved.
- Production build: pass, strict source checks, Next checks and 299 static pages. Existing native-addon/optional instrumentation warnings remain; no clean-warning claim.
- Desktop native types and Vite frontend build: pass; existing chunk warnings remain. No signed installer or native visual/platform acceptance.
- Python CLI: 36 pass.
- Independent source reviews: no remaining important findings, including explicit adapter targets, generated metadata assertions, recipe pins/refusals and actual PG test boundaries. Reviewer ran no programs/provider requests.

## Deployment and qualification blockers — not waived by CI

The recorded Neon branch differs from the historical build-3 receipt: AuditSeal and AgentGatewayRequest tables/ledger rows are absent. The approved private Vercel target comparison stopped after its metadata call; no decrypted value was read. Do not retry, repair or deploy automatically.

Driver differences need qualification against the genuine production target: default pool maximum 10 replaces the old CPU-derived default; the tighter connect/pool budget can refuse earlier; strict `channel_binding=require` is unsupported and deliberately refuses. No silent TLS/channel-binding weakening is included. Actual production compatibility remains unverified.

Historical Prisma 5 engine/client/issuer/checkout profiles are not renewed by this migration. They require freshly reviewed modern closure recipes and their existing execution/custody gates before reuse. Their deliberate refusal is not live Governance acceptance. OAuth projection's pinned old standalone recipe is retained as historical/incompatible; do not run it with this candidate.

No production deploy, DB write, grant, feature flag, signing, installer publication, AI call or spending. Owner production approval/click and database procedures remain mandatory. Prisma major Dependabot holds remain until this PR is accepted/merged; post-merge removal belongs to the ordered follow-on work.
