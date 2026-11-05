# Documentation contents IME Escape repair

1. Customer outcome: using an input method in the narrow Docs search should not dismiss the whole contents disclosure or move focus when Escape belongs to composition.
2. Owner/dependencies: A4/B6 keyboard usability; components/docs/DocsContents.tsx, actual DocsSidebar and existing disclosure tests. No new library.
3. Current source:59fc3d2e; ancestor Escape handler closes whenever open without checking native composition or keyCode229. Existing app handlers already use those guards.
4. Planned change: reproduce two rendered failures, then add native composition/keyCode229 earlyreturn only. No visual redesign, route/search data, input operation or permission change.
5. Boundaries: synthetic DOM/key events only; actual component/layout behavior, mocked Next route getter. No network/provider/DB, real OS IME, browser or assistive-tech acceptance claim.
6. Acceptance: isComposing and229 Escape preserve open panel/focus/filter, do not prevent event default; a later ordinary Escape still closes/restores focus. Existing six disclosure cases remain passing.
7. Proof: one bounded RED selection, corrected GREEN selection and scopedtypes under networkdenial, independent source review. No repeated unrelated suite or fullbuild needed for event guard.
8. Recovery: reversible local Git component; no session/draft/provider/runtime data changes or running-app restart.
9. Spend: zero/no installs or production changes. Routine existing-authorized local keyboard correction, not pending new authority/design implementation.
10. Next: genuine browser/IME/AT/responsive/full A4/B6 acceptance remains open; all21parents and pending A2/health/funding decisions preserved.
