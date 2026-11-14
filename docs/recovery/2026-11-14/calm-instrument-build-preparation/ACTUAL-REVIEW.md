# Independent actual build evidence review

Verdict: **Authentic retained result: WEBSITE PASS; DESKTOP FAIL; combined batch accepted=false.** The one approved attempt is consumed. No retry/continuation was executed or authorized by this review.

## Exact evidence verified

- Actual RESULT.json SHA256: `f227231d8ed71ddf89f0b445e4af1b21fb6ece85031002ba99ad265904c7b3f3`.
- Original final input packet SHA256: `c57d84b7c1f5dbebecbff00838346d5b94f4b41f09e58245d03b59450826b6c3`; staged input-packet.json bytes match.
- Website log:43,893bytes, SHA256 `86122f3d798afcb1db47a55d8cc519e8d2c3ea8710e65ee210aa1fd3ff29e497`.
- Desktop log:2,110bytes, SHA256 `0ddde53f21f91f23b77b852ee68ac3c97ac84fc24b6f6491df3a0302d195204d`.

Receipt phase log hashes/byte counts match actual files. Website exit0, reason=null, cleanupConfirmed=true; desktop exit1, reason=null, cleanupConfirmed=true. finalInputsMatched=true and accepted=false are preserved. ATTEMPT-CONSUMED.json binds the same packet with consumed=true/retryAllowed=false.

Independently rechecked all16 explicit packet file pins and current+staged80 accepted runtime source hashes: exact. Reused the executor's completed full-cache/tool/topology postverification, rather than repeating250402-entry inventory. No new source/cache mutation is inferred from log failure. Existing cached program source explains the failure below.

## Established outcome and cause

Website log shows the exact approved contract check, cached Prisma7.10.1 generation to staged .prisma/client-source, production native TypeScript check and Next16.4.5 webpack build finishing its route output. Existing warnings remain in the43KiB log, including dynamic request expressions in verified-issuer-runtime; this was not warning-free. Representative staged outputs .next/BUILD_ID, .next/build-manifest.json, .prisma/client-source/client.ts and lib/generated/prisma/client.js exist. Because the overall pipeline failed, the receipt intentionally has no aggregate successful outputs inventory; this review does not invent one or claim all website artifacts were independently hashed.

Desktop release alignment passes and the desktop typecheck completes before Vite config loading fails. The actual error is EPERM opening staged desktop/node_modules/.vite-temp/vite.config.ts.timestamp-...mjs. That staged .vite-temp entry is a symlink to the protected existing desktop dependency cache, outside the allowed stage. Cached Vite source loadConfigFromBundledFile chooses nearest node_modules/.vite-temp and writes the bundled ESM config there. The executor's broad cache aliasing copied that preexisting writable-temp entry as a symlink, so the original outside-stage write denial correctly stopped the write. This establishes a concrete staging-namespace mistake, not a TypeScript/product-source error and not permission to loosen the sandbox or write the cache.

A finite correction can give .vite-temp its own fresh staged directory while preserving cached dependency inputs, one explicit desktop-only continuation proposal and independent packet review. This review does not approve or run that continuation; the earlier no-retry allowance stays consumed and the failed receipt stays unchanged. Website success need not be rerun to diagnose this established desktop temp-path error.

## Limits

Only ordinary file/source reads and review artifact writing occurred here. No build/test/compiler/native/cache-inventory/SQL/network/provider/browser/CI operation was rerun. This result is compilation evidence only: no rendered visual/native app/Governance/production/schema/security acceptance, installation, activation or spending follows.
