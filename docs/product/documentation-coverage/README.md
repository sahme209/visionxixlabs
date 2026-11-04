# Every-control documentation coverage

This is the source inventory and review queue for the master plan's documentation requirement. It is not customer documentation or a claim of complete coverage.

Run `node scripts/inventory-documentation-controls.mjs` from the repository. It uses the existing TypeScript parser, reads tracked TSX only, and never executes an application, provider call, credential operation or AI request. Each candidate includes its exact file hash and location. Preserved extraction snapshot `4c2143fd32d9556877033587709b570c11dee5af`: **749 files, 2,602 control candidates** (953 desktop /1,649 website);1,251 have dynamic or unresolved labels. This is not a freshly rerun inventory or proof that later source bytes/line locations are unchanged. These are source occurrences, not unique visible controls or supported customer features.

The initial extraction set includes buttons, fields, links and common Axiom wrapper components. Native Swift/Rust/OS controls, custom wrappers not in the set, generated actions, responsive variants and conditional states require manual/runtime inventory. Repeated component use can produce both duplicates and unexpanded instances. Candidate IDs are matching aids; assign a permanent help ID during review, rather than treating offsets or generated IDs as a stable public API.

## Review each candidate

1. Confirm the actual screen, accessible label, purpose and supported product version. Resolve dynamic/generated variants and group duplicate source instances deliberately.
2. Assign a stable screen/control help ID and customer goal; identify the exact prerequisites, current permission/connection requirements, action effects, expected outcome and exclusions.
3. Document normal, empty, unavailable, denied, expired, stale, uncertain and recovery states that actually apply. Never turn an unknown provider result into a retry instruction.
4. Capture the real app with synthetic fixtures. Link labeled screenshots and captioned/transcribed video. Keep mock/local preview versus live evidence distinct. Redact private data before any public upload.
5. Attach source/runtime verification, review owner/date and version. Publish only approved content; preserve historical revisions and link replacement/supersession.
6. Add search terms for customer language, exact control names and errors. Retrieval may explain documented steps but cannot grant permission, impersonate a reviewer or authorize a provider action.

## Support knowledge record

`article-record.schema.json` defines the proposed versioned record format for approved knowledge. A schema alone does not implement ingestion, retrieval, an AI support agent or execution. Draft records are deliberately ineligible for support answers. Later ingestion must validate schema, classification, approval, current supported version, source/media integrity and supersession; retrieval must cite approved sources and disclose missing evidence.

## Completion gates

- Every shipped screen/control and reachable state has a reviewed mapping or an explicit documented exclusion.
- Every customer CTA reaches a valid destination; every action guide identifies its effect and relevant safeguards.
- Real screenshots/demos and accessible alternatives are linked, with current version evidence.
- Search/retrieval evaluations cover normal help, revoked access, expired approval, uncertain result and unsupported functionality.
- No unreviewed source candidate is counted as documented, tested, customer-ready or supported by an AI answer.

## First source-grounded draft (2026-11-02)

[Agent reviewed action, revision 1](articles/agent-reviewed-action.r1.json) maps seven proposed stable control IDs to the actual review, requester preparation/execution and recovery controls. It binds each inspected source file by SHA-256 against base commit `6a65a675bd38ee80cd1ec0cc96e3cc897394df8e`. The worktree may differ from that commit; hashes, rather than the base name alone, determine applicability. This is **internal, draft, source-only local-preview knowledge**, ineligible for customer/support answers. No human approval, shipped version, authentic media or live acceptance is asserted. The original inventory remains unreviewed and unchanged; this draft does not promote any candidate to completed coverage.

Before ingestion, validate the record against the existing schema, verify every source hash, review factual claims against the supported release, capture relevant real screens/states with safe fixtures and accessible alternatives, and obtain a genuine review. Record its date and actual version only after verification. Retain immutable revisions; append a new revision with explicit supersession instead of silently rewriting approved history. A source/hash mismatch quarantines the record until re-review. Unknown and consumed execution history must remain intact.

