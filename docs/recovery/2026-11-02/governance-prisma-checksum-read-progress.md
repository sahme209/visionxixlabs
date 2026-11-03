# Approved Prisma checksum reads

Approval `beda0eb0c44143139fdcf784b4b85fd6` authorized exactly two public checksum
GETs. `scripts/verify-local-prisma-engine-checksums.py` was invoked once. Each
fixed official URL was requested once, with redirects refused, no proxy/auth/cookie
configuration, no retries, a 20-second timeout, and a 1024-byte response limit.
No binaries were downloaded; no npm network, install, generation, or build occurred.

Both requests raised `HTTPError`. No expected checksum was accepted and no vendor
match is established. The original error branch failed to retain the numeric HTTP
status. That instrumentation omission was corrected afterward without repeating
either request. The historical status cannot be reconstructed from the saved
receipt and is not asserted here.

Original raw receipt: `/private/tmp/axiom-prisma-vendor-checksums-20261102.json`.
URLs, both under engine commit `605197351a3c8bdd595af2d2a9bc3025bca48ea2`:

- `https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/darwin-arm64/libquery_engine.dylib.node.sha256`
- `https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/darwin-arm64/schema-engine.sha256`

A separate local-only stable-descriptor read (no network) hashed both actual cache
binaries, retaining dev/inode/mode/link count/size/mtime/ctime and checking descriptor
and pathname state after bounded hashing. Mutable checksum sidecars were not read.
Raw local observation: `/private/tmp/axiom-prisma-local-engine-hashes-20261102.json`.

| Cache binary | Bytes | Observed SHA256 |
| --- | ---: | --- |
| `libquery-engine` | 17,251,592 | `e0f4077c48e80b36425e6b0295803593eed753988c5f31adfab966b739d4809d` |
| `schema-engine` | 19,831,920 | `57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a` |

These observations do not independently authenticate the engines. Vendor binding
remains unavailable. The previous 442 source cache inventory is historical, not a
new b675 inventory: its four missing pinned tarballs remain unresolved observations
(`@emnapi/core`, `@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`).
Real project preparation/build still requires current-source prerequisite checks
and reviewed native generation controls. Issuer identity and execution permission
remain unavailable. Another network attempt requires separate authorization.

## Local collector hardening (no requests)

Seven isolated mocked-response/owned-file tests pass:
`python3 -m unittest discover -s scripts/tests -p test_verify_local_prisma_engine_checksums.py`.
RED: `/private/tmp/axiom-prisma-collector-hardening-red.log`.
GREEN: `/private/tmp/axiom-prisma-collector-hardening-green.log`.
These reproduce and fix missing redirect status, leaking unexpected exception text,
and making requests before refusing an already-existing receipt. The first RED also
contained a test-only unsupported Python `Path.hardlink_to` call, corrected to
`os.link`; that compatibility error is not represented as a collector defect.

The tests verify mocked success against actual owned regular-file descriptor hashes
despite deliberately incorrect sidecars; exact two fixed GETs/no retry; bounded body
reads and wrong-filename refusal; HTTP 403/404 status preservation without remote
body/reason disclosure; HTTP 302 refusal without a second host request; symlink and
hardlink refusal; and existing receipt preservation before any attempted request.
Production requests were mocked throughout. The historical two-read receipt remains
unchanged, with its original numeric statuses unknown. Engines remain unqualified.

## Parent-enforced request deadline and single selection

The prior urllib timeout limited individual socket operations, not total request
wall time. Each selected request now runs in the same script's fixed worker mode,
with a clean environment and parent-enforced 22-second process deadline. On timeout
the parent kills the worker process group and reaps it. No retry follows. Only a
bounded, strictly validated JSON result is accepted. `--only schema` and `--only query`
select exactly one fixed URL; the original default remains the two fixed URLs.

Final **12 local tests pass**, including an actual owned sleeping child terminated
and reaped, an actual clean-environment child, schema-only one-request selection,
and malformed worker-result refusal. Network requests are mocked throughout.
GREEN: `/private/tmp/axiom-prisma-collector-wallclock-green.log`.
The genuine worker-validation RED (matched result missing both hashes was accepted)
is `/private/tmp/axiom-prisma-collector-wallclock-red.log`; this is fixed. The initial
process refactor preceded the new tests; no earlier behavioral RED for that refactor
is claimed. The original two vendor requests were not repeated. No engine binding,
new checksum diagnostic, install, generation, or application build occurred.
