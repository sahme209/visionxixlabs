# Deployment documentation revision 3: local source qualification

Runtime source: `4fb99c78e9eec08e343f69347f72eb95feae4ec2`. All 31 runtime, test and harness files in the new article match that commit exactly; the control map and preserved candidate inventory complete its 33 hash-bound sources. This is an internal draft, not a published help article or an approval.

- [Article revision 3](articles/release-deployment-reviewed-action.r3.json) supersedes revision 2 only for this local source-review queue. SHA-256: `c3e760359a5383735e96e0c6b3fcbc54414ec1a2971a4ded3953b90937ca155a`.
- [Control map revision 3](release-deployment-reviewed-action.inventory.r3.md) retains ten proposed help IDs and exact labels; dynamic workflow inputs, all states and wider app/website controls remain incomplete. SHA-256: `339ffaed0cca1c17beb4520a4de32c7905563b9dd60d867a2739ef3bde1b12e4`.
- [Evaluation revision 3](release-deployment-reviewed-action-evaluation.r3.json) binds the exact article bytes and version. Its 23 cases remain `proposed-not-executed`. SHA-256: `84c7c89632cf0d31cd92c42f09ba6cdd0f8ae45b2892694eb758689e96e69257`. No retriever, support assistant or ingestion run is claimed.

## Qualification change and its limits

Revision 2 recorded original deployment session expiry as unqualified. The new [authority](../../../lib/desktop/releaseDeploymentAuthority.ts) re-establishes the current original executor and independent reviewer sessions using locked persisted rows after reloading the audited original approval. The [store](../../../lib/tauri/releaseDeploymentExecutionStore.ts) retains private session, provider, policy and time checks across the final database clock and commit delivery. The [governed wrapper](../../../lib/governance/intelligence/governedReleaseDeployment.ts) and [positively absent legacy coordinator](../../../lib/desktop/releaseDeploymentGovernanceCoordinator.ts) require a published private function; [the fixed transport](../../../lib/tauri/releaseDeploymentTransportGithub.ts) invokes it synchronously inside its final scheduled callback immediately before POST. A copied digest, numeric level or serialized truth marker is not authority.

Existing local receipts inspected for this revision report four original-session PostgreSQL cases (reviewer/executor expiry during approval or commit delivery while the provider proof remains fresh), one genuine delayed-helper proof case, and two mounted HTTP/services positives (enrolled exact approval and positively absent custom environment, each one dispatch/no resend). Source definitions are hash-bound in the article. These are separate targeted receipts, not a new combined full-suite result or reruns performed for this documentation revision. Pairing, provider replies and explicit coverage/enrollment qualification ports are simulated. Receipt pointers: `/private/tmp/axiom-deployment-original-session-pg.log`, `/private/tmp/axiom-deployment-outside-helper-green-pg.log`, `/private/tmp/axiom-deployment-positive-composition-pg.log`; local summaries are `work/governance-deployment-baseline/original-session-verification.txt` and `publisher-positive-verification.txt`. Temporary receipts are not customer-facing proof or durable support citations.

Remaining gates include complete mutation-family and alternate-caller coverage, production enrollment/activation, mixed-runtime exclusion, legacy/native credential and in-flight drain/unknown-provider qualification, genuine human and native acceptance, live provider validation, authentic safe screenshots/demos with required captions/transcripts, supported shipped-version verification and genuine editorial approval. Recovery retains consumed history; no retry, reset, permission grant or production configuration change follows from this article.

## Offline validation only

One normal-mode invocation of the existing validator passed for revision 3: schemas, exact source/article hashes, explicit version and fixture format; 33 sources, 23 cases. Log: `/private/tmp/axiom-deployment-documentation-r3-validation.log`. One explicit customer-mode invocation failed as required with `article_not_approved`, `article_not_public`, `local_preview_not_shipped`; log: `/private/tmp/axiom-deployment-documentation-r3-customer-validation.log`. `customerEligible` is false. Empty media, null editorial reviewer/time and source-only verification remain unchanged.

Reproduce the read-only normal validation from the repository root:

```sh
node docs/product/documentation-coverage/validate-support-knowledge.cjs --article docs/product/documentation-coverage/articles/release-deployment-reviewed-action.r3.json --evaluation docs/product/documentation-coverage/release-deployment-reviewed-action-evaluation.r3.json --version 'local-source-preview:4fb99c78e9eec08e343f69347f72eb95feae4ec2; base commit plus worktree snapshot; exact files bound by SHA-256'
```

Appending `--customer` must refuse. No validator defaults or schemas were changed. Revisions 1 and 2 article, map and evaluation bytes were checked against their pre-edit SHA-256 values and remain unchanged; stale historical source bindings remain historical rather than being silently refreshed.
