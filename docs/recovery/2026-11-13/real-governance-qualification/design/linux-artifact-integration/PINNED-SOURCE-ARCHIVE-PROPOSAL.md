# One exact public source archive — conditional inspection proposal

Purpose: inspect the actual timestamp/bound origin and complete Cargo/main/build inputs in one pinned source inventory, rather than repeatedly requesting individual files. This does not authorize adopting/building/running the library. Governance requirements stay unchanged; a PostgreSQL wall-clock fallback would change the accepted UTC assurance and is not selected.

## Exact source and existing independent inventory

- Official AWS repository, immutable commit371058f8f6a1786d4a4ab3eed9f5f2f16eea7777.
- One unauthenticated URL: https://codeload.github.com/aws/clock-bound/tar.gz/371058f8f6a1786d4a4ab3eed9f5f2f16eea7777
- Already saved complete recursive Git tree6261c1659ff53ccec76cea26a3051fa680d9f676; truncated=false. Tree file: ../pinned-time-candidate-finite-read/PUBLIC-READ-2.txt; SHA256 dc5518ce9b96bce6fa4a59e468287c02f970f843bc722ea26567ccc04b4f8b2c.
- Exact inventory: 322 regular tracked blobs, 3751845 content bytes;413tree entries including directories, no symlinks/submodules/special files. Verify every retrieved regular file's Git blob SHA1 and size against this inventory, plus transport SHA256 of the archive. Do not invent/re-pin hashes to accept different contents.

## Conditional one-run procedure

After owner approval: prepare/test and independently review the small bounded acquisition/inspection procedure, then make one HTTPS archive request only if local checks pass. No authentication, proxies, cookies, redirects or automatic retry. Thirty-second network deadline,8MiB compressed cap,16MiB expanded cap, maximum1024archive entries and512-byte relative paths. Stop on any mismatch/error. Permission consumed by that one request, regardless of outcome.

No generic archive extraction: reject absolute/traversing/duplicate/unknown paths, links/devices/FIFOs/sparse entries, oversize data and missing/extra blob inventory. Only verified regular source bytes may be saved inside a fresh owned work directory; save them nonexecutable regardless of source executable mode. Never overwrite existing source, receipts or backups. Directory entries must be expected ancestors under the one exact archive root; archive root itself carries no identity. Preserve failed/incomplete observations without claiming a complete checkout.

Inspect verified source as text only for the timestamp/bound origin, precise anchor feasibility, native executable constructor, manifests/lock/dependency/build and licenses. No script/import/macro/build hook from fetched code may run. No package install, dependency resolution, compiler, native/clock/process query, credentials, account/API action, cloud resources, deployment, enablement or spending. The ordinary local reader tests use synthetic in-memory archives only.

## Required disposition

An archive that omits a Git-tracked export-ignored file is incomplete under this procedure and must stop; do not silently waive the inventory or restart with a second mechanism. A completed source inventory is only source evidence. Native premise guarantees still need a concrete implementation argument and separately authorized target qualification. This one source acquisition is not a fallback clock, real qualification or completed Governance.
