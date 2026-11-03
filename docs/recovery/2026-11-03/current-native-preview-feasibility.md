# Current local desktop preview feasibility

November 3, source/filesystem audit. No builds, UI actions, launch, restart, signing, keychain/security commands, credentials, provider/network or database operations. Only this report was written.

## Decision

A current embedded desktop preview is meaningful: compared with `567bb898`, HEAD changes 33 desktop files (726 additions/105 deletions), including genuine requester Agent execution/recovery, persisted execution-policy proposal/recovery UI, exact deployment baseline echo and updated Agent/AI-log presentation. These are desktop frontend changes, not merely website changes. Rebuilding its embedded frontend is justified. The only executable native-source delta is the Swift macOS10.15 availability/fail-closed fallback; Rust source is unchanged. Version files change0.1.21→0.1.22. This does not imply a new native Git credential implementation is present: those later changes are server-side.

An offline build is feasible to attempt from existing dependencies/toolchains. **A currently present, current-source, Developer-ID-signed app was not established.** Historical app paths cannot be blindly reused. No native visual acceptance or session restoration is claimed.

## Present tooling and absent historical artifacts

- `desktop/package.json:7-12`: build runs release alignment, TypeScript, Vite. `desktop/src-tauri/tauri.conf.json` embeds `../dist`, uses `com.visionxixlabs.axiom`, version0.1.22; no automatic backend build is part of this frontend script.
- Current `desktop/node_modules` and `desktop/src-tauri/target` exist. The local target has a53,530,400-byte debug `axiom-desktop` dated October31; no release binary/bundle exists there. Do not equate this cached executable with HEAD or a signed app.
- Supported Node `/Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node` exists. `/opt/homebrew/opt/node@24/bin/node` does not. Avoid inheriting an arbitrary default Node.
- Retained prior toolchain root exists at `/Users/samirahmed/Documents/Codex/2026-10-22/referenced-chatgpt-conversation-this-is-an/work/desktop-audit/toolchains`; both `cargo/bin/cargo` and `rustup` exist. Its sibling `axiom-cockpit/desktop/src-tauri/target/debug/axiom-desktop` exists, but its `debug/bundle/macos` directory is empty.
- Existing recipe `.../work/agent-identity-recovery/build-desktop-decision-sync-native.py:5-9` demonstrates the isolated environment, explicit cargo/rustup homes/target and `npm run tauri -- build --debug --bundles app`. Its archive/source assertions are tied to that old manifest; do not run it unchanged for HEAD.
- Current native `desktop/src-tauri/build.rs:4-13` invokes only local xcrun Swift compilation/archive/link preparation on macOS plus tauri-build. It uses deployment target10.15 by default.
- Historical October30 receipts `docs/recovery/2026-10-30/reviewed-local-package-receipt.json` and `apps-clarity-release-receipt.json` record signed/restored previews for9dfb316b/de9b630a. Their `/private/tmp/axiom-governance-preview-...` and `/private/tmp/axiom-apps-clarity-...` apps are absent now. `native-visible-preview.md`'s8c30 app is also absent. No later signed567 receipt was located in the current recovery docs.567 remains a supplied comparison reference, not newly verified runtime provenance.
- A process-name-only inventory returned no current Axiom executable. This is not proof sessions were deleted, nor permission to touch stores. Existing older `.app` directories were found under prior agent-identity-recovery work, but their existence alone proves neither current source nor usable signing/session identity.

## Concrete safe build recipe for a later authorized execution

Use a new private stage under `/private/tmp/axiom-current-desktop-<exact-head>-<random>/source`; create it from the exact tracked HEAD archive, verify the archive/hash and clean desktop source, and supply only existing locked local dependency directories. Do not include `.env`, saved sessions, browser data or keychain contents. Use its own output target, or copy an existing cache into a private target first; avoid modifying an old app's target/cache in place. Existing caches reduce cost but do not guarantee all needed crates are present.

Run the following **inside the stage**, with a minimal environment (HOME, fixed PATH, explicit local CARGO_HOME/RUSTUP_HOME/CARGO_TARGET_DIR, TMPDIR, CARGO_NET_OFFLINE=true only). Never inherit signing/private-key/provider/database variables:

```sh
# cwd: staged source/desktop; Node24 path first in the clean PATH
npm run build
# cwd: staged source/desktop/src-tauri
cargo build --locked --offline --features tauri/custom-protocol
```

This compiles actual embedded frontend/native bytes without installer publication or provider operations. If a crate/toolchain is missing, stop and report the offline blocker; do not fall back to downloads. Avoid `npm install`, `npm ci`, root Next build and all signing/notarization scripts. A later app-bundle build may use the existing Tauri recipe (`npm run tauri -- build --debug --bundles app`) with `CARGO_NET_OFFLINE=true` and a clean signing-free environment, after checking current CLI offline behavior locally; it is not a claim of Developer ID signing. Preserve exact stage, source hash, toolchain/dependency provenance, logs and executable hash.

The compile-only recipe does not itself create a verified signed launchable bundle. Before showing paired Samir's app, separately establish the intended bundle/signing provenance and make a new disposable app rather than replace any installed or reviewer app. No exact signing identity was inspected here; do not invent one or run a keychain search under this audit's restrictions.

## Session and activation invariants

`desktop/src-tauri/src/secure.rs:7-30` derives vault service from the immutable app identifier. `:47-68` can migrate a legacy plaintext store into that service and delete the old value. Thus opening a build is not a strictly storage-read-only operation. `credential_backend.rs:1-13` requires the native persistent backend, never mock fallback.

Keeping `com.visionxixlabs.axiom` is necessary for the same namespace, but not sufficient to guarantee access: signing designated requirement/identity and app-data/window-store locations also matter. A new identifier is appropriate for credential-isolated visual review, but intentionally **will not restore Samir's existing pairing**; do not describe it as session-preserving paired acceptance. Never copy/export vault entries or pairings between Samir/Fatima apps, change Fatima's identifier, clear stores, sign out, initiate new pairing or replace/restart the reviewer app. Confirm no unsaved form/action is being interrupted before any later main-app normal relaunch.

Use an embedded production frontend for an ordinary preview; `desktop/src/views/SettingsView.tsx` exposes Governance preview entries only under `import.meta.env.DEV`, and `GovernanceWorkspacePreview.tsx:4-13` labels the narrow lanes. Consequently a production build does not expose the new DEV execution-limits lane. A deliberate DEV-mode embedded preview would be a separate, explicitly labeled build decision; it must not point to an arbitrary dev server or enable server flags. Separate execution-policy activation is distinct from baseline enrollment; click neither during visual acceptance.

Baseline activation remains refused by `lib/governance/intelligence/requestService.ts:62-64,108-112,167` and `revisionStore.ts:38`. Preserve all provider/approval/execution restrictions and current paired identity. Showing the embedded app does not update its production backend: current server-only functionality can remain unavailable. Do not navigate to provider-reading views or click Load/Collect/Approve/Activate/Execute as a visual verification shortcut.

Next concrete action: prepare one exact current desktop stage and offline compile under existing authorization, then establish valid signed bundle provenance before a controlled paired-main-app show. The missing current signed-app evidence is a launch prerequisite, not justification to reuse stale temporary paths or reset sessions.
