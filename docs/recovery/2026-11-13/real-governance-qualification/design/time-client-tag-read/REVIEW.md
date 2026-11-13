# Proposed stable time-client source pass — finite public text research

## Reason and current evidence

The previous direct public release-list request succeeded and showed only alpha GitHub releases. It stopped as approved; that endpoint is now expressly rejected by this separate reader. It did not inspect stable tags/package source and cannot prove their absence. No supported/pinned usable client has been established. The local Cargo source cache also contained no matching clock-bound source. This new pass addresses that specific missing candidate evidence, without another release-list or floating-main loop.

## Exact prepared scope

Prepared reader/test hashes and finite order: PREPARED.json. Five mocked tests pass; no real request has been made. The original reader/receipts remain unchanged. This new copy permits only the exact official AWS repository tags endpoint, a40hex-pinned tree and selected pinned text sources; it rejects the consumed release endpoint, commits/main, foreign hosts, credentials, noncanonical URLs and binary paths. Responses are treated as untrusted source data, never executed.

After NEW owner permission and independent file review, invoke up to six sequential public requests:

1. `https://api.github.com/repos/aws/clock-bound/tags?per_page=100`; select only a plain stable semantic tag with an exact40hex commit, as a research candidate, not an adopted/supported qualification.
2. That exact commit's recursive Git tree. Require a nontruncated, bounded response and actual listed source paths.
3. The listed root Cargo.toml, if present, to identify workspace/client coordinates.
4. The actual client Cargo.toml at that same pinned commit and tree path.
5. The actual client src/lib.rs at that same coordinate.
6. The listed client or root README.md for its documented API/source contract. If needed files cannot be identified unambiguously within the remaining slots, stop and report that precise gap rather than guessing another URL.

Every call uses the fixed no-configuration/no-auth/no-proxy/no-redirect/no-retry HTTPS reader:10second request,15second killed-child ceiling,256KiB cap. Stop on any error, unavailable/malformed/oversized metadata, no admissible stable tag, unsupported/truncated tree, ambiguous client path or six used requests. Never retry or switch transport after failure. An ordinary semver name proves neither maintained status nor suitability; inspect manifest/source limitations and record unknowns honestly.

Public source/metadata text only: no clone, binary download, package adoption/installation, returned-code execution, native clock request, real credential/provider account access, resource creation, SQL, deployment, enablement or spending. Complete real clock/custody/channel/fleet and end-to-end qualification remains separate even if a candidate is found.

The standing external-read restriction requires fresh owner consent before any request. This prepared packet is not that consent and does not reuse the previous consumed grants.
