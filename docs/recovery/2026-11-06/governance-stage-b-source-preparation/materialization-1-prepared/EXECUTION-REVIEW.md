# Existing isolated materializer — one prepared operation

No materialization or host-metadata operation has run. The successful RUN4 grant is consumed; this separate proposal needs its own exact reviewed execution decision.

## Frozen entry / inputs

```text
/usr/bin/python3 -B /Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion/docs/recovery/2026-11-06/governance-stage-b-source-preparation/materialization-1-prepared/prepared-materialization-controller.py
```

Driver SHA256 `785a97ce803e05020664eeebd1769ff8889b3f90ef06d1f5010b69e4854abbad`; controller SHA256 `8577035a60ccf8e98e4c05322d1b174624b06b21f82ebc0cae029fd3756bfffb`; [input/helper bindings](source-bindings.json) SHA256 `9555e99f85d23e93adba024483bd83b97ebf78f5b46fa287600eb8a8c5ce0c2a`. Both scripts syntax-parse; controller function AST equals the proven build controller, with constants only changed. No tests or scripts were executed by this preparation.

`BASE=/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab`.

| Coordinate | Exact selected input/output |
|---|---|
| Source revision | `64eca1cd5ba954e6ce03deceeb9e5eef541f6684` |
| Frozen helper/source repo | `BASE/2026-11-06-stage-b-lab-source-3/repo`; every imported materializer/builder/engine/manifest/System/fixture/native-linkage helper is frozen from this Lab source |
| Successful original build | `BASE/2026-11-06-stage-b-system-build-4` (BUILD); attempt/result under `BUILD/build-run` |
| Observation | `BUILD/completed-observation.json`, SHA256 `6d665bb8b7ebd6479afc782fec67142bc7776409a0b7b7a2ff901958722b92f3`,418940bytes |
| Other coordinates | stage=`BUILD/stage`; bound engines=`BUILD/engine-inputs`; generation=`BUILD/generation-run`; cache=`/Users/samirahmed/.npm/_cacache` |
| Original build Node | `/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node`, e4b5a3af…; byte input only, never launched by this unit |
| Fresh output parent | `BASE/2026-11-06-stage-b-materialization-1` (RUN), refused if it exists |
| Package destination | `RUN/package` |
| Controller logs | `BASE/2026-11-06-stage-b-materialization-controller-1`, refused if it exists |

Actual saved RUN4 terminal status is ordinary_full_build_observed_unqualified, materializationPerformed=false. Completed evidence records compilerExit0,1113 required output metadata entries, and fresh producer681a5b12c7e16bf5e84022b98ac0be00a12942d20ec210f5091ae2bf2f451fbf/772457bytes. This source inspection read those JSON receipts; it did not rerun current-build validation or accept a package.

## Exact existing API call

The fixed driver claims RUN once, validates frozen inputs and invokes only:

```python
materialize.materialize_isolated(
    BUILD/'completed-observation.json', BUILD/'build-run', BUILD/'stage', REPO,
    Path('/Users/samirahmed/.npm/_cacache'), BUILD/'engine-inputs',
    BUILD/'generation-run', ORIGINAL_BUILD_NODE, RUN/'package',
    system_mode_map=materialize.SYSTEM_MODE_MAP,
)
```

The existing isolated_build_details path rechecks original successful compiler attempt/result/observation, original Node bytes/version record, exact archived source/generation/cache/client/native/profile/System/fixture inputs and current output/Next declaration metadata. It uses existing bounded local Git reads and ordinary file parsing, not npm/generation/build execution. A changed/unknown input refuses.

Existing materialization then copies fixed .next/public/config/runtime inputs, every dependency file and traced support target; preserves the explicit issuer-runtime distribution allowlist; relocates only recorded Next trace roots; copies signed runtime Node/bootstrap/guard with the existing fixed map; creates four separate companion copies and fixture resources; checks source/copy currentness; writes canonical file manifest/receipts and verifies the package. It automatically calls finish_fixture_materialization AFTER the main materialization/manifest exists; do not invoke that finish again or create a cyclic self-binding.

This is potentially multi-GiB file copying and repeated verification. Existing limits remain250000entries,8GiB total,2GiB per file,32MiB path bytes and the existing isolated trace limits; no log allowance is repurposed as an artifact cap.

### New-copy mode mapping only

`axiom.system-runtime-output-modes/1` is the ONLY selected map:

| New package path | New mode |
|---|---|
| `__axiom_runtime__/node` |0755|
| `__axiom_runtime__/origin-bootstrap` |0755|
| `node_modules/@axiom/verified-issuer-runtime/native/origin_guard.node` |0644|

Original signed artifacts remain0600. Owner/broker/controller/maintenance are copied separately under `RUN/system-companions/Axiom Synthetic Custodian.app/` at their fixed leaf coordinates, mode0600. They are not a final assembled/sealed app. Fixture producer/schema/binding/seed and separate toolNode copies are0600 under `RUN/fixture-delivery-inputs`; original files remain unchanged.

### Required host metadata included in this decision

The existing native prerequisite observer runs once for the payload and once for companions. Each invocation executes both commands below, for **four commands total**, each existing15second timeout:

```text
/usr/bin/sw_vers -buildVersion
/usr/sbin/diskutil info -plist /
```

These read build version/root APFS-snapshot metadata and record arm64 Mach-O load commands, supported own-loader-path/rpath dependencies and unresolved entries. They do not attest host/vendor identity, prove dynamic closure or grant runtime execution. No mount/write/sign/Security API is called by these observers. Existing check_output behavior is retained; no new command/output supervisor or claimed descendant isolation is added.

## Outputs, failure handling and limits

Expected new outputs are RUN/package/_axiom_local_issuer_manifest.json; RUN/materialization.json(format3); RUN/system-companions; RUN/fixture-delivery-inputs; RUN/fixture-delivery.json; plus driver attempt/terminal summary and separate controller logs. The final fixture receipt acyclically joins actual packageDigest, main materialization, source inputs, compiled producer and Prisma dependency bytes. Package digest/counts are unknown until the actual operation succeeds; no placeholder digest is supplied.

Existing normal-exception cleanup removes only newly created package/companion/fixture-copy directories; receipts/logs may remain. Abrupt controller termination can leave partial new outputs. Never reset/reuse the output root or retry automatically. No original build/stage/artifact/receipt is deleted, repaired or mode-changed.

Unchanged outer controller limits1800seconds/shared1MiB plus at most5seconds original-child cleanup wait; it owns only its original driver's group and never signals a numeric group after reaping. It does not prove descendant quiescence/universal preemption/complete containment. Success reports package_file_set_verified/materialized_package_files_observed_unqualified only: canonical content/metadata observations, **not physical immutability, a sealed image, installed custody or executing identity**.

No npm, Node/verifier/producer/helper/addon launch, Prisma generation/schema execution/SQL, Next/compiler rerun, image creation/mount, app/container assembly/seal, company signing/Keychain, account/service/root/install, database/provider/customer/AI/deploy/CI/spend action. All runtime/installation/activation flags remain false; all A2 parent acceptance remains open.
