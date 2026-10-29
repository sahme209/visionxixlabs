# Protected publisher installation review

LOCAL implementation only. Nothing here establishes accepted native installers or authorizes a paid build, credential placement, public upload, activation flag or publication.

Keep private source/signing keys in visionxixlabs. The opt-in export_draft job reuses exact tag/source and existing candidate/signing gates, uploads only the bounded signed flat payload to a new DRAFT in axiom-releases, and leaves it unpublished. The original private publish job/guard remains unchanged. Both paths default off.

Install the publisher workflow in the public artifact repository only after review. Copy only these public-safe verifier scripts and the existing public verification key; never private application files or keys. The existing RELEASES_REPO_TOKEN must first prove narrowly required contents and administration-read capabilities without printing it. Reusing it in another repository's protected secrets requires explicit approval; do not create a new credential or expand scopes implicitly. Configure actual human required reviewer protection on desktop-release and verify immutable releases enabled before enabling AXIOM_PROTECTED_PUBLISHER_READY. The job also reads the actual protection and immutability state; unknown/forbidden reads refuse publication.

Review exact source SHA, private candidate run ID, signed manifest SHA256, native acceptance and draft release ID. Public verifier checks all five platform groups, declared target/version, exact digests/sizes, pinned-key signatures, exact asset set and unchanged remote IDs/digests. Downloaded assets are data, never executed. Public publishing uploads no signing key and runs no application source.

GitHub draft publish is not an atomic compare-and-publish operation. Exclusive trusted release-writer authority is required from final verification through publication: suspend other release-writer workflows/operator edits for that short window. No unverified If-Match behavior is assumed. A post-publication discrepancy is an incident requiring human investigation, never success or automatic resend/republication. Do not describe this sequence as atomic. This trust assumption must be included in the activation review.

Actual installers still require clean-host acceptance. GPG is not Windows Authenticode and does not remove SmartScreen warnings. Do not claim free GPG signatures solve that warning. The website derives released installer metadata from GitHub; verify all public download URLs and byte hashes after release before claiming v0.1.21 available. No placeholder installers or false signing attestations.

API prerequisite reference: https://docs.github.com/en/rest/repos/repos#check-if-immutable-releases-are-enabled-for-a-repository
