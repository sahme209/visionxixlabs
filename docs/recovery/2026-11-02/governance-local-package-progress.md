# Local package verifier and seal controls — progress receipt

November 2, 2026. **No executing issuer identity, accepted production package, outbound binding or activation is supplied.**

New isolated tooling in `scripts/governance_local_issuer/` implements strict canonical manifests, closed materialization attempts from a successful Next stage, file-set verification, fail-closed launch preflight, and an owned read-only data-fixture probe. It never emits `issuerArtifactDigest` or a bootstrap capability. The private compiled consumer/verifier must eventually share one canonical external CommonJS module; Python observation JSON cannot initialize it.

## Local verification

- `/private/tmp/axiom-issuer-package-green.log`: **27 isolated Python tests passed**. No broad suite or Next rebuild was run.
- Genuine negative receipts cover total-entry/path/trace limits (`axiom-issuer-package-bounds-red.log`), full-stream late PEM (`axiom-issuer-package-late-key-red.log`), growing read budgets (`axiom-issuer-package-stream-red.log`), cross-chunk whitespace (`axiom-issuer-package-pem-boundary-red.log`), quoted parser literals (`axiom-issuer-package-parser-literal-red.log`), dangling receipt links (`axiom-issuer-package-receipt-symlink-red.log`) and manifest hardlinks (`axiom-issuer-package-manifest-hardlink-red.log`), all under `/private/tmp/`.
- Receipt and manifest writes now use owned private output, directory descriptors and exclusive/no-follow creation. Existing manifests permit only an exact regular-file, single-link, read-only idempotency check; they are never overwritten through aliases.
- State, byte, path and metadata-read bounds apply during streaming. PEM recognition is stateful across arbitrary whitespace; it is not a generic secret guarantee. Required `.env`, credential configuration, private keychain/SSH/AWS inputs and recognizable private PEM material refuse rather than being silently omitted. Full native/dependency execution qualification remains unavailable.

## Actual owned control probe

`/private/tmp/axiom-issuer-readonly-seal-probe.json` records the data-only fixture at `/private/tmp/axiom-issuer-seal-qxls9u5a`: UDRO creation, read-only attach and detach all exited 0; `statvfs` flags were 3 and write creation failed with errno 30 (`EROFS`). The mount is **detached**. A separate owned sandbox child was denied backing-file writes with errno 1 and exited 0. Host facts: Darwin arm64, macOS build `26B123`. The retained local image and `probe.json` contain fixture data only.

This establishes those kernel controls only. It does not establish a complete Next process/native/loader sandbox, hostile-host protection, private pre-import bootstrap or a running issuer's identity.

## Exact successful build, unsuccessful package attempt

The only production stage inspected/materialized was root's successful `eae00077ee130731d7721bc9dd5b544054867b05` build at `/private/tmp/axiom-deployment-baseline-production-vpje2mso`, archive SHA-256 `2ed0870862beb9441224aa176c5c12657a8d8f3e83c767dabdb70f94969c9db6`, 5,970 verified source files. Original build receipt: `work/governance-intelligence/merge-enrolled-aggregate-production-build.json`. No second compilation or stage patch was performed.

Materialization **refused**, not passed. `/private/tmp/axiom-issuer-eae-materialization-final.log` records unstable dependency metadata while verifying `node_modules/@aws-sdk/client-ec2/dist-types/runtimeConfig.browser.d.ts`; the partial package under `/private/tmp/axiom-issuer-package-final-4800xp9q` was removed. Earlier attempts are negative diagnostics, not accepted package receipts. No package digest was promoted to executing identity.

Bounded single-file probes in `/private/tmp/axiom-issuer-source-stat-probe.json` and `/private/tmp/axiom-issuer-source-stat-diagnostic.json` found the inspected files stable **at that later probe**. They do not prove whether earlier instability was hydration or a genuine change. Stability checks were not relaxed; safe future diagnostics identify changed stat field names without file contents. No repeated full-copy loop is claimed as qualification.

The stage also shares a mutable workspace dependency root; new consumer-package workspace links created after its build cannot be silently imported into that old artifact. A future exact build/package must bind archive-owned package bytes, materialize the complete dependency closure and establish the actual pre-import consumer, runtime and seal path. Fleet/legacy/provider-effect qualification and production coverage/activation remain unavailable throughout.
