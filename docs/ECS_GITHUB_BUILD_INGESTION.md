# Internal GitHub build-evidence ingestion

This source adds a read-only resource adapter to the existing offline Sigstore verifier. It has no public route, enabled execution lane, AWS adapter, schema change, approval authority, or deployment dispatcher. No live GitHub request or production change was used to validate it.

## Authority and resource boundary

The reader requires current accepted owner/admin membership, a tenant-owned repository and environment, the selected durable review policy, an active tenant GitHub installation and its revision, and the enabled branch-policy snapshot. It captures and rechecks those identities before resource reads and after verification. The default snapshot and installation lookup use the same explicitly supplied database client; an injected snapshot without a client needs an explicitly injected token resolver. No ambient token/database fallback is available to that path.

Existing GitHub transport and App credential resolution are reused. App JWT creation and installation-token POST are credential issuance, distinct from the subsequent GET-only repository, workflow, run/attempt and attestation reads. The new permission profile requests only contents/actions/attestations read for one repository. Its cache is separated from legacy tokens. Returned grants must match, with only metadata read additionally allowed, repository_selection must be selected, and the returned repository list must contain exactly the requested repository. Omitted grant fields or unsupported permission availability make the adapter unavailable; this response schema/profile has not been verified against the user's live App. Existing callers retain their legacy behavior.

The operation has a 30-second total deadline; individual network requests have an 8-second cap. Metadata bodies are bounded to 256 KiB, downloaded bundles to 1 MiB, cumulative resource body reads to 4 MiB, attestation listings to five entries without pagination, workflow content to 128 KiB, and token response bodies to 64 KiB. Streams are aborted/canceled on bounds. There are no network retries, redirects, pagination, arbitrary API paths or caller-supplied roots/origins.

Bundle downloads require a server-reviewed HTTPS origin and the exact numeric repository attestation path. A policy covering other repositories cannot authorize reads for this operation. Downloads carry no installation bearer, cookies or referrer. Real production bundle origins still require private operator review/configuration; there are no runtime defaults. Root hashes check configured-root consistency, not the origin or approval of those roots. Private Sigstore profiles remain unavailable.

## What evidence means

The adapter compares API repository numeric ID and name, non-fork source repository, successful current run and exact attempt, source commit, caller workflow path and source commit, and the pinned reusable signer reference. Workflow content is read at the exact source commit and its Git blob hash is verified separately from the workflow commit SHA. The actual offline verifier then checks signature/transparency evidence and signed caller/run/attempt/source/signer/digest bindings. Initially only branch push and workflow_dispatch with workflow commit equal to source commit are supported; tags and other event semantics are unavailable.

Enabled branch rules are snapshot/change fences here. Their presence does not prove PR review, CODEOWNERS, ticket, promotion, readiness or approval requirements were fulfilled. Results are verified build provenance only, never ReviewFacts or execution permission. inspectManifest maps the complete OCI subject set and checks candidate expiry and mutation again after I/O.

The positive regression uses a genuine upstream signed wheel and simulated tenant/API metadata. It proves composition of actual cryptographic verification with adapter binding checks; it does not prove a live GitHub read, an Axiom build, OCI publication, cloud connectivity or a customer deployment. Negative tests cover scope changes, foreign repository downloads, reruns, forks, source/workflow mismatches, bounded streams, scope grants, deadlines, manifest mutation and expiry.

## Remaining production dependencies

Reviewed runtime trust roots and actual bundle-origin policy, a compatible runtime, verified live App response/grants, and authentic project OCI attestations remain required. AWS target/task-definition/ECR baseline and image observations, health/rollback correlation and independently verified ReviewFacts are separate unimplemented adapters. Approval and execution remain disabled; no source-only build proof grants them.

Reference API contracts: [GitHub attestation endpoints](https://docs.github.com/en/rest/repos/attestations?apiVersion=2026-03-10), [App installation tokens](https://docs.github.com/en/rest/apps/apps?apiVersion=2026-03-10), and [REST breaking changes](https://docs.github.com/en/rest/about-the-rest-api/breaking-changes). The 2026 API returns bundle_url rather than relying on an inline bundle.

## Local verification

Focused transport/token/snapshot/adapter/cryptographic regressions: nine files, 112 tests passed; the existing demo scenario suite also passed 15 tests. ESLint over changed server and test paths passed without warnings; git diff --check passed. All API responses, installations and database snapshots in these tests are controlled fixtures; only the explicitly labeled upstream offline signature is genuine. No provider request, installed-workflow claim or production state is inferred from these results.

Web TypeScript passed with the existing installed root and desktop dependencies resolved through worktree-local links. The initial attempt stopped on missing desktop Tauri modules before that local dependency link was added; no source workaround was needed. Full combined-source tests, desktop gates, Python and production build remain integration gates, not implied by this focused result.
