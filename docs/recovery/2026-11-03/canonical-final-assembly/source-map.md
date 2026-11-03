# Final canonical artifact assembly: exact source gap inventory

Inspected source **479ac14a**. Documentation/plan only: no code, compilation, signing, build, image, mount, profile, service, identity or provider operation performed. This is the missing assembly portion of the already-reviewed [integrated unit](../xpc-origin-local-unit/canonical-integrated-next-unit.md), not a substitute for the actual consumer/authority boundary.

## Core dependency that assembly cannot close

Current `index.cjs` can retain native observations but exposes only unavailable runtime/issuer/fleet/legacy qualification. `issuerArtifactIdentity.ts` forwards that unavailable interface; every actual `*OutboundIssuer.ts` still throws. Drain seams consume a digest/current-issuer result and depend on their original claimed-operation reader. The precise contract authenticating the **actual compiled consumer → private canonical/native authority at durable claim and final send** is unresolved. This is a missing contract/evidence gate, not a reproduced bypass or proof of impossibility.

Do not wire a verified DTO, caller flag, manifest status, digest, injected callback or source/hash match around it. Do not recreate the blocked compiled-consumer test. Actual qualification, a full runtime build/run proposal and activation stay blocked until that contract and permitted evidence are resolved. Finishing the operators below would produce only an inspectable unqualified artifact.

## Existing operators versus missing operators

| Existing actual source | What can be reused | Missing bounded operator |
| --- | --- | --- |
| `native_overlay.py`: `compile_recipe`, `record_overlay`, `verify_overlay` | Fixed source/config/Node/header/control/native-output observation; original empty planned build run; exact runtime file allowlist | Per-role command construction/coordinator that derives real controller/broker cdhash requirements **in order**. Current full `compile_recipe` requires all three requirements already present; do not invent placeholder future hashes to compile earlier roles. |
| `build-local-issuer-package-source.py`: `execute_build`/archive verification | One exact fresh build; original source and prebuild overlay checked before/after; current source revision and planned build-run binding | No new compiler runner required. Use this existing operator after the coherent source is reviewed and core qualification is allowed to proceed. Never change a completed stage/attempt/result. |
| `materialize.py`: `materialize_isolated`, `verify_copy_bindings`; `manifest.py`: `verify_package`/`write_manifest`; `native_linkage.py` | Real source/output rechecks, copied Node/guard/bootstrap hashes pinned to overlay, final copy rechecks, trace relocation, explicit runtime distribution and native-load observations | Handoff validator that consumes these exact existing receipts and checks resulting manifest/source/critical files before an assembly claim. No second materializer or native collector is needed. |
| `native/origin_root_binding.m` | Exact external binding format; strict outer resource-seal check; mounted manifest hash/source and five critical native/main anchors; retained root/backing/control/anchor metadata | Writer of the **existing** `issuer-binding.plist` format and final outer app resource assembly. This writer does not issue runtime identity. |
| `native/origin_broker.c`, `origin_bootstrap.c`; `scripts/.../origin_control.m` | Fixed source roles, suspended owned-child startup/absolute deadline, restriction-first exec, actual private native origin and observation-only controller | No replacement broker/bootstrap. Assembly must consume their reviewed exact outputs and preserve their embedded requirements. |
| `origin-unit/registration_host.m` and `prepare.py` | Reviewed **source pattern only**: canonical app/declared executable/actual executable binding; inspect-before-SM; exact own-app SM operations | Production-named registration-only source/bundle configuration using the fixed issuer service. Do not ship the diagnostic binary, old service name, broad unit directory, fake main or test trust ports. |
| `protected_fixture.py`/`protected_fixture_run.py` | Established UDRO/HFS+ creation/readonly attach recipe, bounded subprocess/output/cleanup pattern and actual before/after image identity observations | Dedicated final-artifact assembly plan/runner bound to new source/paths/hashes. Old drivers are pinned to066 and consumed claims; never repoint or rerun them. |

## Exact acyclic handoff

