# Axiom v0.1.21 Microsoft Store MSIX preparation

Status: local preparation only, not a built/signed/submitted or installation-tested MSIX. The existing website MSI and immutable release remain unchanged.

Microsoft's free signing applies to Store MSIX submissions. It does not Authenticode-sign our existing downloadable MSI. A self-signed certificate is not a public-trust solution. No new certificate, trial, paid service or publisher registration was created.

## Prepare on macOS or Windows

1. Obtain the actual reserved package Name, Publisher and display labels from the authorized Partner Center account. Copy the example JSON outside the source and replace every placeholder. Do not invent a publisher ID or use customer credentials.
2. Run `node scripts/prepare-store-msix.mjs <identity.json> <new-layout-directory>` from the repository root. It validates identity/labels and writes AppxManifest.xml plus the existing Axiom Store/44/150 icons. Reusing an output directory is refused.
3. Add a separately verified Windows x64 `axiom-desktop.exe` and its required runtime files from the exact reviewed candidate. Record source commit, candidate run and SHA256 inventory before packing. This preparation deliberately contains no executable and is not proof of source binding.
4. On Windows with the official Windows SDK, validate/pack the complete layout using `MakeAppx.exe pack /d <layout> /p <new-output.msix>`. Do not use `/nv`, replace published assets, install a trusted-root certificate or disable SmartScreen. No CI run is authorized by these instructions.
5. Perform Windows App Certification Kit and Store validation. Confirm WebView2 availability on supported Windows versions, full-trust capability justification, startup, deep-link `axiom-agent` pairing, secure credential persistence after full process exit/relaunch, sign-out/revocation, upgrade from MSI, and uninstall behavior. MSI-to-Store migration and vault continuity must be demonstrated, not assumed.
6. Submit only after separate human publication approval and actual clean-Windows acceptance. Store certification/signing is external and cannot be claimed completed locally. Keep website MSI signing claims unchanged until a separately approved trusted signing path exists.

The manifest declares only the full-trust desktop capability required for this existing Win32 app and its existing pairing protocol. It adds no administrator elevation, background task, broad file access or messaging grant. Store certification may require further changes; those require review.

Sources checked October 29, 2026:
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/code-signing-options
- https://learn.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion

## Acceptance still required

Use a Windows machine without an existing Axiom install/session. Record OS build, exact installer SHA256/source, install result, first sign-in, full quit/relaunch and session persistence, explicit logout/revocation and upgrade behavior. Record statuses without passwords, session tokens, browser codes or screenshots of credentials. Mac/Node/unit checks cannot satisfy this gate.
