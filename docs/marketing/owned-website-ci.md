# Ephemeral website acceptance job

This is source prepared for independent review, not a successful browser acceptance result. No browser, server, image build, dependency installation, workflow dispatch, or production operation was run while preparing this harness.

The PR-only job checks out the immutable PR **head SHA**, not GitHub's synthetic merge SHA. `AXIOM_WEBSITE_CI_SOURCE_SHA` binds the private manifest and clean actual checkout to that head; `GITHUB_SHA` is not rewritten. Before execution the existing launcher independently recaptures and compares the complete manifest, including the added CI adapter, fixture sources, framework/configuration pins, Node executable, Chromium executable and managed environment identity. Runtime manifests must be newly generated; historical manifests are not reusable.

The existing public custom Next server, private owned output configuration, exact public GET/HEAD allowlist, denied API/external requests and full managed environment controls are unchanged. The existing limits remain: 300-second coordinator, 120-second capture session, 15-second CDP operation deadlines, 45-second DOM waits, 400 MiB owned-disk budget, and existing process ownership/cleanup checks. This job isolates local tool supervisor loss; it does not prove the cause of earlier `Page.navigate` timeouts or remedy cold compilation. A timeout remains a failed acceptance result.

The disposable GitHub-hosted job has read-only repository permission and no deployment, environment, database, billing or cloud credentials. Checkout does not persist its read token. `npm ci --ignore-scripts` uses the existing lockfile; explicit Prisma client generation is local code generation only, not a migration. No push trigger duplicates the PR job. Existing production CI/build validation and Vercel Git controls remain intact.

## Runtime provenance limitation

Official Docker image metadata was inspected read-only and lists `node:24.22.0-bookworm` (docker-node source commit `f27125230b3c367dcf63043ea3fe286fb3d0914c`). Anonymous registry digest lookup was unavailable from this environment. The fixed version tag remains mutable, and Debian Chromium packages are selected at CI execution time. These are explicitly not immutable supply-chain pins. Actual executable hashes and the actual runtime version enter each fresh private manifest. Checkout and upload-artifact actions use reviewed immutable action commit SHAs. No image was pulled or built during preparation.

## Evidence handling

The always-run collector revalidates clean actual source and the private manifest, matches at most one private owned window by exact hashes/framework/root, and refuses mismatched nonce/source, ambiguous ownership, symlinks, nonprivate files, unexpected filenames, malformed PNG headers, excessive dimensions or byte budgets. Only a newly created artifact directory becomes eligible after every input and copy succeeds. A failure never publishes a partial directory. No raw manifest, config, log, browser profile, environment, private path or process ledger is uploaded.

Artifacts contain only a closed public summary and these six approved PNG names when available: `home-desktop.png`, `agent-review-desktop.png`, `terraform-held-desktop.png`, `product-mobile.png`, `product-reduced-motion-mobile.png`, `approval-documentation.png`. Retention is seven days. Failure before manifest creation, hard runner loss or job timeout can prevent collection; infrastructure teardown is not a successful owned cleanup receipt.

`passed` requires a completed driver, unchanged source, owned groups proven empty, matching successful completion nonce, successful capture, and all six screenshots. That means isolated public website fixture acceptance only. It does not certify production login, payments, cloud execution, desktop installation or a real customer deployment. Screenshots still require visual review for presentation quality.

Before first execution: root must independently review this source change and integrate it with the intended application commit. Normal authorized PR CI may then run it. Do not dispatch or deploy as part of this source review.

## First CI refusal and bounded metadata correction

Run [39430262263](https://github.com/sahme209/visionxixlabs/actions/runs/39430262263)
on source `45155d78` installed dependencies and generated the local Prisma
client, then refused during manifest preparation at the unknown `NODE_*`
variable check. No application server or browser ran and no images were made.
The official image Dockerfile at
[`f27125230b3c367dcf63043ea3fe286fb3d0914c`](https://github.com/nodejs/docker-node/blob/f27125230b3c367dcf63043ea3fe286fb3d0914c/24/bookworm/Dockerfile)
exports `NODE_VERSION=24.22.0`; the job log reports that exact running binary
version. The original policy rejects this metadata, reproduced by a failing
regression before correction.

The policy now preserves this one metadata selector only when its value exactly
matches `process.versions.node`; it cannot select a runtime or load code. It is
included in the existing descriptor validation and captured-selector identity.
Absent metadata stays absent. Mismatched, empty, hidden, inherited, accessor and
nonstrings are refused, as are unknown `NODE_*` variables and unsupported loader,
OpenSSL, proxy or CA changes. No environment controls are stripped, request or
process permissions broadened, or deadline increased. The 73-test focused
policy/collector/managed-path run passes; a fresh exact-head CI result remains
required. This correction is not browser acceptance.


The next run, [39430988104](https://github.com/sahme209/visionxixlabs/actions/runs/39430988104),
passed environment validation but Git rejected the runner-owned top-level mount
as dubious ownership. The fixture intentionally ignores ambient global Git
configuration, including checkout's global safe-directory entry. No application
or browser ran. CI now checks out into a fresh `website-source` child directory
created by checkout under the container identity; all run steps use that same
directory. This avoids trusting the differently owned parent mount. It does not
add any safe-directory exception, change ownership recursively, or alter the
fixture's Git/environment checks. Actual CI must confirm the resulting ownership
and complete fresh manifest validation before browser acceptance is possible.

## Closed failure diagnostics

An actual CI window reported unchanged source, unsuccessful capture, unverified/failed cleanup, no images and no operation-timeout label. Those facts do not establish a hydration defect or a runtime root cause. The public summary now retains only explicitly allowlisted capture failure codes, `homepage_document`/`homepage_playback` phase, and the six closed DOM primitives already collected privately: readiness enum, tour presence, play presence, nullable play-disabled boolean, reduced-motion boolean and visibility enum. Malformed snapshots are omitted. Cleanup errors are mapped to a fixed enum; unknown messages become `unclassified`, never raw process paths or error text. The collector prints only this constructed closed summary to CI stdout as well as saving the sanitized artifact. No raw receipts, logs, config, browser profiles or manifests become public. All fixture guards, requests and time limits remain unchanged; a new exact-source run is necessary to establish the next diagnostic facts.

The next diagnostic adds the same-poll snapshot when a pre-image predicate throws, plus a closed exception class. It immediately preserves the existing `website_browser_evaluation_failed` failure instead of retrying or converting an exception to an unmet predicate. Other CDP evaluation exceptions retain only a closed class; observed runtime exceptions retain only a count bounded by the existing 128-category receipt limit. No exception messages, descriptions, stacks, URLs or page text are published. Cleanup adds parallel fixed role/stage/error-code diagnostics while preserving the original private errors and all ownership, signaling and failure decisions. Missing process metadata remains a failed/unverified cleanup condition.

The existing `home-desktop` capture intentionally moves between successful homepage document readiness and the still-mandatory playback readiness check. `homeCapturePhase=document_ready_before_playback` labels this document-state screenshot. This changes scroll/150ms capture timing; it is not behavior-identical and does not demonstrate hydration or working controls. The same six named captures remain, and playback readiness and every later interaction assertion are still required for acceptance. No deadline, permission, request rule, retry or screenshot budget is increased.
