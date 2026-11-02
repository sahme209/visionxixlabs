# Every-control documentation coverage

This is the source inventory and review queue for the master plan's documentation requirement. It is not customer documentation or a claim of complete coverage.

Run `node scripts/inventory-documentation-controls.mjs` from the repository. It uses the existing TypeScript parser, reads tracked TSX only, and never executes an application, provider call, credential operation or AI request. Each candidate includes its exact file hash and location. Current extraction: **749 files, 2,602 control candidates** (953 desktop /1,649 website);1,251 have dynamic or unresolved labels. These are source occurrences, not unique visible controls or supported customer features.

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
