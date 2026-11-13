# One finite pinned time-client source assessment — proposed

## Why this is next

PR329 merged the joined original execution checks after seven green exact-head checks,229actual isolated SQL cases and a coherent offline build. Real native time/runtime/custody/fleet/provider qualification remains unavailable. The last approved tag read succeeded, but returned only pre-release tags and stopped its stable-only selection rule. No remaining read slot is reusable. Repeating that listing or the failed release endpoint is not proposed.

The saved PUBLIC-TAGS-OBSERVED/OBSERVED-RESULT records identify AWS clock-bound tag3.0.0-rc.0 at commit371058f8f6a1786d4a4ab3eed9f5f2f16eea7777. This is ONLY a candidate for source assessment of an isolated test host, not a supported/stable/production dependency selection. No library, native adapter or real qualifier is adopted by this proposal.

## Proposed bounded exception

Permit local reader preparation, mocked tests and independent file review, followed ONLY if those pass by one finite public-source pass of at most EIGHT requests:

1. One unauthenticated HTTPS GET to https://api.github.com/repos/aws/clock-bound/git/commits/371058f8f6a1786d4a4ab3eed9f5f2f16eea7777 . Require the exact expected commit and one40hex tree SHA; reject contradictory/missing metadata.
2. One GET to that returned exact tree SHA under https://api.github.com/repos/aws/clock-bound/git/trees/<treeSHA>?recursive=1 . Require nontruncated tree and valid regular-file entries. Never repeat tags/releases, follow branches, traverse submodules/symlinks or guess failed paths.
3. Up to SIX UTF-8 text GETs from https://raw.githubusercontent.com/aws/clock-bound/371058f8f6a1786d4a4ab3eed9f5f2f16eea7777/ using paths positively enumerated by that tree. Select only root README/workspace Cargo metadata, the matching client Cargo/API/read/error implementation and relevant license/notice files. Prioritize exact client version/platform/API/valid-through-use/error guarantees and licensing. Verify each returned file against its Git tree blob SHA using the canonical Git blob header. Missing required files or exhausted budget means incomplete evidence, never approval to improvise or adopt.

Each request:10-second transfer/15-second child bound,256KiB maximum; no authentication, proxy, cookies, redirects, retries, transport fallback or unbounded raw output. Abort the whole pass on any error or contradictory response. Save only these public source texts and nonsecret result hashes. Reader rejects every other owner/repository/commit, arbitrary path and consumed tag/release endpoint. No real clock query, AWS account/API, customer data, credential, install, compilation/execution of fetched code, cloud resource, deployment, enablement or spending.

## Deliverable and stop

Produce ONE source-backed suitability/gap assessment for the isolated-host design: exact candidate version/commit/license, documented and implemented platform/clock/error/validity behavior, maintenance/pre-release concerns, required qualification tests and unresolved limits. If the source cannot establish the required contract, report that plainly and present an owner decision instead of automatically starting another read loop. Actual dependency adoption, trusted keys/OS/runtime changes, real host/custody qualification and fully bounded setup/cost approval remain separate.

Status: DESIGN ONLY; no new reader, public request, dependency or provider action performed. Standing external-read restriction requires fresh owner approval before execution.
