# Public time-client source — direct-read recovery proposal

The prior exact public-source pass stopped after ONE web-tool attempt reported that the official GitHub releases API URL was inaccessible. No upstream body or tag was observed. That grant cannot be reused, and no alternate access attempt has occurred.

## Concrete proposed recovery

After new owner approval, permit up to SIX unauthenticated direct HTTPS requests, using the installed curl HTTP client instead of the web reader. The exact ordered URL selection remains PINNED-TIME-CLIENT-RESEARCH-REVIEW.md: releases (10 maximum), observed stable tag resolved to commit, immutable recursive tree, exact root Cargo.toml, one listed client file and one listed host/use-validity file. Do not invent paths, select prereleases, use floating main or infer missing guarantees.

Every request uses curl's disabled configuration, no proxy/auth/cookies, HTTPS only, no redirect following, maximum 10 seconds (5-second connect bound) and a 256 KiB body limit. Its parent caps captured public output at256KiB and ends the child by15seconds with at most5seconds cleanup. No retry, replacement URL/tool or seventh call. Stop on any unavailable/redirect/error/oversize/ambiguous/incomplete response. No stable release in the bounded listing also stops; that does not prove universal absence. Save only public response evidence and value-free execution errors. Review the collector and test its bounds using intercepted I/O before any real request.

The owner approval must explicitly cover this one direct-read recovery bundle, including the public curl invocations. Earlier source-read authority is consumed. The public collector performs no GitHub account/repository connector request and has no credential access.

## Exclusions and result

Research only: no dependency/lockfile change, adoption, installation, model/time query, signing, native runtime/helper, SQL, account/IAM/service/cloud resource, deployment, enablement or spending. It must not claim a qualified host/client merely because source is pinned. The deliverable remains an immutable supported client/API/use-validity assessment and explicit gaps for the complete real test-host proposal. Ordinary independently authorized local joined-time work may continue while approval is pending.
