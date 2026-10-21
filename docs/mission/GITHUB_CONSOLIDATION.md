# GitHub consolidation checkpoint

Main inspected: `eab40ee046be70abe012bd3a7f9108f92652c92d`.
No existing PR head was changed or merged on GitHub.

| PR | Exact head | Included in pushed4db11e37? | Exact-head blocker |
|---|---|---|---|
|187|e356c036550497db17d2f05a26fea2f12af3f527|No; merged locally at324435e3|Website acceptance failure; previously passing Test, native, SQL and HTTP|
|191|a2b488ffa769f341f6687f959fe2a52f9bf0b7e1|Yes, ancestor|Website acceptance failure; Test and native pass|
|192|0e418a4b081457cf8e10e2ca3238024997147a07|Yes, ancestor|Website acceptance failure; Test and native pass|
|193|a96367fc719dd6b94eebf3b812008cc659f7aaf5|Yes, ancestor|Test/native/website fail before steps; exact startup annotation inaccessible|

All four heads and subsequent local product milestones are ancestors of
`codex/axiom-consolidation-local`. Local merge324435e3 preserves both parents.
The sole conflict, mission-tracker append history, retained every original line
from both parents. PR187's source/gates had no source conflict. No duplicate
implementation/cherry-pick/rebase/reset was needed. Its historical SQL receipt
remains labeled with original source, not acceptance of the consolidated head.

Sequence:
1. Preserve all original PRs and refs. Review and back up this consolidated
   non-main branch without a PR; current push triggers target main/tags only.
2. Resolve GitHub startup access using the existing failure annotation, not a
   speculative rerun. No source change can legitimately fix an unknown
   pre-run platform rejection. Do not weaken assertions or branch gates.
3. At one deliberate CI checkpoint, create/review a consolidated PR with Test,
   Linux/macOS Desktop CI, website acceptance and isolated commercial SQL/HTTP
   acceptance. Required checks must pass for the exact final head; changes
   invalidate previous-head evidence. No rerun of the known browser wait without
   a new evidence-backed hypothesis/fix.
4. Merge only the eligible, reviewed exact head once policy permits. Close or
   mark old PRs superseded only after verifying main contains their heads.
   Do not independently land overlapping PRs merely to reduce the open count.

Current local evidence:129 Agent/profile/editor/receipt cases pass. Separate
commercial/launch boundary run86 pass/2 subprocess-environment failures; both
remain mandatory and unwaived. One lacked spawn-error checking and now diagnoses
that failure before parsing stdout. No repeated blocked subprocess test run.
No native Rust/compiler/installed-Mac, real provider or cloud acceptance claimed.

## PR194 running-check repair checkpoint

Attempt 2 started successfully: Desktop CI and both commercial PostgreSQL acceptance jobs passed. Test reported 8,879 passes and one failure: a newer conversation selection was ignored while an older read was loading. Reproduced locally before changes (6 pass, 1 fail). Permit superseding selections while retaining request epochs, credential fences, send/decision guards and disabled new-chat creation. Existing reverse-order regression plus explicit request/selector assertions and demo contracts now pass (22 tests).

Website attempt 2 passed eleven interaction gates but failed documentation navigation: no document/RSC request was observed after the pointer click. Root cause remains unverified. Preserve the real navigation assertion, existing deadline and isolation controls. Investigate the pointer-to-navigation boundary before any CI rerun; no speculative application change or timeout increase. Keep local native-file-creation commits separate from this PR repair.

## Documentation-navigation diagnostic checkpoint (unpublished)

Exact6e23fab7 passed all six checks across four workflows. Website39519735620 passed12 gates, including documentation navigation. Marking194 ready triggered39520883805, which failed at that same boundary: no destination request, source unchanged, owned groups empty. Do not merge, retry unchanged, or infer that the desktop race repair fixed navigation. Root cause remains unverified.

Focused plan: observe the real passive click capture/bubble, intended anchor, trusted/primary event, final defaultPrevented, and the public Next Link onNavigate intent callback; observe only main-frame navigation to the fixed same-origin destination. Refresh click/intent evidence during the existing destination polls so delayed event replay is visible. Keep proxy request counters and actual destination DOM/content assertions authoritative. Intent is not proof of successful router dispatch or destination. No synthesized clicks, forced navigation, retries, timeout increases, framework changes, or isolation exceptions.

The fixed DOM intent event carries no payload and changes no router action. Public diagnostics accept only exact boolean/null fields and refuse accessors/unknown fields; no URLs, event content, credentials or error text are exported. Independent review identified a stale immediate-only snapshot and unqualified subframe observations; both corrected with delayed-replay/main-frame regressions. Actual browser execution remains blocked locally before startup by managed spawnSync git EPERM; three related subprocess tests likewise remain unverified. Obtain final review and exact-commit owner push authorization before one evidence-driven CI run. No merge, old-PR closure or Vercel operation at this checkpoint.

Final local validation:64 tests across8 focused suites passed; full repository TypeScript passed; JavaScript syntax and diff whitespace checks passed. Final independent review found no blocker and separately passed17 focused cases. A wider diagnostic run had306 passes and three managed subprocess EPERM failures (not acceptance); its fourth receipt-construction failure was corrected by declaring the added diagnostic inputs, with the affected suite now passing. Do not claim browser root cause or native acceptance from these results. Owner approval is still needed for the exact diagnostic commit and a meaningful CI evidence run.
