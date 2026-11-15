# Windows qualification gap — owner follow-up

Owner explicitly asked on November15 whether Windows is tested because desktop will run there. Windows is required for release readiness; prior deferred Store/Windows status is not product acceptance.

## Current verified coverage

PR337 headc36dbc356c332d7d05be2c35b9328d9c5a18551e has10applicable checksPASS; merge6358f1363f5d4a2f811cc89a1b92ee58aa4a6068 has8applicable checksPASS. These include Linux and macOS desktop native unit tests/lint/frontend compilation. The separate successful Governance compiler test is Linux-only and never runs Governance outputs.

.github/workflows/desktop-ci.yml has Ubuntu and macOS jobs, no Windows job. desktop-release.yml has a Windows packaging target; defining a target does not prove this source was tested or installed on Windows. No Windows test/installer/run was performed in this follow-up.

Windows native keyring backend is configured in desktop/src-tauri/Cargo.toml. Some capabilities are intentionally unavailable: non-Unix repository_create returns an unavailable error; selected-window observation/input and owner-authority clock/nonce providers are macOS-only and refuse elsewhere. These are real coverage/support gaps; do not enable unsupported functions or claim feature parity.

## Next coherent validation sequence

1. Prepare and independently review Windows CI for the exact current source: frontend identity/type/build, locked native Cargo test and clippy on an actual Windows runner. Audit platform test-fixture paths/process tools and cfg guards first. Preserve refusal behavior, security assertions and synthetic-only fixtures. No credentials/signing/publication or installer launch in this first unit.
2. Use a separate explicit bounded Windows runner decision before new native compile/test execution; the consumed Linux compiler grant does not cover Windows. Do not dispatch the release workflow to obtain test coverage because it has separate candidate/signing/export/publication effects.
3. After actual Windows build/native tests pass, separately qualify the installer on clean Windows: install/launch, WebView availability, Google/GitHub/Cognito return/deep links, session persistence in Windows credential storage, sign-out/revocation, upgrade/uninstall and recovery. Actual sign-in uses separately approved test accounts; no credentials or provider effects inferred from compiler tests.
4. Verify visual layout/navigation/keyboard/focus/scroll and both themes in actual Windows app. Track unsupported automation/file-creation capabilities openly until secure Windows implementations and tests exist.
5. Microsoft signing/Store certification and signed public installer publication remain separate release gates.

No new Windows workflow/source implementation, host access, package install, build, credentials, deployment, publication, enablement or spending occurred here. Continue the original full goal and preserve existing private production/Governance gates.
