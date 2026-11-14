# Independent review — unchanged-profile Rust/Cargo spawn diagnostic

Verdict: CLEAR for the stated conditional source/mock preparation and ONE finite diagnostic job decision. No implementation, compiler, fixture, Cargo, workflow, external read or profile change occurred for this review.

The current proposal accurately cites cached Linux socketpair lines77–78, distinguishes the cached Rust source from the actual Linux stdlib/Cargo path. Retained job logs now confirm CI rustc1.99.1(58cf8f9c3) and cargo1.99.1(5f94df478); the matching release label is useful but not proof of identical Linux source/path execution, and treats pre_exec fallback as a hypothesis rather than the proven Cargo cause. The actual symptom is preserved as compiler-launch EPERM/never-executed, not a Rust source/compiler result.

The two std-only paths differ solely by the reviewed no-op pre_exec closure, use the same fixed harmless executable and deliberate inherited stdio, and retain only actual owned Child handles. No process-group/identity/pidfd/config variation is hidden in the fixture. The unchanged filter and original external supervisor still own group cleanup; no kill permission is added inside the filter. Bounded polling cannot replace confirmed reaping, and unknown cleanup stays unknown.

The additional actual Cargo comparison is useful and necessary to avoid confusing a forced fallback fixture with Cargo behavior. Its fixed standalone/no_std/dependency-free rlib crate, own workspace and exact explicit lockfile are concrete. Locked/offline execution, fresh home/Cargo/target directories and pinned installed tools exclude registry/build-script/proc-macro/upstream replay. The rlib is not executed. Private stderr is reduced only to fixed categories; no generic EPERM is automatically attributed to socketpair.

Five-minute standard-public job, separate bounded fixture/Cargo deadlines, no install/retry/profile widening, exact future consumed-head transition and independent source/packet review keep the requested attempt finite. The final prepared driver must bind actual full prior head and all new source/tool/workflow hashes, avoid raw-output echo, and verify fixed source/lock bytes after the Cargo comparison. These are already proposed implementation conditions, not additional broad research gates.

Interpretation remains honest for success, failure and nonreproduction. In particular, one tiny Cargo success cannot complete the real full Rust/C/link checkpoint or authorize merging PR331; that failed acceptance gate remains open even if its old single-transition job is skipped on the diagnostic head. A later local-IPC permission or compiler retry requires a separate reviewed decision.

No material design contradiction found before the conditional owner decision.
