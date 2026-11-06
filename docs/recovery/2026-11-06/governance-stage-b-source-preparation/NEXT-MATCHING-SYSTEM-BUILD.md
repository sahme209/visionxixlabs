# Next matching System build — prepared evidence, execution pending

The seven existing signed roles can now be selected with existing System v2 APIs. Root subsequently froze actual source `2c6d47935cb858d4a78cf5efc03b09b4eeedba9e` and its real System v2 packet at `BASE/2026-11-06-stage-b-full-source-3`; the concrete next one-run build proposal is [prepared here](next-system-inputs-1/EXECUTION-REVIEW.md), with materialization excluded. [The incomplete selection](next-system-inputs-1/seven-role-evidence.json) has **no sourceRevision** and is deliberately not a System build packet or build receipt. Its flags remain false. It does not authorize a fresh compiler run. A2's actual compiled consumer, resource custody, fleet/enforcement/enrollment and all parent acceptance requirements remain open; [the master](../../../product/axiom-master-action-plan.md) is preserved.

## Exact selected evidence

Let `BASE=/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Qualification Lab`.

| Selected roles | Actual saved result / preparation |
|---|---|
| controller, owner, maintenance, bootstrap | `BASE/2026-11-06-stage-b-native-1/signing-result.json` |
| controller preparation | `BASE/2026-11-06-stage-b-source-3/controller-first/system-preparation.json`, SHA256 `5e6a4e1832a16a067b4e52c43c295c6bcfb98afbf167891534d455e61cc235ea` |
| owner/maintenance/bootstrap preparation | `BASE/2026-11-06-stage-b-source-3/independent-leaves/system-preparation.json`, SHA256 `6378655d599c01027498a98ce296577307ed75b50a5a96d4bb508d6d37f178e9` |
| broker result / preparation | `BASE/2026-11-06-stage-b-broker-guard-1/broker-signing-result.json`; `BASE/2026-11-06-stage-b-broker-source-1/broker-leaf/system-preparation.json`, SHA256 `3eae3caa38a9df99c08649132e67e37737874e5ab1ff135b957d0ea755680ada` |
| guard result / complete preparation | `BASE/2026-11-06-stage-b-broker-guard-1/guard-signing-result.json`; `BASE/2026-11-06-stage-b-broker-guard-1/guard-source/system-preparation.json` (exact binding in selection) |
| runtime Node | Original node role selection in `docs/recovery/2026-11-05/governance-real-system-build-inputs/system-build-packet-0b0e8b48.json`; artifact `BASE/2026-11-05-private-node-profile/node-review-copy`, SHA256 `1aa6f6936040d80d6f9c1bb75ba4af97ce596af514ab7f0157a77f461abce134`. Original signing packet/results/raw logs remain selected, not rewritten. |
| four leaf observations | [Regenerated observation](next-system-inputs-1/four-role-profile-observation.json), exactly equal as canonical JSON to [the accepted actual observation](peer-unit-1/FOUR-ROLE-PROFILE-OBSERVATION.json). Existing observer ran once against these selected roles and preparation references; it accepted saved files, not runtime identity or fresh cryptographic verification. |

The selection binds the original three role-result files and old Node selection separately. Every sourceArtifact/unsigned artifact dictionary is retained exactly; none is normalized. Existing partial-five and consumed attempts are untouched.

## Canonical preparation reference selection

The first four roles' original outer role records have five-field preparation references (`path,sha256,size,mode,state`). The existing System provenance code compares each selected role's preparation reference to `preparationReceipts`. Fixture delivery subsequently reads those selected references through its existing **strict four-field** `_json/_bound` API. Copying the five-field references verbatim would therefore fail the fixture consumer before compilation.