[Representative retrieval cases](agent-reviewed-action-evaluation.json) specify required evidence and safe responses. These are evaluation fixtures, not evidence of a running retriever or passing retrieval tests. An eventual evaluator must reject this draft for customer answers, require an approved current version, return article/revision citations, test source/version/supersession failures, and disclose missing evidence. Do not ingest tenant content, credentials or approval material as public help. Future local/cloud assistant architecture and cloud data-boundary review remain separate open gates.

## Current source draft, revision 2

[Revision 2](articles/agent-reviewed-action.r2.json) replaces revision 1 for the local source-review queue through `supersedes: axiom.help.agent.reviewed-action@1`. It binds 13 exact source hashes to base commit `e47286704060e53828e96f9320aa2e9761da342e` plus the worktree snapshot. Its AWS wording is limited to the exact immutable release-tag/current-template source profile now qualified locally; source qualification grants no permission. Production activation, genuine human review and live acceptance are not evidenced. The article remains internal/draft/source-only with no media.

Revision 1 bytes remain unchanged (`40a20b6f51440b366e164b37023010e8cd0ca770db7b71419832096246f9f157` SHA-256). Its [historical fixtures](agent-reviewed-action-evaluation.r1.json) remain bound to those bytes and the old version. Current source validation of that historical bundle is expected to fail on the changed eligibility source: quarantine it rather than rebinding the historical record. The main evaluation fixture file now targets revision 2 and its exact bytes; the AWS case has been reviewed against the newly qualified source limitations. These ten cases remain proposed, not executed retrieval evaluations. The local validator defaults to revision 2.

## Offline schema and integrity checks

The local validator uses the installed `ajv-formats` dependency's Ajv 8 draft-2020-12 engine and date/time formats; it never installs dependencies or contacts a provider. `article-record.schema.json` remains the article contract; `retrieval-evaluation.schema.json` now defines the proposed fixture contract. Fixtures bind the exact article bytes, article ID/revision and product version. Changing an article requires deliberate fixture re-review and rebinding; changing a source fails validation until the article is re-reviewed. The validator does not update hashes automatically.

From the repository root, run:

```sh
node --test docs/product/documentation-coverage/validate-support-knowledge.test.cjs
node docs/product/documentation-coverage/validate-support-knowledge.cjs --version 'local-source-preview:e47286704060e53828e96f9320aa2e9761da342e; base commit plus worktree snapshot; exact files bound by SHA-256'
```

Use `--article`, `--evaluation`, `--root` and an explicit `--version` for another bundle. Unknown CLI arguments fail. The validator checks full schemas, formats, target-version equality, fixture/article integrity, unique question IDs, source/media hashes, and readable evidence/transcript paths contained within the repository (including resolved symlinks). It reads files only and preserves execution and article history. Unavailable dependencies, files, mismatched versions and stale hashes fail closed.

`--customer` additionally fails on a draft, superseded/withdrawn record, internal classification, local-preview version or media lacking public review. For the current article, this **must fail** with `article_not_approved`, `article_not_public` and `local_preview_not_shipped`. A normal-mode pass means a well-formed and hash-matching draft, not approved customer content. These metadata checks cannot authenticate a human reviewer, establish release availability, detect a newer article absent from the supplied bundle, prove semantic accuracy or execute retrieval. A future ingestion/catalog process must enforce genuine editorial approval, the actual supported-version catalog and supersession across all revisions; proposed answer text is not a passing retrieval result. No assistant or ingestion service is activated by these files.

## Deployment baseline review draft, revision 1

[Deployment review and separate requester execution](articles/release-deployment-reviewed-action.r1.json) is a new **internal, draft, source-only local-preview** article, separate from the preserved Agent revisions. It binds 24 exact file hashes at `b0e1ba3c40fc877b8969c56dec7b66f627f79a80` plus the worktree snapshot, maps ten named approval/execution controls and includes [sixteen proposed evaluation cases](release-deployment-reviewed-action-evaluation.r1.json) bound to the exact article bytes and version. These cases have not been executed against a retriever.

