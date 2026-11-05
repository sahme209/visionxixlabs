# Fixture delivery: strict container and seal seams

**Source audit/design only.** No assembly, image operation, signing, build, SQL, filesystem installation or OS qualification was run. Preserve the successful historical v2 static seal and every original receipt/artifact unchanged. New runtime source requires a new exact preparation/delivery profile; a successful prior seal cannot describe new bytes.

## Actual source boundaries

- `container_preparation.py`: `PROFILE='axiom.synthetic-container-seal/2'`, exact `CONFIGURATION`, `AUTHORITATIVE_LEAVES`, `EDGES`, `SIGNING_PLAN`, `prepare_container()` and `verify_container()` admit only that v2 layout. The non-authoritative container main is intentionally separate from broker/owner identity; do not restore the historical broker-main seal cycle.
- `container_assembly.py`: `_inputs_impl()` validates the exact v2 input keys/profile/mode map and original source/image/companion provenance. `assemble_container_inputs()` copies four authoritative companions, container main, image and two plists: **eight app files**. `verify_assembly()` derives exactly that inventory and rejects extras. `_copy_bound()` preserves authoritative input bytes and records explicit new-copy modes; old input modes do not change.
- `final_seal.py`: this is a historical **exact invocation packet**, with fixed `APP`, `PRESEAL`, hashes and original main extent. `capture_baseline()` binds the preseal file/directory set; `validate_postseal()` permits only container-main signature mutation plus `Contents/_CodeSignature/CodeResources`. It rechecks all other file metadata/bytes. Do not parameterize its fixed constants or reinterpret its successful receipt as a new operation.
- `system_preparation.py`/`system_build_inputs.py`: native source/config/role provenance and explicit selected fixture principal/tool hashes are inputs, not readiness. The independently bound signed runtime Node already has an authoritative role; a second copy outside the image must retain those exact selected bytes, rather than copying whichever `node` is on PATH.
- `native/synthetic_fixture_producer.c`: fixed helper is `AX_SYNTH_APP/Contents/Resources/qualification/fixture-producer.cjs`; fixed administrative Node is `AX_SYNTH_ROOT/fixture-tools/node`. Recipe binding, schema SQL and seed SQL are exact additional resource files. Parent checks their protected ancestors/ACLs; the Node/helper hashes and selected principals default missing/refusing.

## Selected new explicit profile

Introduce separate `axiom.synthetic-fixture-container-seal/3`, `axiom.container-preparation/3`, `axiom.container-assembly/3` and `axiom.fixture-generation-delivery/1` receipts. Existing v2 functions retain their exact acceptance and original negative tests. Prefer separate v3 preparation/assembly functions/modules sharing narrow low-level binding/copy helpers; do not make a generic extra-files parameter or broaden v2 inventory matching.

V3 app inventory is exactly the original eight roles plus these four fixed data resources (twelve preseal app files):

1. `Contents/Resources/qualification/fixture-producer.cjs`
2. `Contents/Resources/qualification/fixture-schema.sql`
3. `Contents/Resources/qualification/fixture-schema.binding.json`
4. `Contents/Resources/qualification/fixture-seed.sql`

Copy these to fresh owned quarantine output as mode0600, recording original hashes/size/mode and explicit prospective installed modes. JS/SQL/JSON need no executable bit; proposed installed root-owned mode0644 is a mapping for new copies, not permission to change existing inputs. Exact protected root ownership/nonwritability/ACL qualification remains an installation gate. No symlink, duplicate, unexpected resource, alternate script/SQL/binding path or caller mode map.

The new outer seal covers these four resources alongside the existing image/plists/leaves. Its allowed mutation set remains **only** main signature and CodeResources; the additional resources and authoritative leaf bytes must remain identical to the new preseal baseline. Use ordinary outer signing without `--deep`. The historical signed v2 app is not the assembly destination. “Authoritative leaves unchanged” means unchanged from this new packet's independently reviewed signed inputs; it does not permit transplanting old receipts to freshly changed native source.

## Node outside the app: separate generation delivery

`fixture-tools/node` is outside the app resource seal and outside the original mounted-package canonical inventory. Record it in a finite generation delivery inventory, with its source signed-runtime-Node binding and expected exact installed coordinate `AX_SYNTH_ROOT/fixture-tools/node`; no dependency on an ambient nvm/Homebrew/PATH Node. Its bytes must match the selected source Node leaf, with explicit new-copy executable mode0755 and original unchanged quarantine input. Preserve real signature/profile/dependency provenance; hash equality is not runtime qualification.

