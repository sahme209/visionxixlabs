# Axiom Desktop · security model

This is the honest current state of the desktop runtime's security model.
Anything not yet implemented is labelled `planned` rather than claimed
as a current control.

## Trust boundary

The desktop runtime is a privileged actor: it holds OS-keychain credentials,
runs local Terraform / CLI commands, and (when fully shipped) executes
approved plans. It never becomes a backdoor around the web platform's
governance.

## Hard rules encoded today

1. **No local execution bypasses web approval.** Approval lives on the web.
2. **No local execution bypasses policy.** Tenant policy is the gate.
3. **No secrets in desktop logs.** Canonical redaction runs on every log line.
4. **No unredacted handoff payloads.** Bundles pass through redaction.
5. **No unsigned production claims** until signing is implemented.
6. **Offline execution disabled by default** — audit sync is required.
7. **Local Terraform apply blocked** until the approval architecture ships.
8. **No audit bypass.** Local actions sync to the web audit store.
9. **No hidden desktop actions.** Every action is visible in the Audit Center.

## Handoff contract

Every web-to-desktop handoff is:

- HMAC-SHA256 signed over canonical JSON
- Single-use nonce (replay-protected)
- Time-bounded (≤ 1 hour TTL)
- Bound to tenant + user + execution plan + allowed operation
- Stripped of credentials, tokens, private keys

Validator refuses on: `version_mismatch` / `signature_invalid` /
`unknown_key` / `expired` / `replayed` / `tenant_mismatch` /
`user_mismatch` / `operation_not_allowed` / `missing_capability` /
`checksum_mismatch` / `malformed`.

See `lib/desktop/handoffContract.ts`, `lib/desktop/handoffSigner.ts`,
`lib/desktop/handoffValidator.ts`.

## Signing roadmap (planned)

| Platform | Mechanism | Status |
| --- | --- | --- |
| macOS | Apple Developer ID Application + `notarytool` | planned |
| Windows | EV Code Signing certificate | planned |
| Linux | GPG-signed AppImage + repo signing for `.deb` / `.rpm` | planned |

Until signed, the download page surfaces the preview state honestly — no
fake "signed build" claims.

## Local credential storage (planned)

| OS | Backend | Status |
| --- | --- | --- |
| macOS | Keychain via `keyring` crate | planned |
| Windows | Credential Manager via `keyring` crate | planned |
| Linux | Secret Service API (GNOME Keyring / KWallet) | planned |

## Reporting security concerns

`security@visionxixlabs.com`. We don't run a bug bounty yet — preview-state
honesty.
