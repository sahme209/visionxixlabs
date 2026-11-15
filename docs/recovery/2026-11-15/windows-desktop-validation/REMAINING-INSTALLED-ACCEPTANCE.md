# Remaining actual Windows acceptance

Read-only source review, November15. Run after corrected PR338 native checks pass; this is a plan, not evidence of installation. Current source is0.1.23; fresh public releases metadata confirms latest published desktop-v0.1.21. Website deployment cannot update that installer.

A disposable standard Windows runner can prepare exact-source unsigned validation-only MSI/NSIS candidates; record source, tools, versions, PE architecture, payload hashes and unsigned status before any install. No public release/signing/provider permissions are needed for that proposed test-only batch. Verify installed tools first; no new paid runner or security/UAC/SmartScreen bypass. Install each independently, launch actual WebView, verify signed-out UI/keyboard/light-dark/minimum960x600/tray/fullQuit/second-instance behavior, then uninstall exact recorded product. Preserve data rather than assuming removal; clean up only owned test state.

Windows Credential Manager needs a separately bounded synthetic test service/key, nonsecret sentinel, write then full process exit then separate-process read/delete/absence confirmation. Current tests verify backend selection only; the existing actual roundtrip is macOS-only/ignored. Actual vault persistence has not passed Windows acceptance.

The app has no automatic updater. Settings reads native installed version and opens canonical /download after a click. Verify actual browser handoff and manual installer upgrade only with exact old/new candidate provenance and synthetic preferences.

Real Google/browser approval/desktop activation/relaunch/sign-out-revocation needs genuine service and person evidence. Existing release endpoint/TLS/CSP/server verification cannot be silently replaced with localhost or fake credentials. Windows11 standard-user UAC/SmartScreen/trusted signature/real download/DPI/accessibility also remain genuine QA-host observations; administrator GitHub runner behavior cannot qualify them. A new qualified installer is required to ship current visuals.

No workflow, source, runner, credential-vault, package, signing or publication action is authorized by this document itself. User-directed ordinary release work and its exact reviewed bounds govern any later concrete batch. Governance remains disabled and behind these acceptance items.
