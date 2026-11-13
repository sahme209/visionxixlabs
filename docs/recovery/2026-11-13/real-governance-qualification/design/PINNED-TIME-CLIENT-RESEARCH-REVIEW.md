# Exact time-client research — proposed public-read scope

Status: PREPARED, not authorized or executed. Earlier public allowances are consumed. This is required research for the still-incomplete real host/time/custody qualification proposal, not library adoption or a change to the approved security boundary.

The prior pass established a floating-main protocol description and rendered Ohio illustrative prices, but did not identify an accepted immutable supported client/release. One linked Rust-client document returned404. Do not repeat that URL, infer a client from the protocol, invent a freshness/drift bound, or treat a source hash as native qualification.

## Proposed allowance: at most six unauthenticated official public GitHub reads

No searches, account/repository connector access, tokens, cookies, credentials or customer content. Only aws/clock-bound public metadata/source text:

1. `https://api.github.com/repos/aws/clock-bound/releases?per_page=10` — inspect available stable release candidates. If no stable release is identified, stop and report that fact; do not silently choose a prerelease or floating main.
2. `https://api.github.com/repos/aws/clock-bound/commits/<observed-release-tag>` — resolve that observed release tag to one immutable commit. No guessed version/tag.
3. `https://api.github.com/repos/aws/clock-bound/git/trees/<observed-commit>?recursive=1` — locate actual manifest, client and host/time-contract files. A truncated/ambiguous listing is insufficient; no guessed path.
4. `https://raw.githubusercontent.com/aws/clock-bound/<observed-commit>/Cargo.toml` — inspect exact workspace/package version and supported client/build structure.
5. One actual client contract/implementation file at the same immutable commit, selected only from that verified listing.
6. One actual host/time-validity contract or client-use document at that same commit, selected only from the verified listing.

Stop on unavailable, ambiguous or insufficient evidence without retry, replacement guesses, additional calls or automatic follow-up research. Treat pre-release-only availability as a recorded unresolved design/adoption decision. Every read counts, including an error. Responses are public text only and are not executed or adopted.

## Deliverable

Save the release/tag/immutable-commit relationship, exact inspected paths and relevant source evidence; identify supported host/client/API, interval growth/freshness/use lifetime, restart/generation and failure semantics that are actually established, and explicit gaps. Update the connected qualification/cost proposal only with supported conclusions. Existing illustrative prices are not a full quote or spending authority; host choice and complete trial quote remain subject to review.

## Exclusions

No installation, dependency or lockfile change, library adoption, key/time query, native clock/daemon/helper execution, signing, accounts/IAM/services/resources, cloud access, actual SQL, credentials, deployment, enablement or spending. This scope does not authorize any experiment or real qualification trial. The native gate stays closed; all genuine review, custody, expiry, consumed-attempt and owner production limits remain intact.
