# SDD ledger — plan: docs/superpowers/plans/2026-11-15-operational-main-capsule.md

Pre-flight: Task2 consumes Task1 compileOperationalPrivateMain/writeOperationalPrivateMain receipt. No interface conflict.

Ruling: existing root rolldown1.2.19, not missing esbuild or a new dependency, compiles the three captured TS files via fixed logical IDs; this avoids unbound sidecar modules and authoring paths. Actual target/runtime qualification remains separate.

Task1 RED: seven tests failed on missing compiler module (BUNDLE-RED.log). First implementation GREEN: seven actual compiler/filesystem policy tests PASS (BUNDLE-FIRST-GREEN.log). Compiler uses existing installed native build tool, never target addon/clock execution.

Task1 correction: deterministic same-bytes output symlink substitution reproduced as Missing expected rejection (BUNDLE-OUTPUT-REPLACEMENT-RED.log). Writer now reopens original emitted files with O_NOFOLLOW, verifies original inode/version and exact bytes for both code and receipt, and checks only two members. Eight actual tests PASS; no target execution.

Task2 artifact: ACTUAL-MAIN-CAPSULE.json records one11241byte main, SHA2569a058466aa4b247ead7d352821056a3319c33739197057fa6118ab0d55c45810, syntax-only exit0, original program never imported. Root type/full ordinary validation started; no native/target run or production action.

Final review: fresh independent operational_capsule_final_review found one Important/P1 extra-loader escape. Root agrees: alias/standalone createRequire and alternative node:module loader remained outside static graph. Three compiler-only regressions RED (8pass/3fail); require every loader reference to be sole fixed addon call and restrict node:module binding; all11PASS. Added recipe hash to compiler/source binding with separate RED. No target program executed. Declined native/runtime/provider/whole-goal judgments remain explicit external gates, not reviewed as complete.

First whole ordinary suite19606PASS/1expectedfail/1144skip; strict root typesPASS. Both results precede loader-policy correction. New final full suite required on corrected source.

Task1: complete — actual11compiler/filesystem/loader checksPASS, originalREDs preserved.
Task2: complete — finalartifact+syntaxonlyPASS; correctedwholeordinary19606PASS/1expectedfail/1144skip, roottypesPASS,36PythonCLIpass; freshwholebranchreviewoneImportantfindingcorrectedby3RED-to-GREENregressions. No targetprogram/nativeruntimeexecution.
Ruling: preserve one coherent local source savepoint for installed entrypoint, capsulematerializer and evidence rather than a tiny PR stream. No public push/PR/deployment is authorized by that local savepoint. Full goal/native/host/provider/activation requirements remain active.
