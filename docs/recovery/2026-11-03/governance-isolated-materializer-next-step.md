# Next action: package the exact isolated build output

November 3, 2026 · implementation plan only. No materializer/runtime code change,
new build, regeneration, launch, seal experiment or network request was performed.
The active 066d stage was not inspected until the parent's terminal-build cue.

## Terminal evidence and receipt boundary

Stage: `/private/tmp/axiom-isolated-066d821a-i6ofubya/stage`, exact source
`066d821a` (the parent's attempt records retain the full revision). The parent
reports actual Next compilation, TypeScript and route generation exited 0. The
existing output observer then refused its 250,000 trace-entry budget. The original
failed `build-run/result.json` and generation/build attempts must remain unchanged.

The parent is qualifying a bounded 512,000-entry read-only observer; no compile or
generation repeat is needed. Packaging must wait for its successful independent
observation cue, then correlate the original command exit 0 and a **separate fresh
output observation** with current source/generated/Node/native input checks. A new
observation must never rewrite the failed result or turn its status into success.

## Actual output inventory after the terminal cue

- `node_modules` is now a canonical **real directory** from exact-archive offline
  npm installation. It is not the old workspace dependency symlink.
- The source has no standalone output. The supported package remains Next start:
  packaged `__axiom_runtime__/node` running
  `node_modules/next/dist/bin/next start` from the package root. Pinned
  `dist/cli/next-start.js` imports `../server/lib/start-server` and invokes it with
  `isDev:false`. This describes the application entrypoint, not an approved launch.
- There are **1,104 app route entries** and **1,108 NFT trace files**, including
  both `.next/next-server.js.nft.json` and `.next/next-minimal-server.js.nft.json`.
- `.next/required-server-files.json` explicitly requires 21 paths: `.next/package.json`,
  routes/build/prerender/pages/app-paths/app-path-routes manifests, preview props,
  functions-config/middleware manifests and generated middleware JS, react-loadable
  manifest, server-reference JS/JSON, prefetch hints, BUILD_ID, next-font JS/JSON,
  required-server-files itself, and server instrumentation JS.
- All compiled server route/chunk/runtime files, `.next/static` CSS/JS assets,
  public files (including all **13 local WOFF2 assets**, provenance and notices),
  and every additional traced source/support target must be copied. Trace directory
  entries require bounded recursive inclusion; route/global traces are not a closed
  executable inventory by themselves.
- `node_modules/@axiom/verified-issuer-runtime` is the relative link
  `../../packages/verified-issuer-runtime`, resolving to **archive-owned** package
  source inside the stage. Preserve a canonical inside-package link and include
  its complete target, not a workspace link or just its exported filenames.
- The exact derived `next-env.d.ts` exists. It is already qualified separately as
  pinned generated type output; do not rewrite the Git source/archive identity.

## Concrete changes needed before the first materialization

1. **Accept the actual isolated-build evidence shape.** Existing `materialize.py:receipt`
   expects legacy `{exit,source,archiveSha256,verifiedRegularFiles,nodeVersion,stage}`
   metadata. It cannot directly consume the current attempt/result plus separate
   output observation. Add a narrow explicit adapter that takes those original
   records and source coordinates, rechecks current `prepare_build_inputs` in its
   post-build phase and fresh bounded output metadata, and binds their hashes in
   a construction receipt. No caller ready boolean, source digest, or JSON success
   field constructs executing identity. Preserve original evidence byte-for-byte.
2. **Support the real owned dependency root.** Existing materialization explicitly
   requires `stage/node_modules.is_symlink()`. Replace that old-input assumption
   with a reviewed isolated-install profile: canonical real owned stage dependency
   directory, exact lock/local-package relationships, no workspace fallback. Keep
   old receipts/profile semantics separate rather than pretending a different
   dependency root was already qualified. Resolve stage/dependency targets before
   copying; reject outside/missing/cyclic/ambiguous inputs.
3. **Copy once into a new private destination.** Reuse existing bounded, stable
   descriptor/hash/mode, hardlink/collision/path and stateful sensitive-content
   checks. Include the fixed Next/public/runtime inputs, complete owned dependency
   tree and every original trace target. Do not compile or silently omit a required
   file. The previous workspace-hydration failure is not a reason to relax metadata
   stability; the new inputs are under the owned isolated temporary root.
4. **Resolve and bind actual native linkage.** The old collector treats every
   `otool -L` line as a dependency. This incorrectly treats Prisma's `LC_ID_DYLIB`
   own absolute install name as an external dependency. It also refuses all
   `@rpath` references. Use actual typed Mach-O commands to distinguish ID from
   loads and bind the actual rpath/loader/executable-relative resolution graph.
   Reject ambiguous/outside/unresolved loads; never allow arbitrary basename
   matches or guessed host search paths. Retain macOS shared-cache/system libraries
   as explicit trusted-host prerequisites, not host attestation.
5. **Relocate trace metadata without rewriting executable bytes.** Resolve each
   original trace against the original completed stage, map only approved roots,
   include the target, and retain original/packaged metadata hashes. Keep generated
   JS/native bytes unchanged; any retained source-path strings are not permission
   to read the old stage during later qualification. Exact package layout and
   source-workspace read denial must be tested separately before a launch claim.
6. **Write/verify the canonical package manifest.** Include the current build and
   fresh observation provenance, materialization receipt, Node/native prerequisites
   and complete observed file set. Existing no-follow/exclusive receipt and manifest
   creation, budgets and tamper tests remain mandatory. File-set verification may
   succeed only for the copied package; it remains distinct from immutable launch.

## Source-backed native work

The completed 066d install contains **seven `.node` files and one `.dylib`**, plus
the Node executable to be packaged. Same-lock completed b964 input inspection shows
the concrete rpath issue: Sharp's `sharp-darwin-arm64-0.35.5.node` loads
`@rpath/libvips-cpp.8.18.7.dylib`; its actual first `LC_RPATH` is
`@loader_path/../../sharp-libvips-darwin-arm64/lib`, resolving to the owned libvips
package. Additional declared rpaths must be assessed as actual loader search
metadata, not assumed equivalent or ignored. The libvips own ID is also an rpath
name and must not be misclassified as a self-dependency. Prisma's own absolute
build-runner install ID likewise does not authorize reading that runner path.

The existing engine input verifier already demonstrates typed ID/load distinction
for its narrow engine profile. Do not copy its blanket rpath refusal into the
general materializer, nor promote its limited static linkage observation into a
claim of complete dynamic/runtime closure.

## Required framework state and security semantics

The required preview-props object has field names `previewModeId`,
`previewModeSigningKey`, `previewModeEncryptionKey`; server-reference metadata has
`node`, `edge`, `encryptionKey`. Values were not printed or copied in this audit.
These are framework-generated runtime state, not evidence of customer/provider
credentials or authority, but their treatment must be explicit in the private
package profile. Do not silently omit required state or claim a generic secret
scanner proves no credentials exist. Customer environment dumps/configuration and
actual provider secrets remain excluded/refused under the existing design.

## What this action does not complete

The approved design requires the actual closed package and controlled pre-import
launch with a private same-module consumer. Current `index.cjs` still exposes only
an unavailable reader and refuses its main entry. The proposed named-profile native
experiment remains pending; do not smuggle it into packaging. There is no qualified
Next launch, immutable-root/process proof, executing `issuerArtifactDigest`, complete
fleet/legacy coverage, enrollment or activation from a successful copy/manifest.

Concrete next authorization/work unit: after the parent's successful fresh output
observation cue, implement/test the isolated-evidence/real-dependency-root adapter
and native command resolution, then attempt **one** new bounded materialization of
this exact completed build. Report any concrete closure refusal; do not repeatedly
rebuild or re-copy to hide it. Keep all execution/issuer/activation qualification
unavailable throughout that packaging increment.