Proposed `prepare_fixture_generation_delivery(packet,destination)` / `verify_fixture_generation_delivery(destination)` own a fixed tree containing the v3 app and exactly this external Node copy, plus receipts outside the sealed app. Reject extra files, links, hardlinks, wrong modes, overlapping input/output, wrong generation, different Node or post-copy mutation. App and external Node inventories remain separately named: an app seal does not authenticate the Node merely because a JSON record mentions it. A future root installer must bind their joint expected bytes/current protected paths before maintenance; no delivery receipt grants root, execution or identity.

Keep the exact compiled candidate generation as selected by source, or prepare an expressly reviewed new source generation. Do not silently retarget immutable installed paths, overwrite any existing generation or reuse partial provisioning. The fixed local lab destination can be fresh while the proposed installed coordinate remains fixed; neither constitutes installation.

## Producer dependency-resolution seam that must be joined

The current producer emitter externalizes `@prisma/client`. A helper under `Contents/Resources/qualification` does **not** resolve the mounted image's node_modules through ordinary Node ancestor lookup. Adding arbitrary app/node_modules, a symlink, NODE_PATH, another generated client or repository dependency cache would change this strict profile and recreate an ambient dependency path.

Recommended explicit mapping: the producer emitter resolves the existing private factory's Prisma external at the **fixed compiled** mounted `PACKAGE_ROOT/node_modules/@prisma/client` coordinate, retaining that real generated client's own engine/dependency closure. No request/environment-selected anchor or fallback. Bind this emission/resolution map and full image manifest/source revision in the v3 input packet. The four-resource profile remains coherent only if every nonbuilt-in external is covered by that fixed read-only package closure; otherwise stop for a revised finite inventory rather than claiming self-contained delivery.

This also requires original pre-import resource protection before the root helper loads anything from the image: actual fixed mounted readonly package/backing/code provenance must be established by the approved native protection model, not by executing an unverified JS verifier from a writable mount. The current administrative producer source does not yet establish that dependency pre-import qualification. Do not treat a static app seal, caller-supplied package digest or protected SQL-file check as its substitute. The concrete native/dependency binding must be joined before this profile is called executable. Actual hardened Node/Prisma native-engine loading compatibility remains a later controlled observation, not an assumed library-validation exception.

## Finite source implementation and test surface

- New `prepare_fixture_container()` / `verify_fixture_container()` pin the v3 configuration, four resources, unchanged original role graph and new resource→outer-seal edges; test exact keys/path/data modes and no wildcard extensions.
- New `assemble_fixture_container_inputs()` / `verify_fixture_assembly()` require exact source/recipe/seed/Node/dependency provenance, copy only fixed roles, and reobserve all inputs/copies. Test missing or extra resource, alias/hardlink, hash/source/schema mismatch, altered binding/seed, Node byte/profile/mode mismatch, and input mutation during copy.
- New fixed-packet seal preparation/validation (separate from historical `final_seal.py`) binds the **new** preseal receipt and twelve-file baseline. Pure synthetic before/after tests allow only main/CodeResources changes and reject any resource/leaf/Node modification. External Node must be rechecked through generation delivery before/after the new seal; never infer it from CodeResources.
- Existing `test_container_preparation.py`, `test_container_assembly.py`, `test_final_seal.py` remain compatibility obligations. Add focused v3 tests using synthetic bytes and mocked compiler/signature/image observations only; actual code-signing/image/Node/helper execution requires a later exact packet.

No test result, delivery record or seal opens owner/supplier readiness, selects an OS principal, generates keys, qualifies PostgreSQL/Keychain, supplies live issuer identity or completes same-consumer/fleet/mutation coverage. This design adds the missing artifact route while preserving all original runtime and production-cutover gates.

## Selected safe launch refinement before implementation

Root selected fixed `posix_spawn` of the existing pinned Node/helper, not a new launcher artifact. Maintenance first captures `axiom_origin_bind_root()` and checks `axiom_origin_root_current()` against the original fixed sealed-control/readonly-root/backing model. Those functions can use Foundation/Security before launch: no forked child then runs unsafe post-fork runtime code. `POSIX_SPAWN_CLOEXEC_DEFAULT`, fixed file actions duplicating only private stdin/stdout pipes and null stderr, fixed working directory/argv/environment and explicit child signal mask/defaults replace the old fork/exec branch. Preserve default-SIGCHLD admission, actual owned-unreaped PID discipline, absolute deadlines, no ECHILD signalling and bounded unknown cleanup. Recheck captured root before frame delivery and material return; no copied root receipt is accepted. These are source/fully-stubbed-test changes only; actual native predicates, spawn and helper are not invoked by local tests. No extra signed leaf/helper role is introduced.
