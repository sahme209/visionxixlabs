# Download, brand and Outlook local follow-up

Public metadata checked October 30, 2026; no installer was rebuilt or downloaded:
- desktop-v0.1.21 Apple Silicon: 8,500,877 bytes.
- Intel Mac: 8,915,007 bytes.
- Windows MSI: 5,869,568 bytes.
- Linux AppImage: 85,170,680 bytes.

The live manifest does not currently advertise an 84 MB Mac installer. It does
advertise a substantially larger Linux package. This does not establish exactly
what the user saw previously. The local page now places each asset's own decimal
MB/kB size and filename beside its download link, with exact-byte tooltip. It
labels download size separately from installed footprint. Sixteen download-page
and customer-path tests passed, including distinct Mac/Linux size/link pairing.

Axiom uses Tauri/system webviews; packaging size alone is not feature quality.
References: https://v2.tauri.app/start/ and
https://www.electronjs.org/docs/latest/ . No claim is made about Cursor's exact
current binary size or its full internal architecture.

The live favicon/icon hashes match the existing canonical transparent white
triangle locally. Favicon SHA256:
1b77e225c53238689dd4911ef93b26267ad3e7c857b06ce9f9aea742aa46aee5.
Local metadata now uses content-versioned favicon, application-icon and Apple
icon URLs. The existing canonical brand generator maintains those URLs. No new
mark was invented, no installer icon bytes were rewritten, and this cache-key
change is not deployed yet. Generator syntax check passed.

Outlook was still implemented under Settings → Integration Center. Local Apps &
skills now has a searchable entry that explicitly opens those existing controls;
merely listing apps cannot launch consent, read mailbox contents or send anything.
Thirty-one catalog/Outlook-recovery checks, desktop types and frontend build pass.
No scope, credential, production setting or mailbox action changed.

The Releases view now places current next-step guidance before its action toolbar
and groups unrelated workflow observations in a read-only disclosure while keeping
its caveat visible. Broader stage navigation/whole-app polish and actual native
visual acceptance remain work to do. GitLab connector and GitLab sign-in are
recorded as separate planned capabilities, not implemented or enabled.
