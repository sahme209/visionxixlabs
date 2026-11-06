# Next image/fixture-container procedure — source proposal only

Initial inspection ran while materialization was live and did not touch its outputs or process. Root subsequently reported terminal success and authorized receipt/manifest reads. The actual terminal/receipt/manifest facts below are now bound by [NEXT-IMAGE-ACTUAL-INPUTS.json](NEXT-IMAGE-ACTUAL-INPUTS.json); no package verifier, image/mount/host/signing/native command was invoked by this preparation. This remains a source proposal, not an operational packet.


## Actual terminal facts now available

Materialization source64eca completed with recorded qualification package_file_set_verified:95318files/52links, packageDigest `6bf466785e75b6034fe2dae29ace452fb467746e8d1267a7ad13c11bf793e6d2`. Selected package is `BASE/2026-11-06-stage-b-materialization-1/package`.

- Raw manifest `_axiom_local_issuer_manifest.json`: SHA256 `4052270281cac69127847aa1b4b120044bf2914f4c0719fa7c9be0a0b444c59e`,17957004bytes.
- Main materialization receipt: SHA256 `e96c59baa983133096acfab4c56644995a7c5dda827f95fadd29fe380b6876d5`,390381bytes, format3.
- Fixture delivery: SHA256 `1a5c35429764bd37337eb17ea7ff7c56fc6713c41310fff49770fea49e2611d7`,4975bytes, same source/packageDigest; producer/schema/binding/seed plus external fixed fixture-tools/node coordinate.
- Terminal summary: SHA256 `a520a1bfdeb69f276accbf1e32c217d1ab29f35d2037f22b860c8bb05d6f4d6e`,1818bytes; physicalImmutabilityQualified/runtimeIdentityQualified/executionAuthorized/installationReady/activationAllowed allfalse.

These were ordinary reads/hashes of completed JSON files, not a repeated3GiB package verification/copy. Independent file-only acceptance is parent-coordinated. No actual image or main compilation/assembly/signing receipt is invented.

## Minimal real source constraint

`image_inspection.py` hardcodes the consumed November5 root in all of these paths:

- `inspect_image`: exact `RUN_ROOT/image/issuer-package.dmg`, new `inspection`/`mount` directories.
- `_run`/`_attach_argv`: exact attach argv and90second bound.
- `_select_device`: the single reported mount must equal that root's mount path.
- `verify_recorded_inspection`: bound proof mount path, attach command and device must join that same root.

`container_assembly._inputs_impl` imports `image_inspection.verify_recorded_inspection` directly; fixture-container v3 calls that same base reader. Changing only a future driver constant cannot make the new operation consumable. Replacing the global root would strand legacy proof reading; reusing the old namespace would replay consumed state. Neither is proposed.

Smallest source change for review: retain the existing old fixed root/default and add **one explicit fixed new root**, proposed `BASE/2026-11-06-stage-b-image-1`. Resolve only the two exact bound image paths to their corresponding roots; use that same resolution in inspection, attach argv, device selection and recorded-proof verification. Do not add a caller-selected directory, generic executor, glob/URI input, relaxed command/device parser, mutable-global override, weaker mount ownership rule or relaxed receipt schema. Every old proof still selects its original root; a new proof cannot borrow an old run's image/mount/logs. The v3 base reader continues to call the same verifier, so it needs no new trust callback or alternate validation path.

**No adapter is implemented here.** Adding that fixed coordinate is a small supported-scope expansion requiring explicit source/design review before implementation. Subsequent pure/mocked acceptance should show old fixed-root proof compatibility, new fixed-root proof success, arbitrary roots refused, cross-root image/proof/attach swaps refused, and unchanged readonly/single-mount/ownership-before-detach/namespace-restoration behavior. No actual mount is needed for those tests.

## Concrete later input preparation and operation order

`BASE=/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab`.

