# Independent parent/worker source review

Scope: file-only review of `time_parent_binding.c/.h` and the actual shared worker protocol. No compilation, native execution, filesystem/clock/process API experiment, or additional test run. Native behavior remains unverified.

## Important finding

- **Release can resolve after an uncertain close.** In `time_parent_binding.c`, `hold_close_locked` sets `closed=1` before `close(original_source_fd)` and retires the parent on close failure. The RELEASE branch of `execute_job` then treats `h->closed` alone as success (current lines 123–128). This can acknowledge successful release even though native close failed. Preserve the retirement and bounded cleanup behavior, but require absence of close uncertainty/retirement before resolving release. Sent to the implementing agent; re-review the resulting source before closure.

## Reviewed integration

The protocol and parent agree on exact seven-line bootstrap, eleven-line capture header followed by the exact record body, 512/4096/4608 caps, canonical integer domains and EOF. The parent compares decoded device/inode/bytes/publication/marker to the original held record. It queues async work before clone, uses atomic child/pidfd ownership with no PID fallback, remaps preduplicated descriptors without collisions, and requires normal reaped exit plus full frame/EOF before accepting a capture. Opaque held/capture type tags and references retain private original resources; no public arbitrary-JavaScript bootstrap or qualified-time flag is added.

Root-identified release deferral, mutex initialization and N-API failure handling were already being repaired during this review; this document does not claim those moving changes are independently accepted. The successful-path raw shape matches `nativeLinuxPorts.ts`, including exact BigInt timestamps and fresh parent `p2`. Real native scheduling, syscall behavior, addon linkage and protected bootstrap qualification are outside this source-only verdict.

## Final source follow-up — CLEAR

The release acknowledgement finding is resolved: `hold_close_locked` records `close_unknown=1` and retires the parent on original-FD close failure; the RELEASE job snapshots that flag under the mutex, resolves only `closed && !unknown`, and terminates with failure on uncertainty without retrying a potentially recycled FD. A previously retired parent may still perform known cleanup; parent retirement is not incorrectly treated as proof of close failure. The worker initial state is now captured under the mutex and that snapshot drives the queued-state branch. Mutex initialization failure frees the not-yet-initialized object directly. The checked observation object/BigInt/property creation preserves refusal on an N-API construction error.

Final source verdict: **CLEAR within dormant source-preparation scope**, no important remaining interoperability finding. This is not native acceptance: C/addon compilation, linking, execution, real API behavior and protected bootstrap delivery remain unverified. No additional test or native operation was run for this follow-up.

Exact reviewed SHA-256 inputs:

- `time_parent_binding.c`: `0655d6e2fbae9487bec07b02fb71e7c7b70371e64d51efb8c895f17a016caeff`
- `time_parent_binding.h`: `90309565b1844013a547188ae5b4b7476925c0c0163b387f28a126a50c5a2245`
- `time_worker_protocol.c`: `004401d5983bea27b0a1d7cada6a7e56ddd604fbab289c150dbc69138f9aa6e3`
- `time_worker_protocol.h`: `d7bdd5ba397034cc0380d2d8a33800294ad14e8f4cbb6fd83d33e333a8b6792a`
- `time_worker.c`: `b4de84f1fb11d348cf8902a7991ef21465435349b1025df674c9e6c4b00fea3d`
