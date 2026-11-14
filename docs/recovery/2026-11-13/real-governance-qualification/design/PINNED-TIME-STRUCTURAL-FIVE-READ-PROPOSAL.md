# Five exact native-time structure reads — proposed conditional scope

Purpose: resolve only the unread native header/publication/writer branches required by the existing Linux evaluation design. The V2 payload and existing reader/sequence behavior are already saved in four-file-time-audit/PUBLIC-READ-1.txt and PUBLIC-READ-2.txt; do not read them again. No tag/release/tree listing, daemon-wide sweep or pricing/account request is included.

Pinned official AWS source repository: aws/clock-bound, commit371058f8f6a1786d4a4ab3eed9f5f2f16eea7777. The saved complete tree positively identifies these five regular blobs:

| Path | Git blob SHA1 | Exact bytes |
| --- | --- | ---: |
| clock-bound/src/shm/shm_header.rs | 02392ad46608739f0e42de99bef019c0663b1a35 | 11388 |
| clock-bound/src/shm/writer.rs | fae6b1c1a9e4bb386e09248c409c811318e59e71 | 31430 |
| clock-bound/src/daemon/clock_state/shm_writer.rs | 1bf2e2c54d5963a1878bed75446efdc06930d1e8 | 1411 |
| clock-bound/src/daemon/clock_state/shm_writer/shm0.rs | 7a16ca5ebbe42f5b4754ad80e24c90327c99e303 | 13511 |
| clock-bound/src/daemon/clock_state/shm_writer/shm1.rs | 8dba8a36fb082f08504b5ba8851ea5bdb3e8dc95 | 10094 |

Proposed conditional grant: prepare/test/independently review a fixed reader and frozen exact packet, then make one public HTTPS request per path at that commit only. Each request:10seconds/256KiB maximum, no authentication, cookies, proxy, redirects or retries. Stop the entire pass on failure, mismatch, cancellation or partial output. Verify exact byte count/Git blob and save public source plus SHA256 and a sanitized receipt. No executable download/run, compilation, dependency install, native clock/query, credential or AWS account access, resources, permissions, deployment, enablement or spending. The existing grants are consumed; no request may execute before new owner approval.

The branch meanings must come from inspected contents, never filenames. These files can establish header/writer encoding and dispatch, not all clock arithmetic premises. Specifically, coarse-clock quantization and whether elapsed time at the realtime sample is conservatively enclosed remain unresolved unless the source actually establishes them. No guessed error padding, native qualifier/default, library adoption, physical-dispatch guarantee or full Governance acceptance follows. After this fixed pass, report exact established facts and any remaining OS/arithmetic/target evidence instead of automatically expanding the traversal.
