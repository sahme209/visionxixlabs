# Independent manual-story CI source review

2026-11-15. **CLEAR for the reviewed fixture migration; no remaining blocking source finding.** No tests, compiler/build, browser/driver, provider or product-source execution/change was performed by this reviewer. This review does not convert the failed prior CI job into a pass; fresh exact-head CI is still required.

## Interaction requirements retained meaningfully

The old homepage_playback predicate waited for a deliberately removed player. The new homepage_manual readiness uses the current tour and first enabled/current step. It is followed by a trusted pointer selection and an awaited actual React title change plus full code and aria-current assertions, so readiness is not accepted solely from SSR button presence.

The capture now verifies direct steps, bounded idle/offscreen/hidden-document state retention, sample approve/reject, decision clearing on step/context/story changes, current-story reset, context retention between stories, native branch keyboard reset and focused step-group Arrow/Home/End behavior with bounds. No removed Play/Pause/Replay/Next control is clicked. Explicit player absence and stable reduced-motion manual content match the selected product behavior; retention evidence is labeled manual state rather than claiming a timer was paused. Terraform still has no apply/sample-approval action.

The initial Product route-coverage concern is resolved in the final inspected source. Navigation waits for actual #deployment-model, a narrowly selected native summary opens it, and a pointer click on Unknown outcome waits for aria-pressed=true. The actual Product disclosure supplies product-mobile.png and is checked for horizontal overflow. Home still has its keyboard/manual checks and reduced-motion image. Six image identities remain bounded, with the one renamed reduced-motion image accurately describing Home.

## Guards and diagnostics

The Product control selection expands only to the exact named summary/Unknown outcome control under #deployment-model. Existing geometry checks still require a finite positive box inside the viewport and elementFromPoint ownership; no forced router navigation or DOM click replaces trusted pointer input. Documentation retains its settled pointer measurement, click/router-intent observations and actual destination/content assertion. Native consent behavior and owned background-target closure remain.

Capture and collector have matching finite manual control/interaction/evidence and phase values, while historical diagnostics remain compatible. Bounded six-field DOM snapshot sanitization remains; new evidence does not publish arbitrary code/HTML/URLs/credentials. Keeping historical player tokens in the collector is compatibility, not evidence that the new run performed playback: only completed current actions are pushed into its evidence list. Unknown tokens still redact.

No change was identified to the network/session/debug-channel policy, fixed browser driver selection, source/tool verification, process ownership, deadline or cleanup requirements in the inspected interaction delta. No native/security pins were blindly renewed. Ordinary new-head CI manifest preparation/review remains required; required jobs cannot be bypassed.

## Tests and limits

New tests exercise the real extracted readiness function against missing/disabled/nonbutton/noncurrent states and bounded diagnostics, and verify finite public interaction filtering. Existing DOM/pointer expectations were migrated rather than skipped. Parent reports the focused RED→GREEN and full owned-driver rerun; this reviewer did not execute tests or attest a not-yet-observed terminal run. The instant-scroll test correction should retain its nonzero/minimum occurrence assertion and verify every inspected scroll is instant, rather than depending on the obsolete exact count.

Actual isolated Chromium execution on the built PR head remains the proof for hydration, screenshots, trusted pointer navigation and owned cleanup. This source review establishes neither production/native/customer acceptance nor deployment authority. Preserve the original failed job and meaningful corrected test failures as history, then require green same-PR exact-head checks before normal merge.
