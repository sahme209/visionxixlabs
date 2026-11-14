# Build-only Rust compatibility — proposed finite correction

Status: design for owner review; no profile change/code/native action authorized by this document. The Cargo-only grant is consumed by run43607174394 at207cf145a15b87c07206027fc2e2f08511b3523a. Full Governance remains incomplete/disabled.

## Evidence and exact change

Actual bounded stderr now identifies a panic at `/rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/process.rs:2488:21`, EPERM. Matching cached Rust1.99.1 source calls `wait_with_output` → Unix `read_output` → `Pipe=FileDesc` → Linux `ioctl(FIONBIO)` for the two captured output pipes. The current filter omits FIONBIO. This is a concrete source-backed output-collection incompatibility; it is not the earlier pre-exec failure.

The earlier actual Rust probe separately showed ordinary spawn succeeds but a no-op pre_exec fails errno1. Cached source shows Linux fallback creates `socketpair(AF_UNIX, SOCK_SEQPACKET|SOCK_CLOEXEC, protocol0)`, then its parent reads an eight-byte exec-error record through `Socket::read`/`libc::recv(flags0)`; the child uses ordinary already-allowed write. Default create_pidfd is false. Cargo's full path remains unproven. A socketpair-only exception could leave this exact known handshake broken. No general sockets, addresses, pidfd or ancillary-message permission is justified.

Proposed build-profile changes ONLY:

1. Add literal FIONBIO to the existing ioctl selector allowlist. This toggles nonblocking mode on an already-held descriptor. Classic BPF does not prove descriptor type or pointer contents, so call this a selector permission, **not enforced pipe-only access**.
2. Admit socketpair only with full checked integer words: AF_UNIX, exact SOCK_SEQPACKET|SOCK_CLOEXEC, protocol0. No stream/datagram/non-CLOEXEC/extra flags/domain/protocol variants. Output-pointer validity remains the kernel's responsibility.
3. Admit the x86_64 recvfrom-style parent read only for exact eight-byte buffer length, flags0 and NULL source-address/source-length arguments (check full pointer/size words). This is the candidate kernel entry for libc recv; actual fixed tests must establish it. No sendto, sendmsg, recvmsg, socket, connect, bind, listen or accept is added. Failure never permits an alternative automatically.

The trusted launcher still closes inherited descriptors above2 and verifies0=/dev/null,1/2=owned pipes. Only the newly created anonymous pair can introduce a socket through this closed profile. There is no address-based socket creation/connection, no descriptor import via recvmsg/pidfd_getfd, and no process-group/session escape. The pair connects only its two locally created endpoints; it does not grant an external destination. This depends on the retained launch/FD context; BPF does **not** attest each descriptor's domain. File access/same-user isolation remains outside this build-only restriction, as before. No claim of production custodian protection follows.

## One conditional validation/build job, not piecemeal retries

After approval: implement/test the exact predicates, trusted fixtures and runner changes; independently review source and all packet inputs; verify current PR331 remote207cf145a15b87c07206027fc2e2f08511b3523a before one source transition. Use one new immutable packet, preserve every older packet/failed result, and run ONE free public standardUbuntu24.04 job,45minutes total with a shared bounded controller deadline. No manual dispatch/reopen, rerun, profile expansion, timeout extension or paid resource.

Within that one job, in order:

- Compile the trusted restriction launcher and C/Rust compatibility fixtures with existing installed tools/captured headers. Bind exact selected tool/std/core identities and every output/input. No Governance executable is launched.
- Run each trusted fixture once under the candidate profile. Require actual FIONBIO enable/disable on owned output pipes, exact local-pair/read success, and continued refusal of IPv4/IPv6/general Unix sockets, disallowed pair variants, non-null/wrong-size/wrong-flag receives, unknown ioctl/prctl, io_uring, pidfd_getfd, ptrace, namespaces and process-group/session changes. Negative tests must use no real external target or change.
  Do not attempt setsid in a new child or perform a valid group/session change: a faulty filter could then defeat original-group cleanup. Retained group/session denial must be checked from the actual captured filter program and safe invalid-argument probes where distinguishable; do not label the kernel's own group-leader EPERM as proof of filter enforcement.
- The Rust fixture must exercise captured stdout+stderr, successful no-op pre_exec and failed exec of a fixed absent owned path (the error handshake). Inspect/reap only actual owned children; keep external original-group cleanup/deadlines. No arbitrary command, new session or unsafe closure effects.
- Only after ALL fixture, currentness and cleanup checks pass, run the unchanged tiny standalone offline/locked Cargo compile ONCE. Preserve bounded known-path-redacted/JSON-escaped error evidence, exact source/lock/tool facts, and rlib hash if accepted. If it fails, stop before the full build.
- Only if that actual tiny compile passes and every original guard remains exact, perform ONE full pinned upstream daemon-feature C/Rust compile and nonrunning whole-library link, using the already verified licensed archive and original locked dependency graph. Only the fixed locked dependency acquisition phase may use network; no new package/toolchain selection, retry or runtime launch. Offline compiler subprocesses inherit the candidate profile. Retain all existing module/source/lock/tool/header/dead-code/symbol/no-undefined/ELF checks and original owned cleanup. No reduced cargo-check, fake policy or initializer is a replacement.

All stages share the single job budget; use explicit per-child deadlines/output caps and at most5seconds cleanup. A failure/unknown consumes this attempt and stops. It does not authorize another fixture, tiny compile or full build. No strace, administrator action, host setting, service, credentials, database/provider action, cloud resources, installation, signing, deployment, activation or spending. Existing mandatory exact-head CI still applies. Even a fully passing build is not real Governance/runtime/time/custody/people/provider qualification and does not enable it.

## Required owner decision

This explicitly changes the earlier all-socket-denied **build** boundary to allow only anonymous local child channels plus their restricted read, and FIONBIO. It also authorizes one new conditional native/build attempt after tests and independent review. Prior grants authorize neither. The suggested combined unit covers both already located standard-library requirements in one bounded job; unknown requirements remain stop conditions, not blanket permission.
