# Axiom Desktop · release notes

Historical preview notes follow. Published installers and their exact source must
be inspected separately; a source change does not update an existing installer.

## Unreleased source — reviewed native release candidates

Tag builds and manual dispatches create private, source-bound candidate artifacts
without publishing. Publication additionally requires the explicit `publish`
input, `AXIOM_DESKTOP_PUBLICATION_READY=true`, the `desktop-release` environment,
and the reviewed `AXIOM_DESKTOP_PUBLIC_KEY_FINGERPRINT`. Environment reviewers and
operator approval settings remain unverified; naming an environment or setting a
variable does not itself establish independent approval.

Candidates bind the actual checkout, run, version, platform and installer/SBOM
hashes. Publication consumes the exact verified artifact ID, checks unchanged
bytes, verifies detached signatures against the intended published public key,
claims a new public tag exclusively and verifies uploaded asset hashes before
publishing that exact new draft. Existing tags or releases are refused, including
partial failed attempts; recovery requires a separately reviewed decision. The
public artifact tag refers to public repository history; the manifest separately
records the private source commit.

Public `desktop-v0.1.20` remains unchanged. These controls do not prove installer
embedded metadata, clean-host installation, native credential persistence or
browser pairing on a physical host. macOS build app signing checks do not replace
packaged installer acceptance. The macOS downloadable-artifact notarization flag
remains false until packaged app identity/ticket verification exists, so the
website must not treat a future candidate as notarization-verified. Windows installers remain unsigned by
Authenticode; Linux assets have detached signatures. Automatic in-app updates
remain unavailable; use reviewed manual installation. No release dispatch,
publication or native host acceptance is recorded by this source change.

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

### Source-only billing status presentation correction (2026-10-16)

Plan & usage reports `no_plan` as **No subscription**, separately from identity
sign-in. The legacy `trial` tier alone no longer implies an approved trial;
no-charge trial/pilot labels require their explicit supported billing status.
Existing identity-only access policy, raw legacy paid tier names, credit pools
and subscription authority remain unchanged. Component tests exercise the real
no-plan DTO and preserve explicit trial/pilot presentation. This is not paid
checkout, credit reconciliation or native installer acceptance.
