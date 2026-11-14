# Next coherent unit: real Linux capture worker and owned parent bridge

Status: SOURCE/DESIGN ASSESSMENT ONLY. No implementation, test, compiler, native launch, provider/network or resource action occurred here. The ongoing compiler/symbol run must finish on its own evidence; this document does not presume its result. Existing L0–L7 and master requirements remain unchanged.

## Why this is the next implementation, not another compiler probe

`NOVEMBER14-COMPLETION-AUDIT.md` correctly identifies implementation gaps distinct from the compiler checkpoint. `nativeTime/source.ts:10–28` already defines the complete hold/release/start/current/final-observe contract and its500ms/100ms supervisor. `linuxComposition.ts:20–27` already shares its resulting clock with the real identity/custodian/transport/runner. Rewriting those graphs or adding another qualification callback would not supply the missing native methods.

The actual C functions exist at `time_publication.c:111–132`, but no worker main calls them and no Node binding owns their descriptors/process. `capture_current` at124–128 explicitly checks resource identity only; it does not observe producer liveness/disruption or sample final P2. `time_publication_adapter.rs:15–23` still has no accepted policy issuer and always starts withNone;87–98 therefore keeps publications Unknown. A compiled library is not any of those missing implementations.

## Selected smallest connected deliverable

Implement ONE private native capture bridge: fixed C worker main + explicit framed result + parent-owned Node addon + thin TS adapter into the EXISTING NativeTimeSourcePorts. This is an actual bounded observation/process implementation. Do not add production registration, a fabricated policy supplier, arbitrary public descriptor constructor or copied execution coordinator.

Proposed files (names are finite design coordinates, not files already implemented):

- `packages/verified-issuer-runtime/linux/time_worker.c`: actual main, linked to the existing capture C implementation/header, no daemon or secret access.
- `packages/verified-issuer-runtime/linux/time_worker_protocol.h`: explicit bounded bootstrap/result framing, never C/Rust struct bytes or an FD number treated as authority.
- `packages/verified-issuer-runtime/linux/time_parent_binding.c`: private Node-API descriptor/child ownership, capture/result delivery, currentness and cancellation operations.
- `lib/governance/platform/nativeTime/nativeLinuxPorts.ts`: private adapter attaching original opaque handle identity and existing sourceGeneration/marker to actual native results, then exposing the already defined six methods. No no-op authority callback.
- Focused protocol/ownership/source tests beside those files. Extend the closed Linux artifact recipe to include these exact source/header/output identities; preserve the existing macOS package/profile.

### Worker input/output and actual existing C reuse

Freeze one inherited child descriptor table:3read-only generation directory;4read-only duplicate of the original parent-held current publication;5result-pipe write end;6bounded private bootstrap read end. Standard0/1/2 are system sink handles; all other inherited descriptors are closed before exec. In particular, no provider/database credential or arbitrary parent descriptor reaches the child. These are proposed fixed coordinates to review before implementation, not permission to alter installed resources.

Read only a canonical bounded bootstrap frame (maximum512bytes) containing generation and expected publisher UID/reader GID/directory identity. Those values identify resources, not qualify time or producer identity. Build the actual `axiom_time_context`, invoke `axiom_time_capture_v2` ONCE, encode its returned raw fields, call `axiom_time_capture_release`, close owned channels and exit. No latest-file reopen/retry, SHM mapping, stderr dump or second observation. The parent retains its own ORIGINAL source FD throughout; closing the worker's duplicate cannot consume it.

Use one versioned frame `AXIOM_CAPTURE_V1`, canonical decimal record length/device/inode/publication/marker/R/P0/P1/P2, an `END_HEADER` marker and exactly that many raw publication bytes. Cap the header at512bytes, record at4096 and entire frame at4608. Reject malformed/noncanonical numbers, overflow, short/extra/second frames and trailing data; never transmit native padding/pointers/FD identity or a `qualified:true` field. Parent provenance comes from its original owned handle and fixed executable, not this payload. Native `time_authority=0` remains true.

### Parent handle, child and final-observation ownership

