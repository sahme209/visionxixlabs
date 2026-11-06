# Python recipe packet source unit

Only `scripts/governance_local_issuer/fixture_recipe_packet.py` and its new finite test module were implemented in this lane. CJS/helper files belong to the assembler. Actual artifact preparation/execution has not occurred.

- RED `/private/tmp/axiom-recipe-packet-red.log`: module did not yet exist. This is implementation TDD, not a diagnosed engine/runtime defect.
- GREEN `/private/tmp/axiom-recipe-packet-final-green.log`: seven tests in0.106s, owned synthetic files only, real canonical package manifest verification and source/view preparation, mocked existing child supervisor. No Node, CLI, schema engine, sandbox, SQL, cache staging/full-hash, signing, account, Keychain, provider or deployment action.
- Positive mocked child output joins exact prepared schema, raw stdout/SQL, seed, binding, command, private env, capture sizes/hashes and driver result. Negatives cover changed/extra accepted dependency, replaced dependency link, nonexecutable engine, reused destination/attempt, nonzero child, post-child executable metadata mutation, and success-shaped wrong CLI record. No actual process launched.
- Uses existing `_generation_profile` with read_protected empty (default reads remain allowed, no universal secrecy claim), fresh work/tmp and literal outer-log writes only; packet/attempt/result/input-view outside child writable work. Full accepted package manifest plus bound source/physical dependency/Node/engine snapshots are checked before and after execution.
- Original Node and original cached schema engine retain separate mandatory byte pins/executable metadata; no copy/chmod/fallback. Sole intentional input-view node_modules symlink targets selected accepted package. Defaults do not execute on import.
- Future actual invocation reserves exclusive attempt/result before launcher, uses existing original-owned-group60s supervisor with no retry, preserves failures/unknown output, and does not claim descendant quiescence or actual runtime qualification.

Current source hashes are in `python-source-hashes.json`. Root+assembler reviewed the original source; their targeted fixes and final review are recorded below. Do not treat this source report or packet executionAuthorized=false as operational approval. Reversible ordinary filesystem packet preparation can occur after review, before the later exact execution decision, as root instructed.

## Final review corrections and freeze

Root/assembler review identified four concrete gaps. Genuine RED `/private/tmp/axiom-recipe-packet-review-red.log` reproduced second unbounded JSON read, coherently changed input-view seed, unbound saved materialization receipt, and wrong-format/extra-key success binding. Corrected source now uses one stable bounded FD byte observation for JSON/schema/seed, requires source↔view hash/size equality before launch, joins the accepted package's actual parent materialization.json SHA to its manifest provenance, and compares the exact fixed complete recipe-binding dictionary.

Parent result diagnostics preserve only fixed stage(prelaunch/supervisor/postlaunch/export_join) and allowlisted reason; a targeted unknownexception test verified arbitrary text is not echoed. The header explicitly preserves ordinary reversible input preparation within scope; actual Node/CLI/engine/sandbox invocation remains separately authorized.

Final12 finite tests PASS `/private/tmp/axiom-recipe-packet-final-12.log`, after these changes. This selection used synthetic owned temp files, actual canonical manifest verification and mocked supervisor only. No actual packet, cache view or engine was prepared/run in this lane. Source frozen with refreshed `python-source-hashes.json`; root owns any subsequent ordinary actual-input preparation and later execution decision.
