# Documentation contents composition Escape — local repair

The actual narrow Docs disclosure closed and moved focus out of its search input when Escape belonged to an active input method. Two new rendered tests reproduced it for native isComposing and keyCode229; six existing disclosure controls passed. The local repair adds only the existing app's native composition/keyCode229 earlyreturn before the ancestor Escape handler.

The same eight tests now pass. Each new case verifies panel openness, search focus, retained value and no default prevention during composition, then verifies a later ordinary Escape closes/restores focus and prevents default. Scoped TypeScript passes for the new test and transitive component source. Independent source/test review found no important issue. Removing only this guard restores the entire Git59fc component byte-for-byte.

These are synthetic DOM/key events, not real OS IME, browser, assistive technology, visual or current website acceptance. No full build, deploy, native restart or screenshot was performed. Existing previews remain older. Routing, search data, permissions, provider/financial code and stored sessions are unchanged. No dependency, external call, AI, database, credential, production setting or spending occurred. All21master parents and pending A2/health/funded-helper decisions remain open.
