# Catalogue test startup: read-only diagnosis

November 5, 2026. No new Node/test invocation, install, repair or dependency/cache mutation performed for this diagnosis.

Saved attempts `/private/tmp/axiom-catalogue-loading-red.log` (Node25.2.1 direct) and `/private/tmp/axiom-catalogue-loading-red-node24.log` (Node24.21.0, existing wrapper) both fail before collection at Node's package-scope reader: `ERR_INVALID_PACKAGE_CONFIG` for the exact repository `node_modules/vitest/package.json`. Neither includes the underlying parser detail or a snapshot of bytes read at failure time. Neither is behavior RED.

Current ordinary-file observations:

- Package reads5932bytes, valid UTF-8 JSON, no BOM/NUL/duplicate keys; SHA256 `a28126d97bcaf567da5bed69443b7f3bcd9a7a8c38c8b66e554686b6bb2c10e0`. Version4.1.11, ESM; declared Node range permits24.21.0. File regular/non-symlink, uid501/gid20/mode0644; package and node_modules directories0755 with same owner.
- Exact retained accepted website-build stage `/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Builds/axiom-signin-current-build-999658d6-kyr6nbqq/stage/node_modules/vitest/package.json` is byte-identical. This establishes comparison against a known build artifact, not that the current three tests previously ran there.
- Root `package-lock.json` and `node_modules/.package-lock.json` select4.1.11 with the same resolved URL/integrity; root declaration `^4.0.18` admits it. No version mismatch established.
- Current offending-file flags64 correspond to `UF_TRACKED` in installed SDK `usr/include/sys/stat.h:324`, not `SF_DATALESS` (`0x40000000`, line359). Hidden package-lock's initial metadata included the dataless flag, but that is a different file and cannot establish the failing package's cause. Python's xattr API was unavailable; no alternate xattr operation was attempted.

Conclusion: **live cause unresolved**. Current bytes do not support asserting malformed JSON, incompatible Node/version, current dataless package or dependency corruption. They also cannot reconstruct what Node read during either earlier failure. No dependency replacement or framework change is justified by this evidence.

Smallest proposed later diagnostic, not executed: use the existing pinned Node24 for one ordinary `fs.readFileSync`/`JSON.parse`/SHA observation of the exact package; if successful, one finite existing-wrapper attempt for the three pending lifecycle cases. Preserve any failure and stop rather than repair/install/retry indefinitely. Behavior and browser acceptance remain unverified.

## Authorized bounded follow-up

Root subsequently authorized exactly that diagnostic and one conditional test attempt. Pinned Node24 successfully read/parsed Vitest5932bytes with the same SHA/version (`/private/tmp/axiom-catalogue-node24-package-read.log`, exit0). The single wrapper attempt advanced into Vitest but stopped before collection on `ERR_INVALID_PACKAGE_CONFIG` for **`node_modules/vite/package.json`**, while importing Vite from Vitest's CLI (`/private/tmp/axiom-catalogue-loading-final-attempt.log`, exit1). This is a different failing path from the earlier attempts, not a passing regression or proof of the earlier cause. All three cases remain unexecuted; stopped as instructed without further package probing, repair or retry. No install, provider, browser or build action occurred.
