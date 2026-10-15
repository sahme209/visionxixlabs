# Website privacy-choice validation

The existing Privacy choices control remains the way to reopen the banner.
Optional measurement still requires an explicit accepted choice. Browser storage
failures now leave that control usable; local storage and the existing secure
cookie are attempted independently. If the preference cannot be retained, the UI explains that essential features
remain available and offers Continue in this tab. A fresh visit asks again
when no stored decision is available.

An essential-only decision in either persistence channel takes precedence over
an older stored grant. This lets a cookie preserve withdrawal when a full or
blocked local-storage write leaves the previous accepted value in place.
Conflicting stored choices are resolved conservatively. No server-side account,
session, credential or billing preference is changed.

A storage event synchronizes another tab's change. A saved refusal is also
checked at dispatch because cookie-only withdrawal emits no storage event. The supported Analytics
beforeSend hook reads the current decision for each event, including callbacks
captured before withdrawal. Unmounting the privacy governor also closes that
filter. This controls future callbacks; already transmitted telemetry cannot be
recalled by a client preference change.

Evidence: real React DOM tests reproduce four failures in the former component,
including two uncaught storage errors. Thirteen cases cover initial opt-in,
blocked reads/writes, cookie fallback, conflicting saved choices, cookie-only/cross-tab
withdrawal, captured callbacks, unmount cleanup and the existing reopening UI.
Analytics is mocked and storage faults are injected through browser APIs;
React hooks and DOM rendering are real. The existing source contract
assertion now checks the beforeSend prop as well as the opt-in mount condition.
No test exclusions were added.

Pinned development-only test tools are @testing-library/react 16.3.3 and jsdom
30.1.3. Use current Node 24 (jsdom supports >=24.15 in that line), matching web
CI. Production dependencies are unchanged and their registry audit is zero.
The broader audit has nine existing development-tool package findings (seven
high, two moderate), the same advisory package set before/after these tools.
See [development audit](mission/development-dependency-audit.json). Compatible
upstream remediation and separately validated build-tool migration remain open.

Actual Safari/Firefox/Chrome storage policies, multi-tab network captures,
keyboard/focus, responsive screenshots and provider delivery still require
browser acceptance. DOM policy tests do not certify privacy compliance or
native/macOS behavior. No production database, credential, billing or domain
configuration is changed by this work.

Local validation: 539 Vitest files / 5,338 tests, targeted privacy lint, web and
desktop TypeScript, desktop frontend build, 30 Python CLI tests, full Next
production build and mission register check pass. Exact-head CI and automatic
deployment evidence are recorded in the focused PR.
