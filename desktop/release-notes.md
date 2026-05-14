# Axiom Desktop · release notes

Honest changelog. Versions stay in `preview` until signing + notarization
land — there are no public binary distributions yet.

## 0.1.0 — preview · 2026-05-14

**Shell + foundation**
- Tauri 2 shell + React 19 + Vite frontend
- Sidebar nav: Dashboard / Handoffs / Connectors / Scans / Security / Settings
- Premium boot screen with branded loader
- `ConnectionBanner` only renders when not-healthy (offline / audit sync
  pending / update ready) — never noisy when fine

**Handoff inbox**
- Local typed inbox store via `localStorage` (Tauri plugin-store backing
  planned for 1.0)
- Lifecycle taxonomy matches `/lib/desktop/handoffLifecycle.ts` on the
  web side
- `canOpen` / `canApply` gates: open ✅, apply ❌ until approval flow ships
- Per-state CTA (Open & review / Run terraform plan / Retry audit sync)

**Security view**
- `defaultDesktopSecurityStatus()` returns 7 typed checks: pairing,
  version, code signing, audit sync, log redaction, local apply gate,
  handoff signer
- Q&A panel covers the 6 questions security teams ask

**Web bridge**
- `DesktopClient` wraps `/api/command-center`, `/api/aws/validate`,
  `/api/aws/scan`, `/api/security-scan`
- Honest disconnected state when no session — no fabricated data

## Roadmap

### 0.2.0 (target)
- Tauri plugin-store backing for inbox + session
- Macroservice probe (cli detection: terraform, aws, az, gcloud)
- Web-to-desktop handoff verification against the signed contract

### 0.5.0
- macOS notarization + Apple Developer ID signing
- Windows EV code signing
- Linux GPG-signed AppImage + .deb + .rpm

### 1.0.0
- Public signed binaries on the download page
- Auto-update via `tauri-plugin-updater`
- Enterprise workstation mode
