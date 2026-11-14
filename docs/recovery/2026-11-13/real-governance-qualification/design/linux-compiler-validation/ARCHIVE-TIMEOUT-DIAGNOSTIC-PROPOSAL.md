# One bounded archive-timeout diagnosis — conditional proposal

Status: design/preparation request only. No implementation, manual read, tracing, compiler invocation, CI run or profile change is performed by this proposal. The prior conditional compiler authority is CONSUMED and does not authorize a retry.

## Actual evidence and limits

Corrected run43558087222/job132335395517, exact head12d5c45e7883bc50e9142dfa1e38cc1602b77a43, stopped at `c-archive`. Its actual retained command was the reviewed network launcher followed by `/usr/bin/x86_64-linux-gnu-ar rcs <owned archive> <owned time_publication.o>`. The supervisor reports10.0037seconds, timeout, SIGKILL(-9), cleanup confirmed, zero stdout/stderr. The trusted launcher/fixture passed its four categories, locked fetch and filtered metadata/features passed, and the actual C object compiled with four misleading-indentation warnings. Rust compilation was NOT reached. These are native compiler/filter results, not Governance runtime qualification.

This evidence identifies the phase and bounded stop, not the cause. It does NOT establish a particular missing syscall, a GNU ar bug, a CPU spin, an external network failure or a need to relax the positive profile. Do not add a guessed syscall or repeat the full compiler/dependency sequence.

## Narrow selected diagnostic

Prepare one owned-child strace invocation around exactly the unchanged filtered archive command. Keep the launcher/profile/allowlist byte-identical to the accepted corrected run. No unrestricted ar control run, profile widening, preload, injected syscall/error, ptrace attachment to an existing process or host inspection. strace is a trusted installed diagnostic tool outside the child filter; it observes only the newly spawned owned archive child and its descendants. It is not itself a new sandbox or qualification authority.

Use installed `/usr/bin/strace` only. If absent, unsupported, refused or incompatible with the existing filter, STOP without install, sudo, settings, another tool or retry. Capture its resolved path/hash/version. Do not claim that ordinary-user tracing is supported until the one authorized job actually tests it.

## One primary manual read before code

The same conditional owner grant should permit ONE primary strace manual read at `https://man7.org/linux/man-pages/man1/strace.1.html`, using the available documentation tool. Verify the actual options for raw arguments (no pointed-to string/data decoding), failed-return filtering, fork following, standard-error output and owned command launch. No additional source/manual request or automatic follow-up. If the manual does not establish the required flags, stop preparation and report that fact rather than guess.

Proposed flag INTENT, not an already verified final recipe: follow only the newly spawned command's descendants; raw arguments for every syscall; emit failed-return syscalls only; standard-error trace captured by the original bounded parent supervisor; execute `network_launcher -- <exact installed ar> rcs <fresh owned archive> <fresh owned object>`. Freeze actual flags only after that one manual read and independent source review. No `-p` attach, injection, decoded buffers, environment decoding, stack traces or shell command.

## Finite preparation and future one-run scope

After conditional approval:

1. Prepare a separate fixed diagnostic driver/workflow transition, trace sanitizer and pure synthetic refusal tests. Independently review its actual source, tool/argv/filter hashes and event guard before any execution. Existing code/profile and consumed failure receipts remain intact.
2. One STANDARD public `ubuntu-24.04` job, maximum FIVE minutes overall, no matrix/cache/artifact upload or paid resource. Same clean environment and original bounded supervisor; no account/cloud permission, secrets, OIDC or production action.
3. Verify installed cc/ar/strace and bind paths/hashes/versions; stop before compilation if strace is unavailable. Recreate only the trusted launcher and the SAME actual `time_publication.c` object using the already installed compiler and frozen headers/source. This fresh runner has no retained prior object, so do not pretend to reuse a previous job's ephemeral file. No Cargo, Rust compiler, source/archive request, registry fetch, dependency resolution or full fixture replay. Compiler inputs/outputs remain bounded and are not launched except the explicitly authorized trusted launcher below.
4. Make ONE tracing invocation with a FIVE-second active deadline plus at most FIVE seconds owned process-group cleanup. Trace the fixed archive child through the unchanged launcher. Allow the supervisor to terminate the owned tracer/child group at deadline; no detached/follow-up diagnostic. An ar exit or timeout is the observed result, not permission for another invocation.
5. Bound aggregate actual stdout/stderr at64KiB using the existing parent-side pipe supervisor. Do NOT set RLIMIT_FSIZE: it also constrains the archive output and would change the workload. Store the raw trace from standard error only in a fresh0700ephemeral job directory with0600file/no overwrite; the diagnostic driver must never echo raw streams into the normal CI log. Trace-limit or cleanup uncertainty stops with an explicit partial/inconclusive receipt. The actual trace contains only raw scalar/pointer arguments, but it still stays out of committed files and normal chat/CI output.
6. Sanitize ONLY syscall name, errno and occurrence count into fixed bounded JSON (maximum128distinct pairs), plus phase/duration/exit/timeout/truncation facts, source/filter/tool hashes and cleanup state. Do not output raw syscall arguments, addresses, PIDs, file paths, buffers or errors. Unknown/malformed trace forms are counted as uninterpreted, not guessed. Preserve the consumed-attempt receipt whether useful, empty, failed or inconclusive.

Failed-only output can be empty even when a process blocks or the tracer cannot diagnose its state. It may also contain benign failures unrelated to the timeout. Therefore no failed pair automatically justifies a policy change; review actual causal evidence first. No expanded/full trace, second control or another run follows silently from an inconclusive result.

## Exact existing-PR transition

Use the existing PR331, never a new PR or close/reopen trick. The diagnostic workflow AND driver must require synchronize, PR number331, base main, exact repository/branch, run_attempt1, and `before == 12d5c45e7883bc50e9142dfa1e38cc1602b77a43`, with `after` matching both actual checkout and new head. Required synchronize fields are already verified in the saved event-schema evidence; no new event-source read is proposed. Verify remote head still equals that prior head immediately before ONE push; a mismatch stops. Freeze a NEW diagnostic packet and preserve both existing compiler packets/results. No full compiler continuation is triggered by this diagnostic transition.

## Required decision and preserved gates

Request ONE conditional bundle: the single manual read, local source/synthetic preparation and independent review, then ONE bounded diagnostic job only if all preparation/free-runner/exact-event/tool/input gates pass. This explicitly includes trusted launcher/C-object compilation and one owned-child tracing operation, which the consumed prior permission does not cover.

No policy widening, dependency fetch, Rust build, produced Governance runtime/helper/daemon launch, protected resources, credential/account/service/IAM change, SQL, provider effect, deployment, feature flag, spending or Governance enablement. A later correction/build requires its own reviewed authority; this diagnostic must remain small and conclusive about its limits.


## Not selected — unnecessary intermediate removed instead

No tracing/manual/native diagnostic authority was requested or used. Source inspection establishes that the C archive is not required: plain extern C references may remain in the Rust staticlib until the final link with the actual C object. DIRECT-OBJECT-DESIGN-REVIEW.md records this same-target correction. The actual GNUar timeout cause stays UNKNOWN; nothing is inferred or widened. Preserve this unexecuted diagnostic proposal as history, not the next task.
