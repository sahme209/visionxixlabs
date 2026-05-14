# Axiom Desktop

The Axiom desktop runtime is a **local infrastructure operations
workstation**. It receives signed execution-plan handoffs from the web app,
lets the user review Terraform/CLI artifacts under local custody, and (with
future approval architecture) executes those plans against credentials the
user holds on the device.

The desktop app is **not** a way around web governance. Approvals, policy
decisions, audit, and rollback requirements are evaluated on the web before
a handoff is issued — the desktop runtime enforces those same constraints
locally.

## Stack decision: Tauri (locked)

| Concern                           | Tauri                                 | Electron                          |
| --------------------------------- | ------------------------------------- | --------------------------------- |
| Bundle size                       | 5–15 MB (uses OS webview)             | 80–150 MB (bundles Chromium)      |
| Memory footprint                  | ~80–150 MB                            | ~250–400 MB                       |
| Security posture                  | Capability-based, Rust core           | Node + remote module surface area |
| Native OS integration             | Keychain / keyring / notifications    | Possible via add-ons              |
| Code signing / notarization story | First-class CLI (`tauri signer`)      | Mature but more moving parts      |
| Auto-update                       | Built-in `tauri-plugin-updater`       | Squirrel / electron-updater       |
| Enterprise workstation fit        | Better — smaller attack surface       | Heavier, more dependencies        |

**Decision:** Tauri 2 with React 19 + Vite for the frontend, Rust for the
backend (`src-tauri`). Confirmed by:

- The existing scaffold at `desktop/src-tauri` (Cargo + tauri.conf.json
  already present) — the choice has been the working assumption for
  several phases already.
- Smaller binaries materially improve the enterprise download story (one
  of the trust signals we measure in the Security Center).
- The Rust core gives us a path to local Terraform CLI execution that
  Node-based Electron would have to shell out for anyway.

Electron is **not** an option going forward. If a feature genuinely
needs it (e.g. a vendor SDK that only ships Node bindings), that's a
single-PR conversation — not a stack switch.

## Folder layout

```
desktop/
├── src/                  # React 19 + Vite frontend
│   ├── App.tsx           # Shell + view switcher
│   ├── components/       # Sidebar, status panels, etc.
│   ├── views/            # Dashboard / Connectors / Scans / Settings / Handoffs
│   └── styles.css        # Tailwind + Axiom tokens
├── src-tauri/            # Rust backend
│   ├── src/              # Tauri command handlers
│   ├── Cargo.toml
│   ├── tauri.conf.json   # Window, security, identifier
│   └── icons/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

The shared TypeScript domain layer (`/lib/domain`, `/lib/desktop`,
`/lib/errors`, `/lib/security/redaction`) lives in the parent Next.js
project. The desktop imports those types directly — there is no
duplicated taxonomy.

## Packaging roadmap

### macOS

- Target: `.dmg` (universal binary — arm64 + x86_64)
- Signing: Apple Developer ID Application certificate (planned)
- Notarization: `notarytool` in CI (planned)
- Secret storage: macOS Keychain via `keyring` crate (planned)

### Windows

- Target: `.msi` (preferred) + `.exe` (NSIS fallback)
- Signing: EV Code Signing certificate (planned)
- Secret storage: Windows Credential Manager via `keyring` crate (planned)

### Linux

- Target: AppImage (primary) + `.deb` (Ubuntu/Debian) + `.rpm` (Fedora)
- Signing: GPG-signed AppImage + repo signing for `.deb`/`.rpm` (planned)
- Secret storage: Secret Service API (libsecret / GNOME Keyring) (planned)

### Cross-platform

- Auto-update: `tauri-plugin-updater` (built-in). Update manifest signed;
  client refuses unsigned updates.
- Release channels: `stable` (default), `beta`, `preview`.
- Crash reporting: TBD — *not* shipping a third-party telemetry SDK
  until the data-flow is privacy-reviewed.
- Local log redaction: every log line passes through
  `lib/security/redaction` before write.
- Enterprise deployment: macOS PKG installer + Windows MSI Group Policy
  template (planned, post-1.0).

## Honest current state

| Capability                       | Status     |
| -------------------------------- | ---------- |
| Tauri shell + React frontend     | Live       |
| Sidebar nav + Dashboard view     | Live       |
| Connectors/Scans/Settings stubs  | Live       |
| Handoff inbox UI                 | Preview    |
| Local Terraform review           | Preview    |
| Local CLI preview                | Preview    |
| Local execution (apply)          | **Blocked by design** until approval architecture lands |
| Audit sync to web                | Preview    |
| OS keychain integration          | Planned    |
| Code signing / notarization      | Planned    |
| Auto-update channel              | Planned    |
| Crash reporting                  | Planned    |

The download page reflects this state honestly — there are no fake
download buttons for binaries that don't exist yet.

## Security guarantees

1. No local execution bypasses web approval.
2. No local execution bypasses governance policy.
3. No secrets in desktop logs (canonical redaction runs on every log line).
4. Handoff payloads are redacted before display.
5. No unsigned production claims until signing is implemented.
6. Offline execution is disabled by default; enable per-tenant via policy.
7. Local Terraform `apply` is blocked until the approval architecture
   ships.
8. Every desktop action is captured in the local audit log and synced to
   the web audit store.

## Development

```bash
cd desktop
npm install
npm run tauri dev
```

`npm run tauri build` produces an unsigned binary for the host platform.
Signed-release builds are produced by CI only.
