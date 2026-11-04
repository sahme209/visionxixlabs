# Bounded download/update source audit

At sourcec47d13bd an independent source-only audit found no important defect in the inspected active download path. Whole files are listed with exact SHA256 in source-hashes.json. The website reports manifest signing and offers local verification; it does not establish local verification of downloaded bytes. autoUpdaterManifest has no active consumer in the inspected desktop/API source and automatic in-app updates are not configured. Unused logic was not treated as an active defect.

Partial source only: components/cockpit/DownloadContent.tsx lines1–150 plus search matches196–232,273–284. Workflow search matches only: .github/workflows/desktop-release.yml intervals23,54,185,247,274–308,313–323,355–370,413–462,479,519–632,692–805,824–851,883–996,1040–1052. Intervening workflow source was not fully reviewed. Test source search matches only: releaseManifest.test.ts11–49,60–81,92–107,119; downloadCustomerPath.test.ts13–16. These are scope descriptions, not whole-file review or test execution.

No network, downloaded installer, publication, native execution, browser, test or build operation occurred for this audit. This is not signing, clean-host, update integrity or complete supply-chain acceptance. A1/A5/A7 remain open.