The [revision-1 control mapping](release-deployment-reviewed-action.inventory.r1.md) records proposed stable help IDs, exact accessible labels, original inventory candidate IDs and current component hashes. Original inventory candidates remain unreviewed; historical inventory locations/hashes are matching aids rather than claims that old bytes are current. Dynamic workflow inputs, all reachable states, other release controls and the wider app/website inventory still require runtime review.

The guide distinguishes the displayed optional baseline from an execution grant. Missing required or changed baseline consent refuses; no active digest is silently attached to an older decision. Independent approval does not dispatch. The designated requester separately prepares and deliberately executes once. Lost acknowledgments, uncertain outcomes and consumed approvals retain their original history; recovery does not resend. Historical accepted observation is not renewed admission, application-health verification or rollback proof. Production coverage remains empty and enrollment activation refuses at this bound source snapshot, so this article does not claim complete Governance or a finished MVP.

Validate this bundle explicitly; the validator's existing Agent default is unchanged:

```sh
node --test docs/product/documentation-coverage/validate-support-knowledge.test.cjs
node docs/product/documentation-coverage/validate-support-knowledge.cjs --article docs/product/documentation-coverage/articles/release-deployment-reviewed-action.r1.json --evaluation docs/product/documentation-coverage/release-deployment-reviewed-action-evaluation.r1.json --version 'local-source-preview:b0e1ba3c40fc877b8969c56dec7b66f627f79a80; base commit plus worktree snapshot; exact files bound by SHA-256'
```

Adding `--customer` must refuse this bundle with `article_not_approved`, `article_not_public` and `local_preview_not_shipped`. Offline schema/hash/fixture-format validation is not an executed support retrieval evaluation, genuine human review or native acceptance. No screenshots, demos, captions/transcripts, publication, support ingestion or assistant activation are supplied. Capture authentic safe media, verify the actual supported release and obtain genuine editorial approval before any customer use. Preserve this revision and append a new version when source or behavior changes; do not overwrite history or automatically rebind stale hashes.


## Highest stored deployment draft revision: 3 — not current-release authority

[Revision 3](articles/release-deployment-reviewed-action.r3.json) is the highest numbered deployment draft currently stored in this directory. Its metadata binds `local-source-preview:4fb99c78e9eec08e343f69347f72eb95feae4ec2; base commit plus worktree snapshot; exact files bound by SHA-256` and supersedes revision2. It remains **draft/internal**, with no reviewer or review date. Its [23 evaluation cases](release-deployment-reviewed-action-evaluation.r3.json) are explicitly `proposed-not-executed`; listing them is not an executed retrieval result.

This index does not certify that revision3 matches today's worktree or a shipped release. Current source hashes, supported-version/catalog authority, genuine editorial approval and authentic media must be independently validated before use. Missing or stale evidence must quarantine the bundle, never resurrect an older revision automatically. Revision1/2/3 article and evaluation bytes remain preserved; no customer eligibility, ingestion or retrieval authority is granted by this correction.

## Historical deployment source draft: revision 2

[Revision 2](articles/release-deployment-reviewed-action.r2.json) is a preserved **internal/draft/source-only local-preview** deployment guide at `b9011c472f26c26d679cca5dcf6b519a9a952fa1` plus its exact SHA-256 worktree snapshot. It supersedes article revision 1 for this source-review queue, retaining ten proposed help IDs and binding 24 exact files, including the [new revision-2 control map](release-deployment-reviewed-action.inventory.r2.md). The [twenty evaluation cases](release-deployment-reviewed-action-evaluation.r2.json) are proposed, not executed retrieval results. Revision 1 article/evaluation/map bytes remain unchanged and its changed source hashes must quarantine it on current-source validation.

