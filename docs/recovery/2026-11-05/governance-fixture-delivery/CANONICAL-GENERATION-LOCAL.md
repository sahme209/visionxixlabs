# Local canonical-generation join correction

The fixture source observer and final materialization verifier now distinguish raw archived source from raw generated schema. They use the existing generation attempt/result, current generated outputs and equal canonical scratch bytes. The SQL recipe remains bound to its original raw source. No schema is rewritten or formatted by this unit.

The shared `local_prisma_engine_inputs.verify_generation_observation` is a bounded file-only validator, extracted from the source builder. The full FDI observer additionally calls existing `prepare_generation` (including existing sandboxed Git reads/source/SRI/native input inspection); those boundaries are explicitly mocked in these local tests and remain real future operational reads. Its packet uses required `generationInputs` coordinates; the existing generation identifier remains unchanged. Missing proof refuses.

The stale npm-installed schema-engine sidecar requirement is replaced by the actual separately bound generation engine's SHA and size joined to the original recipe engine pin. Actual query-engine copies and all source/SRI checks remain. No dummy platform sidecar, engine rerun or alternate hash is supplied.

TDD: initial behavioral RED failed exactly at the old raw-schema equality. The coherent fixture was then strengthened with synthetic preparation plus actual attempt/result/output/canonical validation; initial RED did not itself include that full proof. A separate genuine RED demonstrates the valid bound-engine/no-npm-sidecar path failing at the stale sidecar lookup, followed by GREEN. Additional negative cases were added during implementation and review; they are not claimed as preimplementation RED.

Evidence:
- `/private/tmp/axiom-fdi-canonical-red.log`: original wrong raw equality.
- `/private/tmp/axiom-fdi-canonical-focused.log`: four focused tests, including real selected materializer algorithm on inert synthetic files and builder delegation.
- `/private/tmp/axiom-fdi-engine-source-red.log`, `/private/tmp/axiom-fdi-engine-source-green.log`: sidecar input-source regression.

Independent design review passed before implementation. Closing independent source review passed after the sidecar correction. Final finite selection: 14 tests passed, exit 0 in 3.182 seconds (`/private/tmp/axiom-fdi-canonical-final14.log`); current source hashes are saved in `canonical-generation-source-bindings.json`. All runtime compatibility, semantic attestation, issuer, custody, installation and activation gates remain unavailable/closed. Historical actual receipts are grounding only, never current authority. No actual generator, Git, vendor code, native API, SQL, signing or real artifact assembly was invoked.
