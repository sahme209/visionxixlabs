# Consumed Stage A: nested prelaunch diagnostic

No bound source was changed; no attempt was retried. Inspection only plus one pure mocked standard-library probe.

The actual driver creates `offline/outer.log` before calling `engine_tools._run_generation_child`. That helper checks SIGCHLD then constructs `subprocess.Popen(... stdin=DEVNULL ...)` before entering its supervision try block (`local_prisma_engine_inputs.py:194–205`). An exception there reaches the driver's generic offline `artifact_phase_unavailable`, without a child receipt or child stderr. Thus empty logs do not demonstrate that the nested child started.

Concrete mechanism: CPython3.9 subprocess.py:829/1060–1063/1581 and CPython3.13:1005/1148–1151/1740 resolve DEVNULL by opening `/dev/null` with **O_RDWR** in the already-sandboxed parent before `_execute_child`. The outer `_generation_profile` denies file-write everywhere except work/tmp and explicit logs, and does not exempt `/dev/null`. Opening it write-capable therefore conflicts with the selected inherited policy. The pure `probe.py` mocks every `os.open`, injects EPERM, and confirms no `_execute_child` invocation. No process/native/sandbox call was made by the probe.

This is a concrete deterministic incompatibility in the source composition and closely matches the observed absence of stage/result/log output. The consumed actual attempt omitted exception errno/phase details, so the exact live exception remains unconfirmed; do not label a captured sandbox denial as observed.

Other pre-child exception sites remain: SIGCHLD disposition check, Popen pipe/session/fork/exec setup, and preexec resource-limit failure. The512MiB outer/A0 join already avoids the previously reviewed hard-limit raise mismatch. `_log` creation apparently succeeded because its empty file exists. None warrants another execution or guessing a successful child cleanup.

Minimal future local repair to review: use a fixed **read-only** null input descriptor for supervisors, retaining stdin EOF, exact descriptor lifetime/ownership and all write restrictions. Bind and test this at the existing supervisor seam, including nested calls and close-on-exception; do not broadly grant `/dev/null` writes or loosen file-write policy. Separately preserve allowlisted prelaunch exception classification so future diagnostics can distinguish spawn refusal from an actual child outcome without leaking paths/messages. A new source revision/packet and explicit new execution decision would be required after local review; the original attempt remains consumed.
