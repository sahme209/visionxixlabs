# One unchanged-profile Rust spawn diagnostic

Status: PROPOSAL ONLY. No code, workflow, profile, compiler, native invocation or external read is changed/run by this document. The direct-object compiler attempt at head010444b7, run43560429085, is consumed; no retry is implied.

## Observed failure and local source evidence

Actual restriction fixture and C compilation passed. The Rust phase reported that rustc processes for proc-macro2, unicode-ident, libc and quote were `(never executed)` with `Operation not permitted (os error1)`. This identifies failure during process launch, not an upstream Rust type-check result or proven missing syscall. The existing C fork/exec fixture does not reproduce Rust std's launch machinery.

Already installed source inspected as inert text:

`/opt/homebrew/Cellar/rust/1.99.1/lib/rustlib/src/rust/library/library/std/src/sys/process/unix/unix.rs`

-55–75: Command.spawn configures stdio and first tries posix_spawn.
-77–78: on the Linux fallback path, `Socket::new_pair(AF_UNIX, SOCK_SEQPACKET)?` occurs BEFORE fork. Failure here returns without executing the requested child.
-467–476: configured pre_exec closures (among other conditions) make posix_spawn returnNone, selecting that fallback.

`/opt/homebrew/Cellar/rust/1.99.1/lib/rustlib/src/rust/library/library/std/src/sys/process/unix/common/tests.rs:78–80` explicitly uses pre_exec to force the fork/exec path.

The unchanged profile denies socketpair, so this inspected implementation would refuse at that prerequisite. This is a concrete hypothesis matching the error class, NOT proof of the CI failure. The retained actual log reports rustc1.99.1 (58cf8f9c3 2026-10-13) and cargo1.99.1 (5f94df478 2026-08-27), matching the cached source's release number. Exact Linux stdlib source/build correspondence and Cargo's actual choice of spawn path remain unverified. No cached Cargo/jobserver source was found. Do not claim Cargo definitely installs a pre_exec closure or that permitting socketpair alone would fix subsequent handshake operations.

## Selected finite experiment

Prepare a fixed dependency-free Rust fixture using ONLY std. Compile it once with the runner's already installed exact rustc, outside the child filter because the diagnostic is precisely about spawning tools inside that filter. No Cargo, registry, downloaded crate or build script is needed to compile this fixture; the separate tiny Cargo comparison below is explicitly included. Freeze fixture source/compiler/launcher/profile/tool hashes and independently review before execution.

Run the fixture ONCE through the SAME unchanged network_launcher/filter. It performs these two operations in a fixed order, without retry:

1. Ordinary `Command::new` using one frozen absolute harmless installed tool (`/usr/bin/true`, resolved/hash checked); call spawn, then bounded owned-child wait/cleanup.
2. A separate Command targeting that SAME tool, with the ONLY pre_exec closure `|| Ok(())`, then spawn and the same owned-child handling. The closure performs no filesystem, allocation, environment change, process group/session change or callback into the test harness. The unsafe block is narrowly limited to registering this reviewed no-op closure as required by Rust's Unix API; it is not permission to run arbitrary pre-exec code.

Use inherited stdin/stdout/stderr deliberately (no extra captured-output channels), so stdio setup does not introduce unrelated pipes/readers. Do not call process_group, setsid/setpgid, change identity, create pidfds or set a working directory/environment override. The one child/descendant set stays in the original supervisor-owned process group; the unchanged profile continues refusing session/group escapes and network operations.

Output only fixed categories per path: spawn success/failure, raw errno (if any), child exit success/failure, wait completed/timeout/cleanup state. No command debug formatting, environment values, raw error strings, paths or PIDs in the public result. A spawn failure has no Child handle; do not invent or kill a PID. A successful spawn yields an actual owned Child retained until wait/reap. No second attempt to the same path.

## One actual Cargo-path comparison in the same finite job

In addition to the single fixture invocation above, run ONE actual installed Cargo command through the UNCHANGED launcher/filter against a fixed tiny dependency-free crate. This avoids treating the deliberately forced Rust fallback as proof that Cargo uses it.