- **hold:** private addon opens `current` once using the initializer-owned directory, O_RDONLY/no-follow; captures file/directory identity and creates an opaque native handle. Only this initial acquisition can select the latest file. No JS JSON object/file path/fd integer can mint that handle through a public API.
- **start:** synchronously establish ownership before returning to JS. Preallocate argv/env/descriptor actions in the parent; no Node/V8/allocator callback in the post-fork child. Use actual atomic child+pidfd creation (`clone3` with CLONE_PIDFD and a reviewed simple SIGCHLD child), then the fixed descriptor remap and fixed worker exec. The saved pidfd documentation warns against a fork-then-open assumption in Node with unknown global reapers. No PID-only signaling or silently weaker fallback. Actual target support remains an L3 acceptance fact; this compiler-only seccomp profile is NOT the production worker policy.
- **result/completed:** parse only the bounded owned pipe. Result is raw capture, not completion. `completed` resolves only from owned native termination/reap evidence. Preserve the existing supervisor's immediate ownership of both rejection channels.
- **terminate/release:** use the retained child handle for bounded signal/wait, no process-group/session change or arbitrary PID. A global Node reaper stealing status, late acquisition, lost termination acknowledgment or unquiesced native operation is uncertainty: retire the source and keep refusal. Do not assert cleanup based on pipe closure or a JS timeout alone. Close original held FD only after its own operations quiesce.
- **assertCurrent/final observe:** invoke existing `axiom_time_capture_current` against the ORIGINAL parent FD; never repair a changed hold by reopening current. Add a real native parent final monotonic P2 observation AFTER worker cleanup, retaining exactly the worker's R/P0/P1. The existing C function alone cannot supply this fresh P2.

## Authority boundary and what this unit cannot honestly complete

The native parent must consume actual protected bootstrap resources and original producer generation/lifecycle/disruption evidence. None of those are currently installed. A raw publication file, opaque JS object, pidfd alone or matching generation string is NOT accepted time authority. The exact read-only producer/process/disruption descriptors and accepted source/rate/lifetime profile belong to the existing protected initializer/L3 work, not an invented generic callback.

Therefore this unit may complete the ACTUAL worker transport/process ownership and parent raw observation, but must leave admitted `observeCurrent` unavailable until the real protected acceptance evidence is supplied. It must NOT synthesize TimePremises/default rates, mint AcceptedPreciseTimePolicy, switch Unknown to synchronized, register production HTTP or let a caller set a qualified flag. Expose missing accepted evidence as the existing refusal. That is an explicit remaining implementation/evidence boundary, not a new gate or a claim that the worker finishes Governance.

The subsequent protected initializer unit must bind worker executable/artifact identity and inherited resources, accepted precise-time/source/numerical evidence and genuine producer lifecycle/disruption to this parent instance, and call the existing same-clock composition. Do not repeat completed source/price/account inventories to implement it.

## Existing authority and finite execution order

Current approval covers the separately frozen compiler/symbol validation attempt only. It does NOT authorize this new native-addon/child-resource boundary or a worker launch. Before code, review this concrete unit and obtain the standing local source/isolated-test design approval. That can cover pure protocol, descriptor/child state-machine and source composition tests WITHOUT native API calls or a fabricated qualified supplier.

After source review, ONE exact later build packet can compile the real worker/addon and existing C library against pinned Node headers/target ABI without launching outputs. Native filesystem/FD/process/clock/cancellation cases then belong to the ALREADY REQUIRED role-free L3 packet after exact target/resources/cost/setup approval (L2); no credentials/provider effect is involved. L4custody, L5genuine independent people, L6one separately authorized provider trial and L7closure/cleanup remain after that. No installer/flag/production activation follows from a worker source or compile pass.

Minimum meaningful tests reuse the real protocol and existing source supervisor: exact frame round trip/limits; actual hold→child→result→reap→freshP2 order; no source substitution or old-record restoration; abort before/after ownership; late hold release; worker failure/partial frame/reap uncertainty; original FD retained; absence of real policy refusing admission; and same clock reaching the existing runner graph. Mocked ports may test order, but only later real L3 evidence establishes native behavior. No additional broad source research is proposed.
