## Root activation for the original PR

The source below was independently reviewed and enrolled for the credential-free standard Windows job on PR339. Recipe flags are now true and the job requires the existing Windows-native checks. The earlier closed-preparation checkpoints below are historical. Actual installer/upgrade results remain pending; no Vercel, signing, publication or production action is authorized by this test. The exact source manifest is regenerated after this note.

# V19 Windows QA — complete source preparation, execution still closed

Essential controller integration is now implemented, not left as a list of plans. No native, installer, PowerShell, GHA, provider or Vercel action was executed. One fixed public historical NSIS file was downloaded solely for hash/PE-header inspection, with no execution. This isolated checkout uses a historical product base: apply the reviewed QA files to the current validated authoring branch and generate its complete source manifest before any execution. Do not run this historical checkout as the current product.

The existing desktop-ci workflow contains a CLOSED premerge candidate job. Its false gate, BUNDLER_RECIPE_REVIEWED=false and UPGRADE_RECIPE_REVIEWED=false must remain until final independent setup/source review. UPGRADE_CYCLES_INTEGRATED=true records implemented wiring, not execution authority. Source custody is exact PR339/public repo1130181785/owner+actor/branch/base/first attempt, explicit actual PR-head checkout rather than merge SHA, whole-file manifest excluding only itself, runtime manifest digest and repeated source equality checks. This is ordinary trusted credential-free QA, expressly not external human-approval/Governance proof. No production release workflow is changed; the old standalone dispatch file remains disabled and is superseded for premerge use.

## Fixed actual controller flow

After existing managed-tool/version/source/WebView checks, build locked actual unsigned candidates and inspect their metadata. The fixed Python acquisition child downloads ONLY the two public0.1.21 assets below through HTTPS allowlisted GitHub/CDN redirects, bounded by the existing process owner120second phase. It checks exact byte size/SHA256 before atomic promotion and emits fixed metadata only. No token, account or provider credential is used. Actual legacy metadata must match product/version and explicit artifact role: MSI package x64, NSIS installer stub I386; the installed application payload is separately required AMD64 and compared to its expected hash. The public historical NSIS hash was independently downloaded/read-only parsed and confirms PE0x14c, without executing it; this never proves the packed payload architecture. Pinned2.12.4 requires x86 Unicode stubs. old MSI UpgradeCode must match source-derived a3c7da37-1792-51f2-8b3a-8848b1b33f88 before any install. Public asset hashes are QA custody, not signature/distribution acceptance. Current candidates remain explicitly unsigned; legacy metadata accepts only actual Valid or NotSigned status, never a bad-signature state.

A bounded read-only PowerShell collector establishes no preexisting Axiom/V19 registration, known shortcuts, protocol or owner-scoped payload before any installer. Native argument binding uses scalar named parameters, not unsupported PowerShell -File array arguments. It inventories only known old/current shortcut locations, at most two known MSI codes, fixed protocol keys and owner-scoped PE files. Protocol strings pass the existing real CommandLineToArgvW guard. Source and artifact hashes are rechecked before each attempt.

The controller performs clean candidate MSI/NSIS cycles, then FIVE actual fixed upgrade cycles:

1. Pinned0.1.21 MSI → candidate MSI major upgrade in one fresh owned directory.
2. Pinned0.1.21 NSIS → candidate silent normal upgrade.
3. Pinned0.1.21 NSIS → candidate /UPDATE.
4. Owned old NSIS install, change ONLY its verified owned desktop legacy shortcut into a synthetic foreign-target fixture, run candidate /UPDATE, require exit2 and unchanged foreign shortcut through candidate refusal AND uninstall.
5. Owned old NSIS install, create a synthetic foreign current-name desktop shortcut only when absent, run candidate /UPDATE, require exit2 and preservation through refusal AND uninstall.

Positive cycles require one V19 product/version/publisher, exact candidate installed payload SHA256/version/AMD64, exact app+%1 protocol, V19 shortcuts to the exact candidate/no arguments, no legacy shortcuts or parallel products, then an owned visible top-level window. This is not rendered WebView or authenticated acceptance. Collision fixture cleanup removes only its original same-hash synthetic link with the exact owner-scoped synthetic foreign target; it never removes another link to make acceptance pass.

Finally, each armed cycle attempts uninstall even after candidate failure: only its preflight-absent actual old/new MSI ProductCodes, or its unchanged owner-scoped NSIS uninstaller with _?=. Installer partial-state failures cannot return an accepted receipt. Exact product/protocol/shortcut/payload absence, owned directory emptiness and process Job cleanup are required. Uninstaller failure/missing partial uninstaller yields cleanup failure, not a broad delete. All cycles share the original2100second execution deadline/42minute outer job and existing output caps. Cleanup may use the existing125second terminal installer reserve; after it crosses the shared deadline the next ordinary phase immediately refuses, so repeated cycles cannot accumulate execution extensions. Final synthetic-vault cleanup retains its separate65second reserve. A canceled GitHub run is not acceptance or cleanup evidence; managed VM disposal is not reported as an observed uninstall.

## Reviewed shortcut source

The exact custom NSIS template incorporates independently reviewed target-owned legacy rename before UPDATE/no-shortcut early returns, foreign-link refusal, absent-destination collision checks, fixed nonzero failure and exact-target-guarded legacy uninstall deletion. It reuses pinned bundled macros only. Runtime template SHA must match this reviewed file; arbitrary custom templates/hooks remain refused. Source-only review is CLEAR. Limits remain: NSIS actions are nontransactional; a late collision may leave earlier owned changes and must pass partial cleanup. Ownership checks compare target paths, not every shortcut metadata field. The bundled AppUserModelId setter does not verify its COM result. Actual Windows compilation and all five cycles are still required.

## Fixed historical bytes

One public GitHub metadata response records release428415966/tag desktop-v0.1.21. That initial metadata pass downloaded no binaries; the later explicitly authorized NSIS hash/PE inspection is recorded separately in NSIS-STUB-READONLY-INSPECTION.json:

- NSIS689968076, Axiom.Agent_0.1.21_x64-setup.exe,4023071bytes,SHA2560d80407c333229d54c9cd3d0f205b99e1944f0622f4da556b02a299eaad893f3.
- MSI689968206, Axiom.Agent_0.1.21_x64_en-US.msi,5869568bytes,SHA256670a2b926e7e3f9f0d3a2893b4997867101f1710699b4bc3734e2baac4bd98e1.

Actual old binary GUID/signatures remain uninspected until future host metadata. The source-derived GUID is never relabeled binary-verified before then.

## Still genuine acceptance gates

The GUI maintenance-page “don't uninstall” choice is NOT impersonated by a fictional CLI flag. /UPDATE/normal silent paths are automated, but genuine GUI selection remains open. Standard-user Windows11/UAC/SmartScreen, visible WebView/DPI/keyboard/theme/tray, real Google/session/vault/relaunch/sign-out, signed distribution, final public installer trust and uninstall data retention also remain open. completeWindowsInstalledAcceptance remains false. No Governance program runs or becomes enabled. Root must independently review/apply this exact source and qualify actual Windows results before closing installer readiness or merging on that basis.

QA checkout alone supplies GIT_CONFIG_COUNT=1/core.autocrlf=false so raw-LF source is preserved without changing repository/global settings or other native jobs. The complete byte manifest still verifies actual checkout contents. Required manifest members name desktop-ci and every runtime controller/helper; the unused standalone dispatch file was removed from this preparation and is not required or applied.
