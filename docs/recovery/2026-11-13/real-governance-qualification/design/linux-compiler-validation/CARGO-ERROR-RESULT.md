# Cargo-only observation — actual cause retained

Exact source207cf145a15b87c07206027fc2e2f08511b3523a; packet44a5d9c1165e1a7994934ef3fdf63fbc1400a9c9251b731d7393125657392061. One approved run43607174394/job132484213088 completed successfully as a diagnostic. Permission is CONSUMED, not renewed. Cargo compilation itself did not succeed.

The actual Cargo child exited101 after0.019seconds,316stderr bytes/stdout0/no rlib. Every phase confirms original owned-group cleanup. Tools/std/core/filter identities match the earlier accepted diagnostic. The old Rust-probe and full compiler workflows were SKIPPED, not replayed or accepted.

The bounded error was released under the explicitly approved path-redacted/JSON-escaped contract. SHA25658c0a2b14aa369e0b415ad6f7f334a709845e70d06815311d7abe8f600420528; [complete observation](CARGO-ERROR-OBSERVED-RESULT.json). It identifies `thread 'main' ... panicked at /rustc/58cf8f9c35b355199727627d07ae34a4e2846d67/library/std/src/process.rs:2488:21`, an unwrap of `Os { code: 1, ... Operation not permitted }`. The old fixed classifier still calls this unclassified, but the newly retained evidence now permits actual source diagnosis without another error-collection attempt.

## Source-backed diagnosis, not a syscall trace

Read-only matching installed Rust1.99.1 source:

- `std/src/process.rs:2472–2488`: `Child::wait_with_output`, with both captured stdout/stderr, calls Unix `read_output` then unwraps its error at the exact observed line.
- `std/src/sys/process/unix/common.rs:639–650`: that routine first puts both output pipes into nonblocking mode.
- `std/src/sys/pipe/unix.rs:6`: Pipe aliases FileDesc.
- `std/src/sys/fd/unix.rs:629–633`: Linux FileDesc::set_nonblocking calls `ioctl(FIONBIO)`.
- Current `scripts/linux-compile/compiler_profile.h:175–182` allows only TCGETS, TIOCGWINSZ and FIONREAD ioctl selectors. It omits FIONBIO.

This is a concrete source-backed output-collection incompatibility. It differs from the earlier pre-exec/no-Child error; it does not prove Cargo selected that fallback or identify every requirement of the full Rust build. No permission was widened in this run. No production/time/custody qualification or Governance activation follows.

Next proposed decision: [BUILD-IPC-COMPATIBILITY-PROPOSAL.md](BUILD-IPC-COMPATIBILITY-PROPOSAL.md), covering the output setting plus the separately located anonymous child-channel requirement in one reviewed conditional fixture/tiny/full-compile batch. It is not yet authorized. Preserve all original full-build failures, unknown histories, human/coverage/master and production gates. No real credentials, SQL/provider effects, resources, signing, installation, deployment or spending occurred.
