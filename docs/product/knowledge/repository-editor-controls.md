# Repositories: inspect and edit an existing local text file

Help ID: `repositories.edit-local-file` · **INTERNAL DRAFT — unpublished** · Source commit `5d99d326` (full identifier and exact SHA-256 source bindings in `repository-editor-controls.sources.json`), November 3, 2026. Customer eligible: **false**. Publication approved: **false**. Static source inspection only. No native walkthrough, screenshot, mock, provider request, release qualification or editorial approval is represented by this guide.

## Purpose, location and prerequisites

Use the mounted **Repositories** workspace to find an existing file in the selected local checkout, inspect its text, make a draft, review it and explicitly save to disk. `App.tsx:171–173` mounts `RepositoryWorkspaceView` for `repository-workspace`, including the compact pane alongside Agent. This is not the separate legacy repository inventory view. Start with a selected, available Git working tree and check its scope strip before editing. Acquisition and checkout selection are covered separately in [the acquisition draft](repository-acquisition-controls.md); this guide does not repeat or complete that workflow.

The file commands run through native Tauri handlers registered in `main.rs`; they use the desktop process's filesystem permissions and installed Git. The inspected list/read/write commands contain no additional GitHub capability or provider-token check. Do not infer remote write permission from a local Save, or describe these local controls as requiring the clone token. App identity/workspace context scopes UI ownership, not a new per-file filesystem grant. Browser/static previews cannot establish native file behavior.

The native list uses `git ls-files -co --exclude-standard -z`: tracked and nonignored untracked paths, limited to the first 5,000 returned paths and then sorted. **All files** does not enumerate the entire disk or override Git ignore rules or this limit. Read resolves the Git root, validates a relative path, rejects top-level `.git` metadata, and requires a canonical regular-file target inside the root and UTF-8 text of at most 1,000,000 bytes. A symlink resolving inside the tree can be read; Save rejects a symlink at the destination. These checks are not a universal secret detector or an atomic filesystem isolation guarantee.

## Exact control inventory

The 27 numbered rows are control families. Alternate visible/accessible labels and keyboard aliases count once; arbitrary file rows count as one family. Source anchors are literal strings in `RepositoryWorkspaceView.tsx:813–877,891–899`, with diff pagination in `FileDiff.tsx`. They bind this nested unit, not every control in the workspace.

| # | Literal control / source anchor | Effect and conditions |
|---|---|---|
| 1 | **Files** | Shows the file-list navigation. No file read until a row is selected. |
| 2 | **Changes** | Shows recorded Git status paths, not a fresh diff or current verification receipt. |
| 3 | **Filter files** | Trims and case-insensitively filters path substrings in the active list; does not search file contents. |
| 4 | **All files** / **Source files** | Toggles display filtering in Files; disabled in Changes. Source files hides `.DS_Store` and path segments `.git`, `.next`, `build`, `DerivedData`, `dist`, `node_modules`, `target`, `xcuserdata`; this is noise filtering, not a file-type/security classification. |
| 5 | **Refresh changes** | Refreshes local Git status and file inventory; disabled while busy or without a checkout. No fetch/pull, and no editor-buffer reload. |
| 6 | File path row / changed row accessible label `${change.status} ${change.path}` | Reads current file text. Changed rows are disabled while busy or unavailable in current file list; ordinary Files rows have no busy-disabled attribute. Deleted/unavailable paths cannot be opened from Changes. |
| 7 | **Discard and open** in **Discard unsaved changes?** | Confirms opening the chosen file and discarding the old buffer. Even reopening the current dirty file goes through this prompt. |
| 8 | **Discard and switch** in **Switch repositories?** | Confirms a checkout change and drops that unsaved buffer. Selection itself is the acquisition guide's responsibility. |
| 9 | **Cancel** | Dismisses a pending confirmation and retains the buffer. Backdrop click and Escape also dismiss; neither is an Undo or operation-cancellation control. |
| 10 | **Editing tools** | Compact-pane disclosure for line/find/history tools; expanded in full layout. |
| 11 | **Line number** (placeholder **Line**) | Accepts up to seven characters; does not move until Go/Enter. |
| 12 | **Go to line** | Selects an existing one-based line, excluding its LF/CRLF terminator. Enter in the line input also acts. Rejects missing/nonpositive/invalid/out-of-range lines with **Enter an existing one-based line number in the current file.** Busy/current-context guards apply. |
| 13 | **Find** / **Find in file** | Opens current-file search and focuses/selects its input. Cmd/Ctrl+F in the editor is an alias. |
| 14 | **Find literal text** | Case-sensitive literal search over the current unsaved buffer; max 256 JavaScript string units. No regex or cross-file search. |
| 15 | **Replacement literal text** | Literal replacement text, max 8,000 string units. Typing alone changes no file content. |
| 16 | **Replace selected match** | Replaces one navigated match in the unsaved buffer, then clears selected-match index. Disabled while busy or without a current match. No Replace all. |
| 17 | **Previous** / **Previous match** | Selects previous match and wraps; Shift+Enter in search is an alias. |
| 18 | **Next** / **Next match** | Selects next match and wraps; Enter in search is an alias. |
| 19 | **Close** / **Close file search** | Closes search and focuses editor. Escape in search also focuses editor; Escape in editor closes search. Closing does not undo a replacement. |
| 20 | **Undo** / **Undo edit** | Moves backward through this file's in-memory history. Cmd/Ctrl+Z in editor is an alias. Disabled while busy or without a prior state. |
| 21 | **Redo** / **Redo edit** | Moves forward through retained history. Cmd/Ctrl+Shift+Z or Ctrl+Y in editor are aliases. Disabled while busy or without future history. |
| 22 | **Save ⌘S** | Writes a captured buffer snapshot to the existing local file, with expected last-loaded/saved content check. Cmd/Ctrl+S in editor is an alias. Disabled while busy or unchanged. No staging, commit, push, check or approval. |
| 23 | **Review changes** / **Review local changes** | Toggles **Review unsaved file changes**, comparing draft against last loaded/saved content, not HEAD, whole checkout or remote proposal. |
| 24 | **Previous** / **Previous diff page** | For more than 2,000 rendered diff rows, moves back a page; disabled on first. |
| 25 | **Next** / **Next diff page** | Moves forward a diff page; disabled on last. Review all pages. |
| 26 | Textarea **Editing `${selectedFile}`** | Edits in memory with spellcheck off. Tab replaces selection with two spaces. Selected text also supplies Ask Agent. No autosave; textarea remains editable during busy operations. |
| 27 | **Ask Agent** / **Ask Agent about selection** → **Prepare Agent draft** | Requires 1–8,000 selected units, accepted nonsensitive path, callback and no busy operation. **Prepare selected code for Agent?** asks to prepare an unsent Inspect / Code Review prompt. Cancel dismisses. Confirm checks file identity/content again; changed file requires reselection. Preparing does not save or send to a model; later Send is a separate disclosure/approval boundary. |

