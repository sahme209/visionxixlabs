# Responsive website navigation focus repair

Existing mounted Navigation removed focused mobile/More menus on breakpoint changes without restoring focus. Two strengthened assertions reproduced that defect. The repair records focus ownership at resize and restores focus to the persistent home link after React closes the menu and removes the mobile header inert state. Focus outside the menu is preserved. Existing scroll-lock cleanup is retained.

Focused verification: `node scripts/run-vitest.mjs components/__tests__/navigationResponsiveMenu.test.ts` — 1 file, 4 tests PASS. No full build, browser, assistive-technology or native acceptance is claimed. No publishing or provider operations occurred.

The initial test invocation mistakenly supplied an extra `run` to the wrapper, selecting 67 files: 3 failed /56 passed /8 skipped, 7 failed /754 passed /166 skipped. Two failures reproduced the navigation defect; five further failures were in desktopFirstRunContract (four) and unimplementedStageRun (one). Their baseline status is unverified, so they are retained as unresolved results rather than asserted pre-existing or silently ignored. The raw output is preserved in initial-selection.log. No broad rerun was performed.