1. After successful materialization terminal review only, select actual `materialization-1/package`, `_axiom_local_issuer_manifest.json`, `materialization.json`(format3), `fixture-delivery.json`, packageDigest and raw manifest SHA. Retain exact sourceRevision64eca and existing owner/broker/controller/maintenance/Node/bootstrap/guard proofs. Future procedural helper changes are separately bound source; they do not fabricate a different package revision or require a Next rebuild by themselves.
2. Resolve the existing v3 container prerequisite using `fixture_container_preparation.prepare_fixture_container(REPO,FRESH_STAGE)`: it creates a new wrapper and genuine `v2-main` source preparation. Its verifier requires `basePreparation` at that wrapper's own `v2-main/container-preparation-v2.json`, and the compile receipt must join that exact preparation/stage/argv. Thus the old detached November5 main compile cannot simply be relabeled as the new v3 prerequisite. Review actual possible existing joins first; if a fresh v3 prerequisite is selected, its one fixed compile-only recipe needs its own approval. No authoritative leaf is recompiled/resigned. The fixed no-effect main only returns78 and is never run or accepted as an issuer peer.
3. Freeze a new exact operation packet only after package facts and main proof exist. Fresh image path is `BASE/2026-11-06-stage-b-image-1/image/issuer-package.dmg`; mount is its sibling `mount`; inspection records are under `inspection`. No old operation-inputs.json/approval/source/attempt is changed. The earlier image driver's pattern can be reused with new frozen constants and v3 profile/copy calls; do not run its old packet or patch globals.
4. Exact image command is existing `container_assembly._image_argv(actual_package,fresh_image)`: `/usr/bin/hdiutil create -srcfolder <actual_package> -volname "Axiom Synthetic Issuer-c3b7bf334ce56a64575183b7a66e5109" -format UDRO -fs HFS+ <fresh_image>`. Image creation is an operational step, not ordinary source preparation. Set a reviewed artifact/free-space bound from the actual package; do not derive it from log caps or silently inherit the old image size. Prior image scope used600seconds/1800second outer controller/1MiB outer output; these are review references, not a current grant.
5. Existing inspection performs `/usr/bin/hdiutil attach -readonly -nobrowse -noautoopen -plist -mountpoint <exact fresh mount> <exact fresh image>` (90seconds), selects exactly one bounded `/dev/disk…` identity from the attach plist, observes changed namespace+readOnly, and runs Python manifest verification on mounted bytes. It may detach only that same still-owned device after rechecking mount/image identity: `/usr/bin/hdiutil detach <recorded device>` (60seconds), then require restored original namespace. Shared per-command stdout/stderr cap remains256KiB and existing cleanup wait5seconds. Unknown ownership/attach/detach leaves possibleMountedImage=true and stops; no speculative forced detach, alternate mount or automatic retry.
6. Actual image-operation record, readonly mounted observation and completion bind the same source64eca/packageDigest/manifest SHA/image bytes. Existing `verify_recorded_inspection` must accept the new fixed namespace before the base container reader can proceed.
7. Use existing v3 base packet `axiom.fixture-base-inputs/3` / profile `axiom.synthetic-fixture-container-seal/3` / mode map `axiom.fixture-container-copy-modes/3`, with actual package/manifest/materialization/main-preparation/main-compile/image-completion. Outer packet `axiom.fixture-container-inputs/3` adds the genuine v3 wrapper preparation and actual fixture-delivery receipt. Then `assemble_fixture_container_inputs` and `verify_fixture_assembly` produce the fixed thirteen-file inventory (twelve app files plus external fixture-tools/node), preserving original artifacts. New copies: leaves/main/external Node0755; image/plists/producer/schema/binding/seed0600.
8. Final app sealing remains a later separate key-use decision: existing `capture_fixture_seal_baseline` → exact `fixture_seal_commands` → true recorded sign/strict-verify/display evidence → `validate_fixture_postseal`. Only non-authoritative main signature and app CodeResources may change; every authoritative signed leaf, fixture resource and external toolNode stays exact. No --deep or authoritative leaf re-signing. Do not bypass mandatory sealed_control or adopt the historical cyclic broker-main profile.

This is the existing acyclic DAG: signed leaves→guard→actual package→read-only image→separate container main/resource seal. It does not establish protected installation/root ownership, live custody, SAME compiled consumer, fleet/enforcement/enrollment or activation. All flags remain false. No operation or new trust boundary is authorized by this proposal.

## Proposed adapter contract for review (not implementation)

Keep public inspect_image(image_binding,package) and verify_recorded_inspection(bound,image,package) shapes and receipt schemas unchanged. Add one fixed fresh root constant beside legacy RUN_ROOT. A private root-for-image helper accepts ONLY the exact two known image paths. _attach_argv derives matching root; _run accepts only corresponding exact attach argv at90seconds or its unchanged device-only detach at60seconds. _select_device gets that already-resolved internal fixed root so mount-point parsing stays tied to the image. Inspection and recorded verifier derive root from the same bound image and reject cross-root mount/command/device proof. No caller-supplied root, global mutation or new generic callback is needed. Legacy defaults remain usable; container_assembly and fixture v3 continue importing the same recorded verifier unchanged.

Review acceptance before code: source proof old path still verifies; explicit fresh path can verify; any third path or cross-root swap refuses; all current single/read-only/changed-namespace/owned-detach/log-bound/image-currentness/closed-flag tests remain. This source proposal does not authorize adapter implementation or any actual image operation by itself.
