# Offline exact-source preparation progress

Local source preparation only. No project dependency install, Prisma generation,
Next build, vendor checksum request, binary download, or issuer identity qualification
was performed in this increment.

## Implementation and qualification

- `scripts/build-local-issuer-package-source.py` reads a full committed Git revision,
  validates the committed npm v3 lock, and prepares bounded exact archive extraction
  and SRI-verified content-only cache copying. Local package links must resolve to
  archive-owned package bytes. Mutable workspace dependencies are not a fallback.
- Offline installation uses a clean environment, two distinct exclusive empty
  configuration files, ignored lifecycle scripts, and kernel-denied network access.
  The original cache and repository are write-denied in the child process.
- The CLI currently performs read-only preflight. `execute_build` refuses pending
  independent engine binding and generation review. Preparation is not executing
  issuer identity, package sealing, upstream supply-chain qualification, or authority.

## Exact checks

`python3 -m unittest discover -s scripts/tests -p test_build_local_issuer_package_source.py`
passed **9 tests** on final source. Raw receipt:
`/private/tmp/axiom-offline-source-final-tests.log`.

The actual controlled fixture used Node 24.21.0/npm 11.19.0, an owned fixture TAR,
an archive-owned local package, and only copied SHA512 content blobs (no cache index).
Actual `npm ci --offline --ignore-scripts` succeeded with network denied; root and
dependency lifecycle markers remained absent. An empty-cache actual install failed
`ENOTCACHED` without fetch fallback. Owned fixtures were removed by test cleanup.
These are fixture observations, not a real application build.

RED evidence: `/private/tmp/axiom-offline-source-red.log` records missing implementation;
`/private/tmp/axiom-offline-source-green.log` records the genuine npm duplicate
`/dev/null` user/global configuration failure before the distinct-owned-file fix;
`/private/tmp/axiom-offline-source-path-red.log` records archive case-collision
acceptance before the path fix. Final nine-test receipt supersedes earlier green logs.

## Actual committed-source preflight

Revision: `442ef5b84b92fcfeb0a80ade30816d6c09d14736`.
Command: `python3 scripts/build-local-issuer-package-source.py --repo . --revision 442ef5b84b92fcfeb0a80ade30816d6c09d14736 --cache-source /Users/samirahmed/.npm/_cacache`.
Raw receipt: `/private/tmp/axiom-offline-source-442-preflight.json` (unavailable; CLI exit 2).

959 of 963 selected Darwin arm64 tarballs passed committed-lock SHA512 verification
(194,101,567 bytes). Four cache content paths were missing: `@emnapi/core`,
`@emnapi/wasi-threads`, `@napi-rs/wasm-runtime`, and `@tybys/wasm-util`.
Optional status alone does not prove platform exclusion; none was silently omitted.
72 packages were excluded by explicit lock platform constraints.

Prisma's SRI-verified engines tarball contains no required native engine payload.
The locked engine commit is `605197351a3c8bdd595af2d2a9bc3025bca48ea2`, target
`darwin-arm64`. Mutable local binary/sidecar agreement is not independent binding.
The actual cached, SRI-verified Prisma downloader source derives these official
uncompressed checksum URLs; neither was fetched:

- `https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/darwin-arm64/libquery_engine.dylib.node.sha256`
- `https://binaries.prisma.sh/all_commits/605197351a3c8bdd595af2d2a9bc3025bca48ea2/darwin-arm64/schema-engine.sha256`

Potential subsequent commands have **not started and are currently blocked by missing prerequisites**:
`node scripts/check-vercel-build.mjs`, explicit Prisma generation, then
`node node_modules/next/dist/bin/next build --webpack`, with network denied and only
independently verified owned engine copies. Missing cache/engine prerequisites must
be resolved and the exact generation plan reviewed before any real project install/build.
No production coverage, legacy qualification, activation, or execution permission is implied.