This revision distinguishes admission before approval consumption/attempt claim from final numeric/provider-proof checks after the database clock and transaction return. Pre-claim rollback is distinct from a consumed post-claim refusal/unknown; neither allows automatic resets/resends. Deployment-specific original-session expiry-port qualification, complete coverage/enrollment and live acceptance remain open. Genuine editorial approval, authentic safe media and supported shipped-version verification are still absent; customer validation must remain blocked. Validator defaults and historical commands above are unchanged. Validate the revision-2 bundle by substituting its two `.r2.json` paths and exact `productVersion` into the explicit command above; do not rebind or overwrite revision 1.

## Repository nested-controls draft: revision 1

The [repository nested-controls article](articles/repository-editor-nested-controls.r1.json) is an internal draft for its exact local-source preview, not a shipped or editorially approved help article. The article binds nine evidence files; its [source manifest](repository-editor-nested-controls.r1.sources.json) binds eleven entries, including the article and evaluation files; its [seven evaluation cases](repository-editor-nested-controls-evaluation.r1.json) are explicitly proposed, not executed retrieval. The unchanged validator accepted the new bundle and intentionally refused customer mode; [validation receipt](../../recovery/2026-11-03/repository-nested-draft-record/receipt.json). Current-source freshness, genuine editorial/release approval and authentic media still require verification before any customer use. Preserve this record rather than rebinding old hashes automatically.

For the human-readable source-guide queue, see the [internal task index](../knowledge/README.md). That index does not grant retrieval eligibility or execution authority.


## Outlook internal structured source draft (November4)

[Outlook article revision1](articles/outlook-controls.r1.json) and [eight proposed evaluation cases](outlook-controls-evaluation.r1.json) preserve connection/read boundaries versus independently reviewed email/calendar actions and unknown/no-resend recovery.28unique source hashes checked;27historic ranges across25codefiles remain unchanged. Newbundleofflineintegrity passed; customer eligibility intentionally refused. These are source metadata and proposed cases, not accepted media, editorial review or executed retrieval. [Evidence](../../recovery/2026-11-04/outlook-structured-knowledge/README.md).


## Teams/Linear internal structured source draft (November4)

[Article revision1](articles/teams-linear-controls.r1.json) and [eight proposed cases](teams-linear-controls-evaluation.r1.json) distinguish genuine review, exact task/connection/target binding, requester execution once and unknown recovery. Newbundleintegrity passed; customer mode refused. These are source drafts, not executed retrieval/live-provider evidence. [Receipt](../../recovery/2026-11-04/teams-linear-structured-knowledge/README.md).


## Slack internal structured source draft (November4)

[Slack article revision1](articles/slack-reviewed-action-controls.r1.json) and [eight proposed cases](slack-reviewed-action-controls-evaluation.r1.json) retain exact task/connection binding, independent review, requester preparation/send once and unknown/no-resend limits.16source hashes/14ranges verified; historical guide preserved. Newbundleintegrity passed; customer mode refused. No executed retrieval or live Slack acceptance. [Review/evidence](../../recovery/2026-11-04/slack-structured-knowledge-author/independent-review.md).


## Native sign-in and browser pairing internal draft (November4)

[Combined article revision1](articles/native-signin-browser-pairing.r1.json) and [eight proposed cases](native-signin-browser-pairing-evaluation.r1.json) keep browser approval, native verification/save, entitlement and execution authority distinct. Newbundle integrity passed; customer mode refused. [Evidence](../../recovery/2026-11-04/signin-pairing-structured-knowledge/README.md). No actual retrieval, clean-host, native or customer acceptance.


## Home, navigation and Settings internal draft (November4)

[Combined article revision1](articles/home-settings-navigation-controls.r1.json) and [nine proposed cases](home-settings-navigation-controls-evaluation.r1.json) retain navigation/effects, preferences uncertainty, incomplete Governance preview and external billing boundaries. Newbundle integrity passed; customer mode refused. [Review/evidence](../../recovery/2026-11-04/home-settings-structured-knowledge-author/independent-review.md). No executed retrieval/runtime/customer acceptance.

