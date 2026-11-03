# Workforce Coding PR: local outbound composition

Approved design: [workforce-coding-pr-outbound-proposal.md](workforce-coding-pr-outbound-proposal.md). Local source only; no provider request, real credential, schema change, deployment, native experiment or positive coverage/issuer qualification.

The actual ai_coding/code_pr_open runner now atomically claims the existing queued stage and creates a private, post-commit capability. Current immutable artifact/read/proposal/gate, actual bound voter principals and roles/API-key scope/expiry, actor membership, installation and absent enrollment are rechecked under the organization lock. No Agent claim or invented historical desktop session is used. API keys remain machine identities. A nonrenewable lease is capped by current actual voter expiry. The production issuer extractor still refuses before the stage CAS, leaving queued history untouched; coverage remains unavailable.

A persisted parent reserves the credential exposure before one exact coding_pr_write issuance. B blobs plus tree, commit, new-reference POST and PR are separately reserved and record one submission intent and typed receipt before dependency use (B+4, four for all deletion, maximum24). Immutable base/mode, exact reviewed files/content/body digests, prior receipts and canonical row/event histories are checked. Provider I/O runs outside database transactions. Lost response/commit acknowledgment never resumes or resends. All records remain drain blockers; no automatic quiescence, replay, force update or stronger provider CAS claim.

## Verification

External identity, token issuance, provider replies and authenticated principal fixtures are explicitly simulated. PostgreSQL, stage CAS, private claims, current authority reads, durable parent/child/event stores, real runner/executor/client and fixed credential factory are actual owned isolated implementations.

- Baseline vertical RED reached the first physical write with child counts `[0]`; implementation GREEN records `[1,2,3,4,5]`. Later integrated factory vertical passed with only provider/issuer ports simulated.
- Reviewed freshness gaps were reproduced by controlled reconstruction of the earlier draft, not misreported as an original untouched baseline: API expiry after committed intent allowed four effects; enrollment inserted after issued credential allowed four. Corrected source passed the corresponding three-case batch.
- Final coherent batch: **9 passed** (vertical, two freshness boundaries, actual canonical-unavailable preclaim, lost responses at each of five effects plus restart/no resend), fixture `mjy30fg2`, stopped.
- Changed-risk slice: **4 passed, 8 filtered**, including updated vertical intent-at-fetch and separate NOWAIT stage-row lock, reviewer/installation revocation during first response, committed-intent acknowledgment loss; fixture `dj77pq81`, stopped. Updated vertical overlaps the prior batch.
- Additional boundary slice: **5 passed, 12 filtered**: all-deletion four effects;20files24 effects with100755 preserved; actual global blocker scan; duplicate stage claim; altered receipt/history rejection. Fixture `590xnqmc`, stopped.
- Coherently rewritten ref/final-PR receipt plus matching event digest: **2 passed,17 filtered**; fixture `at6xnkdd`, stopped. Wrong ref proof prevents PR; wrong final receipt kind prevents success.
- Credential focused **8 passed**; immutable artifact/shared drain **30 passed**; existing completion/read/artifact checks **18 passed** with explicitly simulated private capability harness; unchanged file-mode/credential-client regressions **35 passed**; new exact coding token-purpose test **1 passed,18 filtered**.
- Independent final current-source review passed with no outstanding important finding; exact drain SHA256 `b02a61b4472a870b30851a35f40aab615e69143633b1c1a40496aa4542cba293`.
- Scoped Node24.21 TypeScript passed terminal0. Cached TypeScript printer then expanded multiline blocks only; no intended runtime change. No production/full build repeated. `git diff --check` passed.

Evidence and exact runtime/test hashes: [evidence/workforce-coding-outbound](evidence/workforce-coding-outbound). `shared-focused.log` intentionally retains the initial two outdated test-harness failures; `completion-corrected.log` records correction of that explicitly simulated harness, not a runtime relaxation. No aggregate single-run count is claimed.

This completes this bounded local Coding PR composition, not full Governance, executing issuer identity, runtime qualification, customer acceptance or production activation. Other pending admission/identity and authority gates remain unchanged.