Prepare/review exact inert files: a standalone `Cargo.toml` with its own `[workspace]`, one named package/version/edition2024, no dependencies/build script/features and rlib-only target; `src/lib.rs` containing only `#![no_std]` and one arithmetic identity function; and the matching explicit lockfile containing that package only. No upstream crate, dependency graph or fake Cargo shim. Bind all three file hashes before/after. Select fresh Cargo home/target/home with no inherited Cargo/rustc wrapper/config or credentials, exact installed Cargo/rustc paths and fixed environment. Offline/locked execution is mandatory; no fetch or lock regeneration.

Use the actual command intent `cargo rustc --offline --locked --lib --no-default-features` in that standalone crate, with installed rustc explicitly bound. The output is an rlib, NEVER executed. The only external code involved is the already installed Cargo/compiler/built-in standard/core artifacts; no registry crate, build script or procedural macro is introduced. Observe one result with a FIFTEEN-second active deadline plus at most FIVE seconds cleanup. Failure/timeout is consumed, not a reason for another invocation.

Sanitize the bounded private Cargo stderr into fixed categories: accepted tiny compile; compiler launch never-executed/EPERM; compiler launch other error; compiler source rejection; timeout/unknown. Do not publish raw stderr/paths/arguments or assume a generic EPERM identifies socketpair. Record output existence/hash when produced, unchanged source/lock and exact installed tool identities. This is one direct observation of Cargo launching a compiler under this profile, not a full upstream build or a fix.

## Bounded execution and cleanup

One standard public Ubuntu24.04 diagnostic job, at most FIVE minutes overall, no matrix/cache/artifact upload, no install/toolchain update/sudo/settings or paid resource. Verify the installed tool/target identities first; unavailable/mismatching tools stop without fallback.

Prepare only the trusted launcher, dependency-free fixture and fixed tiny crate described above. No old full compiler/dependency/fixture replay, upstream source materialization, registry acquisition, upstream Rust library compilation, full link target or Governance runtime launch. The explicitly described tiny dependency-free rlib comparison is the only Cargo operation. Each trusted compile has a fixed short deadline within the five-minute outer budget. The single filtered fixture invocation has a FIVE-second active deadline plus at most FIVE seconds cleanup; the one tiny Cargo comparison has the separate FIFTEEN-plus-FIVE-second limit above, both under the original retained process-group supervisor. Descendant cleanup is explicitly external: the filter's kill/tkill/tgkill restrictions are not widened for this diagnostic. Internal polling may inspect/wait only the Child returned by spawn; no blocking wait can outlive the outer supervisor deadline. Do not label an unknown/rejected cleanup successful.

Compiler/fixture/filter failure, empty output or unsupported behavior is one consumed inconclusive/failed outcome—not permission to add calls or run another probe. Keep all original compiler failures/packets untouched.

## Interpretation and next decision

- If ordinary spawn succeeds and no-op pre_exec fails with EPERM before execution, the fixture distinguishes a real Rust fallback-path compatibility issue in the observed CI stdlib. If the separate tiny Cargo operation also reports compiler launch never-executed/EPERM, it directly reproduces the Cargo symptom without the upstream dependency graph. Together these narrow the cause; they still do not prove a specific syscall without native trace or matching exact Cargo/std source evidence.
- If both fail, do not automatically attribute both to socketpair: posix_spawn may fail at another restricted operation, or that CI implementation may use a different path.
- If both succeed, the fixture does not reproduce Cargo's failure. Do not change the profile or claim the compiler is fixed.
- Anonymous AF_UNIX socketpair is local IPC, but allowing it would be a CHANGE to the approved all-socket-denied boundary and might require following handshake syscalls. That decision is separate; this proposal keeps every profile byte unchanged.

Root should freeze a one-transition existing-PR workflow/event packet using the ACTUAL consumed prior head from its receipt and verify the current remote head immediately before one push. Do not guess the full prior SHA from010444b7, close/reopen the PR or inherit earlier before-head authority. Existing exact-head mandatory CI remains required; no red/bypass merge or production action.

A passing diagnostic does not replace the failed full compiler/link checkpoint or authorize merging PR331. Keep that full acceptance requirement open even if the old one-transition compiler workflow is skipped on the diagnostic head.

## Requested authority, not yet granted

One conditional bundle may cover source/mock preparation, independent exact review, trusted launcher and fixture compilation, then this ONE owned filtered fixture run AND ONE tiny dependency-free Cargo comparison after all source/free-runner/event/tool gates pass. No external documentation/source read, dependency fetch, profile change, full upstream compiler retry, cloud/account/credential/resource action, deployment, enablement or spending is included.