The [guide-to-article source linkage queue](guide-article-linkage.md) maps indexed guide paths to direct article source references; it is not a control-coverage or customer-eligibility score.


## Releases workspace internal structured draft (November4)

[Article revision1](articles/releases-workspace-controls.r1.json) and [ten proposed cases](releases-workspace-controls-evaluation.r1.json) preserve scope/review/execution/evidence/recovery and Axiom-versus-provider closure. Newbundle integrity passed; customer mode refused. [Evidence](../../recovery/2026-11-04/releases-workspace-structured-knowledge/README.md). No executed retrieval or runtime/customer acceptance.


## Batches/Airflow internal structured draft (November4)

[Article revision1](articles/batches-airflow-controls.r1.json) and [nine proposed cases](batches-airflow-controls-evaluation.r1.json) retain distinct read/run/automation/combined approval and uncertain dispatch semantics. Two known privacy-only route changes are explicitly reviewed, not silently rebound. Newbundle integrity passed; customer mode refused. [Review/evidence](../../recovery/2026-11-04/batches-structured-knowledge-author/independent-review.md). No live Airflow, on-prem, Temporal, retrieval or runtime acceptance.


## Jira internal structured source draft (November4)

[Article revision1](articles/jira-release-controls.r1.json) and [nine proposed cases](jira-release-controls-evaluation.r1.json) preserve discovery/association/exact review/provider/native-closure distinctions and historical no-repeat boundaries. Newbundle integrity passed; customer mode refused. [Evidence](../../recovery/2026-11-04/jira-structured-knowledge/README.md). No current Jira or ServiceNow state or execution acceptance inferred.


## ServiceNow internal structured source draft (November4)

[Article revision1](articles/servicenow-evidence-closure-controls.r1.json) and [ten proposed cases](servicenow-evidence-closure-controls-evaluation.r1.json) preserve consumed written-UNKNOWN history and separate observation/native lifecycle/policy/exact closure gates. Historic guide locators are qualified rather than silently rebound; current ranges are separately recorded. Newbundle integrity passed; customer mode refused. [Review/evidence](../../recovery/2026-11-04/servicenow-structured-knowledge-author/independent-review.md). No live ticket/journal state, closure, retrieval or runtime acceptance.


## Agent workspace internal structured draft (November4)

[Workspace article revision1](articles/agent-workspace-controls.r1.json) and [nine proposed cases](agent-workspace-controls-evaluation.r1.json) supplement rather than supersede old reviewed-action records. Known keyboard-guard drift is explicitly recorded in the new current receipt. Newbundle integrity passed; customer mode refused. [Evidence](../../recovery/2026-11-04/agent-workspace-structured-knowledge/README.md). No executed retrieval, native/customer or complete Governance acceptance.


## Repository acquisition and base editor internal draft (November4)

[Combined article revision1](articles/repository-acquisition-base-editor-controls.r1.json) and [ten proposed cases](repository-acquisition-base-editor-controls-evaluation.r1.json) preserve local-write, clone-token, unknown-save and separate push boundaries. Metadata-only source drift is explicit; old/nested records remain. Newbundle integrity passed; customer mode refused. [Review/evidence](../../recovery/2026-11-04/repository-base-structured-knowledge-author/independent-review.md). No executed retrieval, native filesystem or customer acceptance.


## Cloud setup and public catalog internal drafts (November4)

[Cloud article](articles/cloud-connection-controls.r1.json) and [twelve proposed cases](cloud-connection-controls-evaluation.r1.json) preserve guided/advanced/provider-grant/readiness boundaries. [Evidence](../../recovery/2026-11-04/cloud-connections-structured-knowledge/README.md). [Public website catalog article](articles/public-integrations-catalog-controls.r1.json) and [eight proposed cases](public-integrations-catalog-controls-evaluation.r1.json) describe browsing, not desktop/account access. [Review](../../recovery/2026-11-04/public-integrations-catalog-structured-knowledge-author/independent-review.md). Newbundle integrity passes/customer refusal remains; no retrieval/runtime/customer acceptance.
