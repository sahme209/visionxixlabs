# Desktop workspace increment — local verification

The accepted web cockpit and production configuration are unchanged.

Implemented: persistent editor/Agent split with compact navigation; managed isolated Git worktrees; version-checked own-conversation rename endpoint; typed Agent failures with explicit draft restoration and queue pause; conversation scroll following; autosized composer; cancellable secure-storage startup recovery.

Verification: 1,199 application/API/runtime tests across 94 files passed; root TypeScript passed with 6 GB heap; desktop TypeScript and unsigned macOS debug build passed; 72 Rust tests passed with one pre-existing ignored test. Independent review found an index-exclusion cleanup hazard, reproduced by a failing regression and fixed by refusing assume-unchanged/skip-worktree and unusual index entries. Replacement repositories, ignored/untracked/changed files, hooks and filters are covered by native regressions.

Native acceptance after unlocking the Mac: saved session loaded; split opened; fixture file displayed; a real isolated branch/check-out was created and opened; npm test passed with exit 0; current-checkout removal was disabled; original fixture returned to main with zero changed files; Agent draft survived Settings and was cleared without sending; rename dialog opened and canceled without changing production history. The created disposable worktree is retained, with its branch preserved. No force cleanup was performed. Startup escape was tested automatically, but the real vault loaded normally on this restart.

Limits: worktree checkouts deliberately skip repository hooks and custom filters; shared Git objects are excluded from the 50 GB inventory; external filesystem races are not an atomic snapshot. Rename and structured Agent issues require a service release and are not claimed verified against production. Production Agent completion remains blocked by unverified identity storage recovery preconditions documented in agent-identity-recovery.md. No policy bypass, production DB action, release, provider spend, or cockpit change occurred. This is an increment, not complete Cursor feature parity.


Compact follow-through: split workspace repository setup and commit/publish forms now expand on demand without unmounting their fields. Native buttons were expanded/collapsed and verified; original fixture stayed clean on main. Updated unsigned macOS build and 854 desktop tests across 69 files passed. Screenshot: outputs/axiom-desktop-editor-agent-split.png.
