# Final saved source inventory — independent review

Reviewed the saved output at `work/pinned-clock-bound-371058f8-archive-inspection-1/source` using read-only metadata/content hashing, without importing, executing, compiling or running any downloaded source. No network request or reader rerun occurred.

## Independent result: inventory clear

The saved recursive tree `pinned-time-candidate-finite-read/PUBLIC-READ-2.txt` independently matches SHA256 `dc5518ce9b96bce6fa4a59e468287c02f970f843bc722ea26567ccc04b4f8b2c`. Compared every saved file against that exact tree:

- **322/322 regular files**, **3,751,845 content bytes**; every byte length and Git blob SHA1 (`blob <size>\0<content>`) matches.
- Exact directory inventory: **91 tree directories plus the source root =92**. No extra/missing files or directories; no symlinks or special filesystem entries.
- All322 files are current-user-owned mode **0600**; all92 directories are current-user-owned mode **0700**. Upstream executable modes were not installed as executable permissions.

`RESULT.json` reports `complete:true`, `requestConsumed:true`,322 files and3,751,845 source bytes, consistent with the independent saved-content check. It reports1,562,745 compressed bytes and archive SHA256 `d2ede954fe4631785c9457ddc100fdfa1c3252a47410432e250317f24402494f`; those transport observations are from the root's acquisition receipt, not a second request or independently recomputed compressed archive in this review. The complete saved source inventory is independently verified against the earlier pinned tree. The approved one-request allowance remains consumed regardless of this successful review.

## Exact version and attribution scope

Saved root `Cargo.toml` `[workspace.package]` fixes **3.0.0-rc.0**, edition2024. `clock-bound/Cargo.toml` inherits that workspace version and declares **MIT OR Apache-2.0**. This establishes the pinned candidate's manifest version, not a stable release, maintained/supported binary, dependency selection or adoption approval.

Root `README.md` License section states the two alternative licenses. The actual saved core texts are `clock-bound/LICENSE.MIT` and `clock-bound/LICENSE.Apache-2.0`; the MIT file includes Amazon's copyright and requires retaining its copyright/permission notice in copies or substantial portions. Preserve both original texts and source attribution in any later reviewed materialization; record modifications as required by the selected license/distribution path. The archive also contains separate `clock-bound-ffi/LICENSE` and `clock-bound-ffi/NOTICE`, the latter naming clock-bound-ffi and Amazon copyright, plus ff-tester and example license files. Do not erase those notices or assume the core crate's SPDX field alone resolves every component/dependency's distribution obligations. No complete third-party dependency/license or build-provenance audit is claimed here.

## Limits

No important inventory discrepancy found. Verified source availability is not native compilation/linkage, dependency resolution, actual daemon/initializer wiring, ABI/OS support, clock accuracy/growth, lifecycle/disruption/custody/fleet qualification, credentials, genuine human/provider acceptance, spending authority or completed Governance. All actual execution/installation/resource/provider/production gates remain separate; the source stays nonexecutable inspection material.
