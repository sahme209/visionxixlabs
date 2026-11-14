# Actual native publisher integration — four-file read proposal

Purpose: inspect the actual daemon constructor/startup/disruption and adjustment ordering before connecting the prepared adapter. The observed ShmWrite hook and individual Shm0 methods do not establish actual caller wiring; first Unknown can currently be skipped by an upstream conditional snapshot. No whole repository/archive/release search or pricing/account read is included.

Pinned official aws/clock-bound revision:371058f8f6a1786d4a4ab3eed9f5f2f16eea7777. Saved complete tree identifies exactly:

| Path | Git blob SHA1 | Bytes |
| --- | --- | ---: |
| clock-bound/src/daemon.rs | 44650a6306fc180bcf5279b81fb5404aefc6c6fb | 37992 |
| clock-bound/src/daemon/clock_state.rs | 0abef5835e44275920d1c397dae5e89f4b7a42da | 30558 |
| clock-bound/src/daemon/io.rs | 58fecfb0bc1a37d828be8ac6a9693766c9c1f207 | 35932 |
| clock-bound/src/daemon/clock_state/system_clock_discipliner.rs | d1563766e01cf48a5296de7179cb8cae8b5f8750 | 5842 |

Review questions, not claims about unread contents: daemon.rs startup/event/construction; clock_state.rs supplied Shm0 writer and initialize/disruption order; io.rs concrete writer supplier/resource plumbing; system_clock_discipliner.rs adjustment entry ordering. None is clearly removable without guessing; independent saved-tree review by handoff_design_review confirms exact identities and finite purpose.

Proposed conditional permission: prepare/test/independently review a fixed reader and exact packet, then one public HTTPS request per file at the pinned revision only. At most4requests,10seconds/256KiB each, no authentication/cookies/proxy/redirect/retry. Stop whole pass on any failure, mismatch or cancellation. Verify size/Git blob/SHA256, save public text only. No fetched-code execution, dependency adoption/install, native compilation/clock/filesystem/process test, cloud/account/credential/resource action, deployment, enablement or spending. Prior read grants remain consumed; no request runs before new owner consent.

These files can resolve constructor and publication/control ordering. They cannot by themselves qualify actual Linux ABI, filesystem/lifecycle/disruption, conservative clock/rate premises or the host. If further implementation is delegated, record exact gaps and stop rather than automatically reading a fifth file. Current local source preparation remains118focused+15demo/roottypesPASS with uncompiled C/Rust adapters. Source/build/native/resource decisions retain their applicable gates.
