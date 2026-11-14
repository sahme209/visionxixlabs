# Real Linux consumer join — exact source trace

Status: file-only source inspection. No native compilation/execution, source fetch, account/provider action, SQL or qualification performed. Existing ordinary/synthetic test success is not native end-to-end acceptance.

## Connected application path already present

1. `lib/governance/platform/nativeTime/linuxComposition.ts:22–27` constructs the actual `createNativeExecutionTimeSource`, captures it as the custodian clock, and passes that same clock into the real workload identity and ECS SDK transport. It constructs the actual workload runner and HTTP handler. This is a real application composition seam, not a replacement fixture coordinator. No public route or protected native initializer registers it.
2. `nativeTime/source.ts:36–64` captures the supplied resource callbacks, acquires and retains a parent hold, starts one owned worker, copies/decodes the record, confirms worker cleanup, rechecks currentness, obtains a fresh final observation, preserves original R/P0/P1, checks unchanged publication bytes, then invokes the actual checked interval implementation. Lines68–70 release/quiesce owned resources and permanently retire uncertainty. These are implemented contracts and supervision, not an actual OS worker launcher.
3. `nativeTime/record.ts` implements the explicit 12-line ASCII representation; `interval.ts:25–42` implements conditional checked enclosure. Its supplied precise-origin binding/rates and native lifecycle premises are not self-qualifying values.
4. `operations/nativeCustodianSupplier.ts:42–66` uses the supplied clock and exact one-use committed-dispatch checkpoint before the original native credential read. The existing runner/private STS/ECS phases use the actual shared application graph. Do not add another authorization/acknowledgment kernel to join time input.

## Native leaf source present, but no executable bridge

`packages/verified-issuer-runtime/linux/time_publication.h:9–27` defines a C context and capture struct, not an IPC ABI. The context includes the parent-owned directory and O_RDONLY source descriptor; `held_fd` is a worker-owned duplicate. The capture includes raw realtime/P0/P1/P2, file device/inode, publication and marker, and `time_authority=0`.

`time_publication.c:111–122` validates/duplicates the supplied source descriptor, reads the immutable record and samples raw clocks. `:124–128` checks resource/path identity only. `:130–131` closes the worker duplicate. None of these functions proves actual producer liveness or supplies conservative clock conversion/rate evidence.

A repository source search finds these capture symbols only in the Linux C header/implementation. There is no actual native worker entrypoint, framed result writer, process launcher, or Node-side decoder that invokes them. `source.ts` still accepts `NativeTimeSourcePorts`; all current concrete time-port instances in tests are synthetic. `linuxComposition.ts` requires those ports and does not manufacture them.

## Minimal next connected implementation unit

1. Define one fixed private worker entrypoint and explicit bounded wire response, not serialization of `struct axiom_time_capture`, Rust layouts or pointer/FD numbers. Bind protocol/version, original generation and held source identity, exact record bytes and integer raw samples. A parent-held opaque job maps the response to the original process/hold; caller JSON cannot select descriptors, paths, generation, profile or clock. Include EOF/extra-byte/error handling and maximum lengths.
2. Implement the actual parent supplier for `hold`, `start`, `release`, `assertCurrent` and `observeCurrent`. It must own the fixed protected directory/current descriptor and actual producer process/generation; preserve the same hold across the worker; create no late unowned worker; terminate/reap exactly its owned process and quiesce operations before release. Current worker C functions can be reused, not considered a completed bridge merely because they exist.
3. Join a fresh parent/native P2 and actual current producer/disruption/file observations after worker cleanup. Preserve original R/P0/P1 and record identity. Bind the V2 precise original anchor/expiry to exact points and supply conservative rational rates only from the qualified actual profile; do not substitute arbitrary callback constants or `qualified:true`. Unsupported premises refuse. Sampling P2 describes P2, not arbitrary later return or physical send.
4. Connect this concrete supplier once to the existing private composition. Use an actual private native initializer/resource delivery path; leave production/default registration disabled until target qualification. Producer integration must call the separate owned-context constructor and exact patched V2 hook, not the stock unqualified constructor.

These steps require a precise local bridge design/implementation scope decision before code if not already included in a new approved bundle. They do not imply permission for native compilation/execution, a host/resource launch, IAM/credentials, service installation, database/provider actions or deployment.

## Decisive later qualification, not repeat synthetic suites

After the artifact/profile and host approvals: build/link the actual producer patch and C/Rust/worker/parent bridge for the exact Linux target; exercise a real immutable publication through the real process/IPC/FD path into the existing runner with intercepted external effects. Demonstrate startup Unknown/no-parameters disruption/correction invalidation, native resource replacement/dead producer refusal, final-P2 aging, cancellation/late acquisition/unknown reap refusal and unchanged one-attempt liabilities. Native clock bounds/projections/rates and provider topology remain actual acceptance gates. A successful structural capture with `time_authority=0` cannot enable Governance.
