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