This new selection uses existing `system_build_inputs.binding(original_path)` for each role's selected preparation reference and the preparation list. All four retained values were checked equal to the original reference, and each original saved state array was checked against the actual unchanged receipt. The original five-field records remain bound and unchanged. This selects the same file/content/mode in the supported four-field representation; it does not restamp a historical receipt or change generic binding validation. The new four-role observation was generated against these exact selected references and equals the accepted original observation.

The independent canonical-reference review accepted this approach. Minimal adoption checks: original state/path/hash/size/mode equality; identical selected preparation references in role proofs/list; successful existing observer over actual leaves; independent inspection of the saved selection. A later changed preparation byte still fails existing `_bound`/System provenance and fixture checks. No FDI or generic validator source change is proposed.

## Fresh source and exact existing API order

Current committed HEAD at inspection was `795195f3820127417b7ce1eba160a97e071dd197`. Its native package/origin_control source diff from the signed native basis `3fd8fcb37367401e870898265f7f5a5bd475a6a8` was empty. All 54 selected Stage A source bindings currently match except the authoritative **working master**, which is modified outside HEAD. These facts do not create a fresh full-source revision. Preserve that master and select an actual full Git snapshot containing the intended working content before assigning `REV`. The existing native-only `source-3/repo` is not a full application checkout. The consumed Stage A tree already has `.next`; do not reuse it or delete outputs to manufacture freshness.

Root froze `BASE/2026-11-06-stage-b-full-source-3/SOURCE.json` using a private index and exactly three explicit tracked overlays. Actual revision is `2c6d47935cb858d4a78cf5efc03b09b4eeedba9e`; main index/branch remain unchanged. Other working changes were not inventoried, untracked files excluded. Earlier scan-based freezes stopped; no retry of those source paths is proposed. Coordinates below are the next intended API inputs; no build run is created or executed by this plan:

```text
REPO = /Users/samirahmed/Documents/Codex/2026-10-29/axiom-ticket-install-completion
REV = 2c6d47935cb858d4a78cf5efc03b09b4eeedba9e
RUN = BASE/2026-11-06-stage-b-system-build-1
STAGE = RUN/stage
BOUND = RUN/engine-inputs
GEN = RUN/generation-run
BUILD = RUN/build-run
NODE = /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node
CACHE = /Users/samirahmed/.npm/_cacache
NPM = /Users/samirahmed/.nvm/versions/node/v24.21.0/lib/node_modules/npm/bin/npm-cli.js
```

`NODE` is the original build tool, SHA256 `e4b5a3af0e05c75de2eae013904145f40fe7fc2a6e6f17510128bf45cca4e79b`, distinct from the signed runtime Node. Use the existing builder `scripts/build-local-issuer-package-source.py` as `b`, `scripts/local_prisma_engine_inputs.py` as `e`, and existing governance modules below. The consumed old prepared driver is a reference for API ordering only; never execute or edit its frozen old-source packet.

