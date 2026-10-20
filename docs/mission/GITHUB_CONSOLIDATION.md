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