1. Select one new private owned packet root, source revision, fixed future mount root, control-app path and startup claim path **before** native compilation. Keep unchanged pinned Node24 bytes/signature. No environment/request selects these at runtime.
2. Compile/sign the separate controller; derive its actual cdhash. Compile/sign broker with that controller requirement and unchanged Node requirement; derive broker cdhash. Compile guard with that broker requirement; compile independent bootstrap. Compile the registration-only main from the same archived source; add its source to the fixed overlay source-input set. Its later outer-seal signature/resource-envelope transformation is recorded separately, not falsely held to an unchanged pre-seal issuer cdhash. Record the original source/config/native outputs using `record_overlay` before the exact empty build run.
3. Use one existing exact-source build, then existing isolated materialization. Reverify source/overlay/copy bindings and native load closure. The package contains the exact guard and `__axiom_runtime__/origin-bootstrap`; broker/controller stay outside it. Compute the manifest only after all package bytes/trace transformations are final.
4. Create **one new** UDRO image from that exact materialized package at `CONTROL_APP/Contents/Resources/issuer-package.dmg`. This is a future specifically authorized image operation, not a current source-plan action. Before/after package verification must match; failed/unknown creation preserves evidence and is not retried or relabeled complete.
5. Write the five-field binding below outside the package, then sign the outer registration-only app **without `--deep` signing**. Do not resign Node, guard, bootstrap, broker or controller after their recorded requirements. Outer sealing may update the registration-main signature/resource envelope; that main is not a pinned issuer role. Recheck inner file bytes and exact requirements after sealing.
6. A final read-only verifier pins the entire prepared packet: original source/build/materialization/overlay receipts, image bytes/identity, binding/Info/LaunchAgent plists, all app files, static native closure and strict outer seal. No ready/qualified/activation status may be derived. Readonly attach, mounted full recheck, backing-alias matrix, service registration and runtime execution remain separate exact-run effects.

## Exact existing binding—not a package-digest shortcut

The broker currently requires **exactly five plist keys**:

- `format`: `axiom.local-issuer-control/1`
- `packageRoot`: the exact compiler-bound future mounted root
- `imageBacking`: exact `CONTROL_APP/Contents/Resources/issuer-package.dmg`
- `manifestSha256`: SHA256 of the actual `_axiom_local_issuer_manifest.json` **file bytes, including its canonical trailing newline**
- `sourceRevision`: the exact40-character archive/build/materialization revision

`verify_package(...).packageDigest` is SHA256 of canonical manifest JSON **without** that newline. It is not interchangeable with `manifestSha256`. Read and hash the raw verified manifest file; do not rebuild JSON, append an authority field or compile this final digest into a binary contained in the package.

Five anchored logical package files are already fixed by the broker: bootstrap, Node, real `index.cjs`, internal full verifier and guard. Resolve internal aliases only within the closed actual package; compare actual content/size/mode against its verified manifest. Do not replace full-closure verification with these five anchors: the real anchored main still performs the full verification before application import/native ACK.

## Concrete control bundle operator choices

Use a separate registration main named `AxiomIssuerRegistrationHost`, bundle ID `com.visionxixlabs.axiom.issuer-control`, min macOS13.0. Info.plist names only that main. The LaunchAgent is `Contents/Library/LaunchAgents/com.visionxixlabs.axiom.issuer-origin.plist`, with Label/MachServices equal to the already-fixed service and BundleProgram `Contents/MacOS/AxiomIssuerBroker`; RunAtLoadfalse. These are source implementation constants, not selectable runtime roles or authority inputs. Root review should confirm these routine names before code.

Keep the already-reviewed own-app SM lifecycle: exact bundle/executable identity first; inspect mode returns before SM access; status1/2 or loaded service refuses; status3 is diagnostic, never absence proof; only confirmed registerYES establishes cleanup ownership. Lost/NO acknowledgement does not authorize unregister of possibly preexisting state. The observed delayed launchd reaping remains a distinct read-only cleanup observation, not a retry to force immediate green.

No generic “install,” LaunchServices relocation, private bootstrap API, privilege grant, system daemon, cloud/provider action or automatic registration is part of assembly. Ad-hoc outer sealing demonstrates local packet integrity under the existing trusted-host/build assumptions, not publisher trust, hostile-host containment or enterprise qualification.

## Bounds and future packet gate

Preserve existing package limits:250,000 entries,8GiB aggregate,2GiB per package file,32MiB relative-path budget,64MiB manifest/trace metadata bounds and explicit profile trace limits. The image is outside the package and may exceed2GiB: stream its hash with a separately reviewed8GiB image cap; never pass it through the package's2GiB regular-file helper or load it into memory. Confirm actual image/manifest identities after every future assembly effect. New output paths and exclusive persistent claims are required; no reuse of old066/2fa paths or consumed attempts.

The eventual exact image/service/profile execution proposal must bind its own bounded commands, timeouts, images/owned aliases, cleanup ownership and final full acceptance matrix. The old bounded runner is a source pattern, not authority to run arbitrary argv. No retries, deep resigning, partial closure, copied positive issuer object or changed trust boundary is introduced by this inventory. No new security decision is needed for these assembly mechanics; the unresolved consumer-authority contract is a separate genuine decision and remains outside this plan.
