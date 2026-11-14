# Direct-object attempt — terminal result, November 14

Owner's latest `Approved` authorized the one prepared direct-object run. It is now consumed. No automatic rerun or profile change is authorized.

- Exact source: `010444b751e6ded03a01a99e772bf925280d3dcf`, existing PR331.
- Native run `43560429085`, job `132342651106`: **FAILED** at `rust-staticlib`. Cargo returned101 in1.089seconds; owned cleanup confirmed; stderr4431bytes/stdout0.
- Actual restriction preflight, locked fetch, filtered metadata/feature tree and real producer C compilation passed. Separate GNUar phase was removed; its earlier timeout cause remains unknown.
- Cargo reports four rustc invocations `(never executed)` / `Operation not permitted (os error 1)`. This is a child-launch refusal, not evidence of a Rust application compile error. No full Rust library or final executable was produced or launched.
- All seven other exact-head checks passed, including production website build, three test shards, type checking, required Typecheck + Vitest and isolated website. Additional compiler check is red: **DO NOT MERGE**.

Evidence: [complete native receipt](DIRECT-OBJECT-OBSERVED-RESULT.json), [actual error context](DIRECT-OBJECT-FAILURE-CONTEXT.txt), [exact-head checks](DIRECT-OBJECT-PR331-CHECKS.json). GitHub interleaved its Python exception traceback into the printed JSON; the saved receipt removes only those traceback lines, preserving their failure category and the separately saved actual Rust errors. No result values were altered.

Three source reviewers independently identified a plausible Rust spawn incompatibility: cached local Rust's Linux fallback opens an anonymous Unix socketpair before fork, and a pre-exec closure selects that fallback. The profile denies socketpair. This is **not confirmed causality for the actual CI Cargo/toolchain**. Other denied process setup calls remain possible. The passed C fork/exec fixture did not test Rust's spawn path.

Next proposed work is one small unchanged-profile diagnostic with the actual runner Rust/Cargo, not another whole upstream build or guessed syscall allowance. No setpgid/setsid allowance: it could defeat current process-group cleanup. New diagnostic execution requires a fresh reviewed decision. Full Governance remains incomplete/disabled; main, production, credentials, cloud resources and owner/human gates are unchanged.
