# Public support wording correction — local source verified

The known CI-approval and GCP-setup evaluation misses reproduced on current source. Both correct guides already ranked first; the defect was answer eligibility, not missing product knowledge. “Set up” was split into two unrelated query terms, while ordinary “until someone” wording contributed irrelevant weight/rival matches.

The existing tokenizer now normalizes “set up” like its other multiword phrases and treats “until”/“someone” as function words. A negative example exposed that the existing rival-margin bonus could overwhelm low query coverage: a GCP question about unsupported quantum teleportation received an answer. Confidence is now capped by actual query coverage. The original 0.4 answer threshold is unchanged; the cap only decreases eligibility. Secret, workspace and action guards still run on the original question before retrieval. No exact-question lookup, model call, broader access or automatic fallback was added.

All 42 unchanged fixed evaluation questions now route correctly. The existing 90% assertion remains and an additional zero-miss assertion protects this fixed set. Dedicated regression cases cover the two formerly missed questions; unrelated telescope/social-network and unsupported GCP questions still receive suggestions. This small fixed evaluation is not a universal accuracy or security guarantee.

The public CI fact explicitly distinguishes the cooperative `vxl ask` check from the workflow's own `deploy.sh`, which the shell runs only after a successful check. Neither the fact nor a public answer grants permissions or proves native enforcement. GCP remains preview. The knowledge version, public guide, heading index, generated corpus and existing internal walkthrough are synchronized; no new public route or guide was added. Guide count remains 36, corpus 125 sections.

## Observed validation

- Initial focused regression: 2 failures/7 passes; both were suggestions despite the correct first source.
- Added unsupported-topic regression initially failed after phrase normalization, then passed with the coverage cap.
- Final related support/docs/navigation/demo checks: 82 passed.
- Full ordinary suite: 18,912 passed, zero failed tests/suites, 1,142 pending/skipped; 20,054 total. Pending/native/actual-SQL opt-ins are not acceptance.
- Root native types, desktop types/frontend build and 36 Python CLI tests passed. Existing Vite configuration/chunk/import warnings remain. No signed desktop app or native UI acceptance was produced.
- Independent source review: no important findings. Reviewer ran no programs or provider calls.

Exact hashes and scopes are in LOCAL-RECEIPT.json. Existing schema/native/platform code is unchanged. The separate approved production preflight stopped after one unverified Vercel metadata response; no decrypted detail, Neon or SQL call occurred, and its permission is consumed. No automatic repeat follows from this support fix.

Mandatory exact-head PR checks/merge, production target/schema/recovery and the complete real Governance qualification/enablement requirements remain. No AI inference, support provider read, production change, deployment, native signing/installation or spending occurred. This source checkpoint is not full B5/master-plan completion.
