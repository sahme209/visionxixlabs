# Desktop keyboard composition batch — local only

Four current surfaces now preserve native composition signals before custom shortcuts:

- Command palette: keyCode229 joins its existing isComposing checks for the global shortcut and dialog keys. Composition cannot open/close, change selection or navigate.
- Recovery sign-in: both signals return before administrator-key verification; ordinary Enter still invokes the existing mocked verification path once.
- Focused release navigation: composition arrows/Home/End preserve selection, draft and focus.
- Ticket provider navigation: composition navigation preserves the actual mounted Governance form and its draft instead of switching provider.

Command/sign-in actual RED7failed/24passed became31GREEN; release navigation actual RED20failed/11passed became31GREEN. Initial test-authoring syntax error is preserved separately and is not behavioral RED. Existing ordinary navigation, modifiers, browser sign-in recovery, current ownership and action guards remain. Full desktop TypeScript passed under scrubbed env/kernel network denial. Independent read-only review found no important findings. Root checked8recorded source/test hashes and independently reversed only the guards to restore all4actual Git4128c67c runtime baselines byte-for-byte.

These62cases are local rendered/React tests with mocked credential, native and provider adapters. No real credential/API/native/session action, genuine human decision, app restart, build or publication occurred. This does not establish native IME, AT, clean-host, saved-session or whole-app keyboard acceptance.

## Audit limits and remaining candidates

Repository editor/find/line-number handlers already guard both signals. The separate global repository confirmation Escape listener remains an inspected guard candidate; a behavior change also requires explicit source-binding baseline requalification. Shared DesktopDialog handles composition without a guard in its generic component, but inspected current callers have confirmation buttons rather than editable fields; current physical IME exposure is not established. Legacy AgiMemoryView has unguarded custom Enter but no current App registration was established; no real AI call was made and no current reachable path is claimed. These files and historical binding records were not modified. The remaining master requirements stay open.