Search results show **Enter text to find**, **No matches**, or current index/count. Matching is nonoverlapping, capped at 1,000 occurrences; **+ (display limit)** means more exist. Editing content or query clears the match index, so navigate again before replacing. A stale/invalid match or replacement exceeding 1,000,000 UTF-8 bytes yields **The match changed or replacement exceeds the editor limit. Find the match again.** The textarea itself has no matching byte ceiling; an oversized manually typed buffer can still fail Save.

Diffs show added/removed counts, contextual lines and **… unchanged lines …**. `lineDiff.ts` uses a coarse prefix/suffix comparison above 300,000 old/new line pairs; do not treat grouping as exact minimal edits. Pagination resets on content change. **No unsaved content changes.** refers only to this baseline comparison. Generated Xcode metadata paths show a caution to edit only when the format is understood.

## Save, selection and recovery

The filename shows **· unsaved** whenever buffer differs from the last loaded/saved baseline. Edits, Undo, Redo and replacement invalidate verification freshness. History holds at most 40 past and 40 future states, further bounded to 500,000 retained string units excluding present content; new edits clear redo. Save does not reset history or make Undo a disk rollback: undoing a saved edit creates a new unsaved draft requiring another deliberate Save. Opening a file or changing checkout resets history. Per-file search, replacement, line target, selection count and review visibility reset before the new file becomes interactive. There is no persistent draft recovery or standalone Discard button in this unit.

Save passes the captured text and saved baseline to `write_repository_file`. Native code validates the existing parent/regular destination, rejects a destination symlink, checks UTF-8/current size and compares disk content with the expected baseline before `fs::write`. **File changed outside Axiom. Reopen it to review before saving.** means reopen/review the disk version and deliberately reconcile the draft; repeated Save does not bypass the check. Preserve any wanted draft before confirming discard. Removed files, invalid paths, missing folders, non-UTF-8 text, size and filesystem-write failures surface as errors; creating missing files is a different workflow.

This check is explicitly **not atomic compare-and-swap** against unrelated filesystem writers. `fs::write` is not a transactional or backed-up save. A failed or lost result does not prove disk content stayed unchanged. Inspect the current disk file through deliberate reopen/review before retrying an uncertain save; do not blindly overwrite it.

The textarea can change while a save is pending. Successful current-owner completion advances the baseline to the captured snapshot, leaving later typing unsaved, then refreshes Git status/file inventory. A refresh error can appear after disk write succeeded; **Saved …** and a subsequent alert do not establish a rollback. Ordinary file rows can supersede a busy operation; opening clears the old buffer before native read returns, so read failure can leave no selected editor. Do not switch files during an uncertain save expecting it to cancel disk work.

Session context revision, identity/workspace session keys, repository generations, operation request IDs, file request IDs and loaded-file identity suppress stale UI updates and confirmation callbacks (`RepositoryWorkspaceView.tsx:64–183,289–360`). A change away and back does not revive old ownership. These are UI application guards, not native cancellation, deadline or proof that a submitted write stopped. Context remount can lose unsaved state without the file-switch dialog. Navigation hiding can retain a mounted pane; it is not a persistence guarantee. This unit has no Save Cancel button or guaranteed recovery after closing/sign-out/process exit.

Ask Agent path screening comes from `localCodeContextPrompt` and the repository evidence policy (known environment/credential/key paths and invalid paths), not content scanning. The local editor can open sensitive text that native path checks otherwise permit. Review selected content yourself; no zero-exposure or universal secret-filtering claim is supported. This task did not prepare or send any such prompt.

## Scope and evidence boundary

This draft adds only the mounted existing-file navigation/editor/search/history/save/unsaved-review unit. Agent draft loading/new-file creation, worktree management, checks/output/cancellation/repair, branch/sync/commit/push/PR controls remain separate unfinished guides. The acquisition draft is preserved unchanged. No mock/static preview is accepted as native evidence; actual behavior described here is source-supported intent, not an executed walkthrough. Current native visual/keyboard/accessibility review, supported release mapping, safe approved demonstration material, genuine editorial review and approved retrieval entry remain necessary before customer publication. No approval or customer eligibility is granted here.
