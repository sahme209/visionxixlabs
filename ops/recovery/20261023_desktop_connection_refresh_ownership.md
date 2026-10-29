# Desktop connection refresh ownership

Two regressions reproduced an unhandled status rejection that left refresh busy and a credential-context change that did not reload connection status. A third regression reproduced an indefinitely pending transport. Connection status now has a fifteen-second local wait deadline, a visible safe failure/retry state, independent partial-result handling and a current request/context/mount check. The deadline ends the UI wait; it does not certify cancellation of the service request.

A changed desktop credential context clears old connection status, diagnostics, notes and busy flags and reloads the current workspace. Validation and OAuth-start results are context/epoch-owned. Late results cannot display verification for another workspace or open its consent URL. New connection actions require status verified for the current context. Consent destinations reject userinfo, unexpected ports and non-allowlisted provider hosts. Backend authorization remains authoritative; these UI checks do not grant access.

Seven component regressions plus sixteen existing model-settings cases pass using fixed mocked service responses. No provider authorization, paid inference or credential write was performed. Independent review of the context/action ownership found no blocker before the final local-wait deadline case was added. Provider acceptance and native visual acceptance remain separately recorded.

Static provider assets now use the desktop bundler's literal new URL(..., import.meta.url) form so a clean root typecheck does not depend on absent ambient SVG declarations. The earlier exact archive caught that packaging issue; source hashes and builds must pass on the corrected archive before release.
