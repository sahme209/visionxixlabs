# Desktop Release Verification — CRITICAL FINDINGS

**Date:** 2026-10-03
**Branch:** codex/workspace-integration-foundation
**Commit:** 9abf9b2e (Prepare secure desktop pairing update)
**Tag:** desktop-v0.1.12

## CRITICAL ISSUE 1: Published Releases Contain Wrong Binaries

### What Was Discovered
The v0.1.10 and v0.1.11 releases in the public GitHub releases repo contain **v0.1.9 binaries**, not the correct versions:

**v0.1.11 assets (should be 0.1.11, but are 0.1.9):**
- Axiom.Agent_0.1.9_aarch64.dmg
- Axiom.Agent_0.1.9_x64.dmg
- Axiom.Agent_0.1.9_x64-setup.exe
- Axiom.Agent_0.1.9_x64_en-US.msi
- Axiom.Agent_0.1.9_amd64.AppImage
- Axiom.Agent-0.1.9-1.x86_64.rpm
(+ .asc signatures for each)

**v0.1.10 assets (same problem - contain v0.1.9 binaries)**

### User Impact
**CRITICAL:** Any user who downloaded and installed from v0.1.10 or v0.1.11 release pages actually received v0.1.9 binaries. The version mismatch creates security and functionality risks.

### Root Cause Analysis
The Tauri build process is generating installer filenames with hardcoded or stale version numbers that don't match the desktop/package.json version. When the GitHub Actions workflow publishes these artifacts with `--clobber`, it uploads binaries with the wrong version string embedded in the filename.

**The workflow cannot distinguish between:**
- A correctly built v0.1.10 binary (filename: Axiom.Agent_0.1.10_aarch64.dmg)
- A misbuild that produces v0.1.9 binaries (filename: Axiom.Agent_0.1.9_aarch64.dmg)

**Result:** Wrong binaries get published under the right release tag.

---

## CRITICAL ISSUE 2: Current v0.1.12 Build Failed

### What Happened
- Tag `desktop-v0.1.12` was created 2026-10-03 02:14:47 UTC
- All 4 platform builds failed (macos-arm, macos-intel, windows-x64, linux-x64)
- Publish step skipped (expected when builds fail)
- No v0.1.12 binaries were created or published

### Why It Matters
If the build ever succeeds for v0.1.12, it will face the same filename/version mismatch issue as v0.1.10 and v0.1.11, risking incorrect binaries being published again.

---

## Recovery Required

### Phase 1: Diagnose the v0.1.12 Build Failure (IMMEDIATE)
1. Access GitHub Actions workflow run 37089120565
2. Review logs for all 4 failed platform builds
3. Identify the root cause (npm install, Tauri config, etc.)
4. Fix the build issue in code if needed

### Phase 2: Fix the Tauri Version Embedding Issue (URGENT)
1. Verify that Tauri is reading version from `desktop/package.json` during build
2. Check if Tauri is using a cached or hardcoded version
3. Ensure all version bumps propagate to Tauri build output
4. Add a build-time validation step to verify binary filenames match the intended release version

**Proposed fix approach:**
- Add a validation step in the workflow that verifies generated filenames match `desktop/package.json` version before publishing
- If versions mismatch, fail the publish step rather than uploading wrong binaries
- Example check:
  ```bash
  expected_version="0.1.12"
  for f in flat/*; do
    if [[ "$f" == *.dmg ]] || [[ "$f" == *.exe ]]; then
      if ! [[ "$f" == *"$expected_version"* ]]; then
        echo "ERROR: Asset $f does not contain version $expected_version"
        exit 1
      fi
    fi
  done
  ```

### Phase 3: Rebuild and Republish Correctly
1. Fix the v0.1.12 build issue
2. Add the version validation to the workflow
3. Trigger a fresh build (delete tag, recreate, or use workflow_dispatch)
4. Verify all assets have correct version numbers before publish completes
5. After publish: verify binaries contain correct code

### Phase 4: Consider Remediation for v0.1.10 / v0.1.11
- Decide whether to delete the misleading releases
- Document to users that v0.1.9, v0.1.10, and v0.1.11 release pages all contained v0.1.9 binaries
- Mark v0.1.9 as the "actual latest" until v0.1.12 publishes correctly

---

## Files Affected
- `.github/workflows/desktop-release.yml` — needs publish-time validation
- `desktop/src-tauri/tauri.conf.json` — verify version is correctly read during build
- `desktop/package.json` — ensure version updates propagate to all build outputs

## Testing Required After Fix
1. Trigger desktop-v0.1.12 build
2. Verify assets are named: `Axiom.Agent_0.1.12_aarch64.dmg`, etc.
3. Download and install from release page
4. Run `--version` or about dialog to confirm actual binary version is 0.1.12
5. Verify pairing works with corrected deviceFingerprint validation
