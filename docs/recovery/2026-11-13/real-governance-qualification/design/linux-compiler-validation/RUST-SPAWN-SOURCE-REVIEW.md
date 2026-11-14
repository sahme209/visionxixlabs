# Rust child-spawn refusal — source-only review

Actual retained result supplied by root: run43560429085/head010444b7, full rustc command “never executed”, EPERM. Filter fixture and real C compile passed; the observation does not identify the denied syscall or prove why Cargo chose a spawn implementation. No native attempt or profile correction is authorized by this note.

## Grounded hypothesis

Existing compiler_profile.h permits direct fork/vfork/exec and restricted clone, but denies all socketpair, setpgid/setsid and nonallowlisted operations. Existing benign C fixture tests direct fork+exec only, not Rust std::process::Command's pre-exec setup.

Already cached source `/opt/homebrew/Cellar/rust/1.99.1/lib/rustlib/src/rust/library/library/std/src/sys/process/unix/unix.rs` shows:

- Lines73–74 first try posix_spawn.
- Lines77–78, when that path is not selected, create an AF_UNIX/SOCK_SEQPACKET socket pair on Linux BEFORE fork at94. An error here can produce “never executed” without calling execve.
- Lines467–474 make nonempty pre_exec closures (also selected identity/chroot/group/path conditions) choose the fallback.
- Lines104–120/139 onward use the resulting channel for child exec-error reporting and acknowledgment. Merely permitting socketpair is not yet proof that the whole fallback is compatible.

This cached compiler source is1.99.1, NOT confirmed to match the actual CI compiler; cached Cargo/jobserver implementation was not available. No claim that Cargo installed pre_exec, or that socketpair caused this actual failure, follows. No additional source or documentation was fetched.

## Smallest meaningful next diagnostic proposal

Use the actual selected CI Rust compiler to compile one trusted small source fixture, then under the unchanged filter compare two bounded Command invocations of the same fixed absolute true executable: ordinary spawn and an otherwise identical no-op pre_exec closure. Reap each owned child and emit fixed success/errno categories only. This exercises actual runtime stdlib behavior absent from the C fixture without a registry/Cargo/project build or policy widening. It requires a fresh exact local/native execution decision; none is made here.

A plain-success/pre_exec-EPERM outcome would demonstrate that actual selected stdlib fallback is incompatible with this profile, not establish that this is Cargo's exact cause. If another outcome occurs, preserve it rather than widen or repeat automatically. Source matching and actual Cargo spawn behavior remain distinct evidence questions.

Do not blindly add setpgid/setsid: permitting descendant group/session escape invalidates the supervisor's original-process-group cleanup guarantee. Do not blindly allow local socketpair or broader network calls either; the strict all-socket policy was an explicit owner boundary and any scoped compatibility change needs its own reviewed predicate/ownership/security decision. The observed EPERM is evidence to diagnose, not a grant to relax restrictions.
