# Next action: package the exact isolated build output

November 3, 2026 · initial planning snapshot followed by implemented local adapter
and profile progress below. No actual materialization, new build, regeneration,
launch, seal experiment or network request was performed in this work unit. The
066d stage was not inspected until the parent's terminal-build cue.

## Terminal evidence and receipt boundary

Stage: `/private/tmp/axiom-isolated-066d821a-i6ofubya/stage`, exact source
`066d821a` (the parent's attempt records retain the full revision). The parent
reports actual Next compilation, TypeScript and route generation exited 0. The
existing output observer then refused its 250,000 trace-entry budget. The original
failed `build-run/result.json` and generation/build attempts must remain unchanged.

The parent qualified the bounded 512,000-entry read-only observer and provided the
completed cue. `completed-build-observation.json` records source
`066d821a82d9317f90a2127fe20a2773d252f168`, 6,060 source files, 1,104 routes, 1,108
traces and 289,120 references. Original command exit 0 and the **separate fresh
output observation** are correlated with current source/generated/Node/native
inputs. No compile or generation repeated, and the failed result was not rewritten.

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
Root inspected the pinned Next encryption generator and confirmed that the fresh
clean build had no NEXT_SERVER_ACTIONS_ENCRYPTION_KEY. Root reviewed this as required
locally generated framework state, not customer/provider credentials or authority.
Preserve and hash these required files inside the private package; never print or
copy their values into source/docs/public evidence. No scanner relaxation or new
allowlist is needed: the existing recognized-PEM/dot-credential-path scanner is not
a generic base64-secret detector. Do not omit required files or claim it proves no
credentials exist. Actual customer environment dumps/configuration and provider
secrets remain excluded/refused under the existing design.

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


## Implemented adapter and explicit bounded profile migration

`materialize.py` now exposes `isolated_build_details` and `materialize_isolated`.
The new explicit CLI path takes completed observation/build-run/stage/repository/
source-cache/bound-engine/generation-run/Node/output coordinates. It reads the
original attempt/result as bounded owned single-link files, requires the original
compiler exit 0 and actual Node-version log/current Node bytes, matches the original
result's raw hash and content to the independent observation, and recomputes current
post-build source/compiler/generation inputs, output metadata and derived type file.
Changed inputs/outputs or a failed compiler refuse even if receipt booleans say true.
The original unavailable observer result remains byte-for-byte unchanged. New
construction evidence retains all original/fresh-record and current-check hashes;
none constructs an executing identity.

The shared bounded copy core accepts a canonical real dependency root only for the
new path. Legacy `materialize` still requires its original dependency symlink and
legacy receipt contract. Entire archive-owned local-package targets are retained,
with no workspace adoption or dependency omission. The new construction receipt is
`axiom.local-issuer-materialization/2` and binds the isolated evidence. The native
wrapper delegates to C's separately reviewed typed `native_linkage` module; it does
not retain the flawed otool-line classification.

The actual 289,120 references also exceeded the old package-verifier 250,000 cap.
Both Python and CJS now recognize explicit package profile
`next-start-darwin-arm64/2` with **512,000** trace entries. Legacy `/1` remains at
**250,000**; no old descriptor silently gains the larger budget. Manifest format
and fields stay `/1`; only the declared bounded profile changes. All other file,
byte, path, trace, alias, sensitive-content and qualification checks remain intact.
Unknown profiles refuse. No routes or trace references were dropped to fit a cap.

Exact checks:

- Adapter RED: `/private/tmp/axiom-isolated-materializer-red.log`; **4 tests pass**
  at `/private/tmp/axiom-isolated-materializer-green.log`.
- Profile RED: `/private/tmp/axiom-package-trace-profile-red.log`; **2 Python tests
  pass** at `/private/tmp/axiom-package-trace-profile-green.log`, including 250,001
  positive for `/2`, unchanged legacy refusal, 512,001 refusal and unknown-profile rejection.
- **3 selected CJS profile/parity tests pass** at
  `/private/tmp/axiom-package-cjs-profile-green.log` with the same boundaries and
  Python/CJS equal file-observation results, no identity grant.
- **11 directly affected legacy-copy tests pass** at
  `/private/tmp/axiom-isolated-materializer-legacy-regression.log`.

The copy tests use synthetic files/runtime/native metadata explicitly, not an
actual server/package execution. Profile-positive tests check actual bounded
filesystem reference traversal, not a DTO permission flag. A first profile
implementation missed threading the limit into the separate trace-validation
function; the final tests passed after that local fix.

Actual **read-only** new-adapter validation of the completed 066d pipeline passed:
`/private/tmp/axiom-isolated-materializer-066d-input-validation.json`.
It reverified all 6,060 source files and correlated original result, fresh observation,
current generated/Node/native-input bytes and output data. `materializationStarted`
is false, and no destination package was created. Old stages/evidence remain intact.

The original native-profile blanket rejection of every unused escaping rpath was
identified on Sharp. Root/C separately reviewed a data-only correction: preserve
all unqualified search-context strings, require each actual LOAD to resolve uniquely
inside the package or to declared system prerequisites, and leave dynamic/inherited/
runtime search qualification unavailable. Final native source review is separate;
no parser rule was loosened in this adapter. No actual materialization, native
experiment, launch, provider action, build or generation is authorized by these
passing checks. Root's explicit first-copy cue is still required.


Final independent source review: C cleared the isolated adapter/profile changes;
this agent cleared C's final native LOAD/search-context correction (14 author-owned
synthetic tests, not rerun by this reviewer). Documentation now labels the opening
as the historical planning snapshot. All implementation/test evidence above concerns
local tooling and owned fixtures; no production package copy or launch occurred.
