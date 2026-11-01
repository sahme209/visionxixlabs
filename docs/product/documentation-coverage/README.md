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
