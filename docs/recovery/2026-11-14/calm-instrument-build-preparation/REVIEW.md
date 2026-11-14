# Conditional offline presentation-build proposal

## Prepared source

`CANDIDATE.json` identifies a private, byte-verified source archive and its SHA256. It contains current tracked source plus the exact new source files from the independently reviewed host/timing/presentation manifests. Every modified or untracked runtime source file was checked against those accepted manifests; none was omitted. Root-level work files, dependencies, Git metadata, loaded environment files and credential-file extensions are excluded/refused. Historical recovery files named `work` are ordinary tracked evidence and are preserved; the first preparation stopped on an overly broad nested-directory check before any build. Its partial private archive remains untouched.

The candidate is a source snapshot of a dirty reviewed checkout, not a newly committed/green CI head. Its archive/manifest, not a later mutable working tree, would be the build input. `CANDIDATE.json` must exist and independently verify before asking to run anything.

## Requested bounded authority

Prepare and ordinary-test the fixed executor, obtain independent source/input review, then run **one conditional offline batch** only if all checks pass:

1. Reverify and safely extract this exact archive into one fresh private staging directory. Refuse links, traversal, missing/extra members or changed bytes. Do not touch existing output/app directories.
2. Reuse the current cached root/desktop dependency installations and the existing pinned Node24.21.0 and Prisma engine. Do not install/download anything. Cache paths remain write-denied. The staged `@axiom/verified-issuer-runtime` file dependency must resolve to this staged source, not the live checkout; stage any dependency namespace needed for that without changing the shared cache. Preserve closed Zod/package identity checks.
3. Run the existing root `npm run build` command once (contract check, cached Prisma generation, production type checking and Next compilation). The generator's output belongs to the staged `.prisma` directory. No database URL or provider credential is supplied. This emits ordinary website assets, not a qualified Governance runtime.
4. Only on website success, run the existing `npm run build` from staged `desktop/` once (release-alignment check, desktop type checking and Vite frontend compilation). This does not invoke Tauri/Rust, sign/package/install/restart an app, bump a version or publish an installer.
5. Record exact inputs, command exit/status, output paths and hashes; verify original source/shared caches were not written. Keep the historical failure or unknown result and stop; no retry.

Use a fresh synthetic child environment and stage-only writable home/cache/temp paths, no loaded `.env` files, no account configuration, no inherited tokens, SQL or production URLs. Use the already-established macOS network-denial mechanism plus write denial outside the owned stage (literal `/dev/null` remains the nonpersistent output sink). Runtime/feature flags stay off. No signed helper, clock, custodian or app runtime may launch. Existing compiler/generator programs are the only native tooling in scope.

**Bounds:** one shared30minute active child budget, at most5seconds owned process-group cleanup; stage2 is skipped after stage1 failure. No retry, signing, service/account/permission changes, cloud resources, database/provider access, deployment, CI or spending. Prompts/missing prerequisites/uncertain cleanup stop and preserve evidence.

## What this does not approve or prove

No local server, preview listener, browser-policy workaround, actual desktop launch or production action is included. A successful build is not visual/browser/native acceptance, complete Governance, compatible production schema or permission to publish. The earlier static file-URL refusal remains intact. Real rendered showing needs a separately established allowed surface and applicable permission; no serving of that blocked file is proposed.

The source-only presentation approval excluded builds. This conditional build/executor authority therefore requires the owner's decision before compiler execution; earlier consumed build grants are not reused. Independent review of this proposal is design/preparation review only. The actual executor and final input packet must also be independently reviewed before the sole attempt.
