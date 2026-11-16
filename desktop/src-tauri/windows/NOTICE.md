# Tauri NSIS installer template attribution

`installer.nsi` is derived from the Tauri project, tag **tauri-cli-v2.12.4**:
https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

Copyright (c) 2017 - Present Tauri Apps Contributors.

Tauri is offered under Apache-2.0 OR MIT. For this copied template we choose the **MIT license**. The complete, unmodified upstream MIT text and copyright notice are retained in [LICENSE.tauri](LICENSE.tauri), obtained from:
https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.12.4/LICENSE-MIT

Local modifications preserve V19 display branding while retaining the historical Axiom Agent internal NSIS registry keys and accepting the historical or current MSI display name with the same publisher during existing-install detection. Owned legacy shortcuts are now migrated before update/no-shortcut early returns, foreign links or destination collisions refuse without overwrite, and uninstall removes legacy links only after the existing exact-target ownership check. These additions reuse bundled Tauri macros; actual Windows acceptance remains required. Exact upstream template hash, source provenance and the reverse-patch regression are documented under `docs/recovery/2026-11-15/v19-windows-identity/`.

This attribution and license apply to the copied Tauri template; they do not change the license of other project files.

The MSI main.wxs template is also derived from Tauri CLI2.12.4 (MIT choice),
crates/tauri-bundler/src/bundle/windows/msi/main.wxs. Changes add legacy install
location fallbacks, remove the shortcut-upgrade exclusion for future packages,
and embed original ownership-aware rollback/commit legacy shortcut actions.
The companion msi-shortcut-migration.vbs is original project source for those
inline actions; it is not a separately installed runtime/package dependency.