1. **Ordinary source/file preparation:** freeze the actual full source/Git object view and new packet/controller input hashes, preserve the working master, and copy accepted recipe schema/binding/seed bytes into new owned mode0600 files. Select existing signed artifacts; do not compile or sign them again. Create the real `axiom.system-build-packet/2` only after `REV` exists: generation/layout from the selection, all seven selected roles, its four canonical preparation references, bound regenerated `profileObservations`, and false execution/installation flags. No legacy `guardSupplement/guardHistoricalResult`. Prepare the fixed fixture packet data with the same `REV/STAGE`, signed runtime toolNode, and `generationInputs={run:GEN,boundInputs:BOUND,cache:CACHE}`. The fixture packet can only be finalized with actual fresh generation coordinates and bound schema engine.
2. **Fresh operational bundle, explicit approval required:** `b.prepare_optional_probe(REPO,REV,CACHE,NODE,NPM,RUN)`. This extracts a new archive and runs offline npm installation; require succeeded outcome. No cache download or retry. Create empty private `BUILD` before recording inputs.
3. `system_build_inputs.record_system_inputs(STAGE,REPO,REV,BUILD,NODE,SYSTEM_PACKET)`. Existing APIs independently check complete seven-role/source/header/config/peer/signing evidence, record the planned build coordinate and copy only saved guard/bootstrap bytes into fresh source paths. This is file preparation, not a compiler or identity qualification, but depends on the actual fresh stage from step2.
4. First copy signed d911 query from `BASE/2026-11-06-detached-query-compat-3/query-review-copy.node` to fresh `RUN/engine-source/libquery-engine`, and original pinned schema compiler from `BASE/2026-11-05-real-system-build-0b0e8b48/engine-inputs/schema-engine` to `RUN/engine-source/schema-engine`; then use existing `e.bind_local_engines(RUN/'engine-source',RUN)`. Do not select the cached/original e0 query. Then `e.execute_generation(STAGE,BOUND,REPO,REV,CACHE,NODE,GEN,timeout=120)` on its new empty private generation run. Existing engine/schema pins remain `605197351a3c8bdd595af2d2a9bc3025bca48ea2` / schema-engine SHA256 `57b090d47b947dc9284379d9480d11ffe14fe63155e3da515b359f3aa7fa408a`; no SQL connection/application occurs.
5. After generation completes **and before `.next` exists**, finalize the fixture packet with raw schemaSource, actual bound schema engine and accepted new recipe copies, then `fixture_delivery_inputs.record_fixture_delivery_inputs(STAGE,FIXTURE_PACKET)`. It must join the same fresh generation evidence and System runtime Node. Original raw Prisma schema SHA256 remains `50e1fbbf50d5d28ba08e862a72789de3c5a9fdad5d7589751a86e0135c5eb031`.
6. `b.execute_build(STAGE,REPO,REV,CACHE,BOUND,GEN,NODE,BUILD,timeout=600)`. Its existing fixed sandboxed command order is build Node `--version`, `scripts/check-vercel-build.mjs`, `node_modules/next/dist/bin/next build --webpack`, `scripts/emit-private-fixture-release-bootstrap.cjs`, then `scripts/emit-synthetic-fixture-producer.cjs`. These are build-tool executions; no signed runtime/native helper or emitted producer launch. The fresh producer must equal the accepted Stage A SHA256 `681a5b12c7e16bf5e84022b98ac0be00a12942d20ec210f5091ae2bf2f451fbf`; mismatch refuses rather than edits pins/history.
7. Bind the original completed result and existing `b.prepare_build_inputs(...,phase='after_build')` / `b.verify_build_outputs(STAGE)` into a completed-build observation, requiring actual successful outputs and unchanged recorded inputs. This observes the completed run; it does not rerun the compiler.
8. **Excluded from the current prepared execution review; separate later decision only:** `materialize.materialize_isolated(OBSERVATION,BUILD,STAGE,REPO,CACHE,BOUND,GEN,NODE,DESTINATION,system_mode_map=materialize.SYSTEM_MODE_MAP)`. Existing materialization performs host/static native prerequisite observations and applies the fixed mode map to new copies, so name those operations honestly in the decision. Existing fixture materialization creates the acyclic final fixture receipt through its existing APIs. No installation, app sealing, mounting, resource provisioning or target launch is implied.

## Authority and stopping point

Already covered ordinary work: reading/hashing original files, selecting canonical new references while retaining original records, regenerating saved-file observations, preparing this incomplete evidence and exact review/source/packet data. This work ran no System recorder, generation, npm, Node, Next, materializer, signing, native helper, database, provider or network operation.

A fresh one-attempt offline dependency/generation/full-build bundle still needs its own concrete reviewed execution decision, including any materializer host/static observations and outer budget/cleanup scope. The earlier Stage A, four-helper and broker/guard grants are consumed. They do not authorize a full Stage B compiler run. No more native compilation/signing or permissive validator is required by this plan. Actual customer installation/custody/SAME-consumer qualification and full A2 acceptance remain separate.
