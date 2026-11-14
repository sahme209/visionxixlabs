# Native worker/parent implementation plan — fixed ownership and wire

Status: DESIGN ONLY; owner implementation approval is PENDING. This extends NATIVE-WORKER-NEXT-UNIT.md and resolves its two source-review details. No code, test, API invocation, compilation, native execution, research or provider action is authorized/performed here. Authoritative source checkout: `/Users/samirahmed/.codex/worktrees/axiom-governance-recovery-2026-11-14`.

## One unit and unchanged application contract

Implement only the fixed C capture worker, private parent Node-API binding, explicit framing and thin adapter into existing NativeTimeSourcePorts. Reuse `time_publication.c/.h` and `source.ts`; do not replace the execution graph or expose qualification callbacks. The existing supervisor owns500ms observation and100ms cleanup budgets. `linuxComposition.ts` remains the existing same-clock join; no public registration or accepted policy is minted.

The following state/wire definitions are part of this ONE unit, not additional research or qualification requirements. Actual Linux/Node/descriptor/clock behavior remains later L3 acceptance under the existing design.

## 1. Native operations must not block Node's timer/abort loop

Use Node-API asynchronous work for descriptor acquisition/currentness and ONE observation I/O job, with no Node/V8 calls from its background execution function. Completion callbacks on Node's event loop construct/settle JS values only. Pipe reads, waits, native poll and bootstrap writes NEVER run as a500ms blocking loop on the JS thread.

`start` prepares all owned storage, references, promises, fixed argv/environment and descriptor actions before child creation. Queue the native I/O work BEFORE creating a child; a queue failure therefore creates no unowned process. The queued work initially waits on native initialization/cancellation state, not JS. Then synchronously create the owned child plus pidfd using the reviewed atomic clone3/CLONE_PIDFD choice, retain both handles, publish OWNED state and wake that job. The post-clone child performs only prepared raw/async-signal-safe descriptor operations and fixed exec; no V8, Node API, allocator, mutex or user callback.

If child creation fails, mark NO_CHILD, wake the queued work for cleanup, throw/refuse start, and do not expose/reject orphan JS promises. The native job/reference remains owned until its completion callback releases it. There is no automatic fork/PID-only fallback. Single kernel operations are not claimed to have impossible hard scheduling guarantees; the implementation removes the identified event-loop-blocking read/wait design error.

### Instance/hold ownership

- Instance: OPEN → RETIRED → CLOSED. Only OPEN accepts new work; uncertain ownership/cleanup permanently retires it.
- Hold: ACQUIRING → HELD → RELEASE_REQUESTED → CLOSED. Each hold retains original directory/source FDs, expected identity/bytes/publication/marker, native-operation reference count and one private JS identity reference. An abort during acquisition cannot discard a later acquired FD: the late result remains owned and is released.
- Release sets a permanent requested latch, rejects new starts/checks on that hold, and closes FDs only when its operation count and owned child/job count are zero. It can run concurrently with worker termination as required by source.ts finally. No FD is closed/reused while a background operation still references it.

### Worker state and promises

Each hold admits at most ONE worker; each source instance admits at most ONE observation, matching the existing busy guard. Worker states are PREPARED → QUEUED → OWNED_RUNNING → terminal REAPED or RETIRED_UNKNOWN, with independent flags for EOF/frame-valid, cancellation and native operation completion. All transitions are serialized under a short parent-native mutex; no post-clone child takes it.

- `result` remains pending until a complete validated frame/EOF AND confirmed normal exit0/reap exist. Then it resolves once with capture bytes/sample; this avoids a success-frame race in which source.ts immediately calls terminate while the worker is still exiting normally.
- `completed` resolves ONLY after exact owned child reap and native pipe/job quiescence. It may resolve after a known nonzero/signalled exit (cleanup is known), while result rejects. EOF/pidfd readiness alone never resolves it. Unknown wait/reap/cleanup rejects it and retires the source.
- A cancelled capture never produces an admitted result, even if a valid frame arrives late. Promise terminal states never change back from rejected to resolved.
- Natural exit, result readiness and JS callback delivery are separate facts. Retain the native handle and napi references until callback completion; a finalizer requests cancellation/release but never destroys a live operation.

### Nonblocking poll, cancellation and reap

Create the result pipe with close-on-exec; set ONLY the parent's read end nonblocking. The child's write end remains blocking, so a4608byte frame need not fit in one pipe write. The parent I/O job uses bounded reads to EAGAIN and a native poll loop over result pipe, original pidfd, and a private nonblocking cancellation eventfd. Bootstrap writes are likewise handled off the JS thread; their frame is at most512bytes and the parent closes its write end after the exact frame. Native polling uses remaining monotonic budget, never a JS promise to keep reading.

`terminate()` is idempotent and returns the SAME retained termination/completion promise on repeated calls. If already reaped/quiescent, it fulfills without signaling. If running, atomically latch cancellation, wake native poll and use the ORIGINAL pidfd to request SIGKILL once. ESRCH means inspect/wait the original handle, not assume reap. Never signal a numeric PID or change/create a process group/session. `waitid(P_PIDFD,...,WEXITED|WNOHANG)` is repeated only for this owned child; no waitpid(-1) or competing reaper.

Unknown/ECHILD/reaper interference is NOT success. At cleanup deadline, reject/retire; keep owned native resources quarantined until late work actually quiesces/reaps. Do not resolve source.ts's100ms cleanup from a closed pipe, sent signal or elapsed timer. The JS supervisor can independently time out/retire earlier; later native cleanup cannot reactivate that source. No native thread performs a blocking indefinite wait.

The implementation must preserve source.ts's ordering: acquire → original currentness → synchronous owned start → result → terminate+completed → original currentness → final observation → release. Because native work is off-loop, the existing timers/AbortSignal delivery remain usable. This is not a new physical-dispatch scheduling guarantee.

## 2. Literal bootstrap grammar

Child descriptor table:3read-only generation directory;4read-only duplicate of the ORIGINAL parent-held source;5result write pipe;6bootstrap read pipe. Standard0/1/2 are fixed sink handles, and all other inherited descriptors are closed before exec. No provider/database credential reaches the worker. The descriptor table comes from prepared parent actions, NEVER numeric fields in a JS request or the wire.

Exactly these SEVEN LF-terminated ASCII lines, then EOF on fd6:

```
AXIOM_WORKER_CONTEXT_V1
<source_generation>
<publisher_uid>
<reader_gid>
<directory_device>
<directory_inode>
END
```

Generation is1–128bytes matching `[A-Za-z0-9_-]+`. UID/GID are canonical decimal uint32 (0..4294967295); directory device/inode canonical decimal uint64 (0..18446744073709551615). Actual privilege/role suitability comes from protected bootstrap qualification, not a parser's arbitrary new UID policy. Maximum total bootstrap512bytes. Reject NUL, CR, non-ASCII, empty/extra fields, signs, leading zeroes except literal0, overflow, missing final LF and any trailing byte/second frame.

Short/partial bootstrap or read/write failure yields fixed nonzero worker exit with no stdout/stderr dump. Parent cancels/reaps that SAME child, releases its own owned pipe ends and retains the original hold until quiescence; it never reopens current or retries. Generation/identity data is resource metadata, not proof of trusted producer origin.

## 3. Literal capture grammar and C ABI boundary

Exactly ELEVEN LF-terminated ASCII header lines, followed immediately by EXACTLY record_length bytes and then EOF:

```
AXIOM_CAPTURE_V1
<record_length>
<source_file_device>
<source_file_inode>
<publication>
<disruption_marker>
<realtime_ns>
<p0_ns>
<p1_ns>
<p2_ns>
END_HEADER
```

Header maximum512bytes. record_length is canonical decimal1..4096 (checked conversion to size_t), giving total frame maximum4608bytes. Device/inode/marker are uint64; publication is uint64 and positive. R/P0/P1/P2 are nonnegative uint64 encodings restricted to INT64_MAX, matching the existing C stamp function. P0≤P1≤P2 is mandatory. Every decimal parser checks overflow BEFORE multiply/add. No arbitrary precision is silently narrowed.

The existing raw publication follows unchanged as its exact byte sequence, including its final LF. Require its current `AXIOM_TIME_V2` / `clockbound-precise-origin-v1` codec domain, expected protected generation, and matching publication/marker fields. Reject wrong length, partial header/body, extra frame/data or malformed publication. EOF is required for frame acceptance but NOT sufficient for completion/reap.

Do NOT transmit `axiom_time_context`/`axiom_time_capture` memory, sizeof(size_t), held_fd, padding, process pointers, napi handles, bool qualification or time_authority. Native capture's time_authority remains0. The C worker builds only the actual declared context with directory_fd3/source_fd4, calls capture_v2 once, writes canonical fields/record, calls capture_release, closes channels and exits0. No raw mmap or representation guessing.

## 4. ORIGINAL source identity and exact TS conversion

At hold acquisition, retain fstat identity of the ORIGINAL parent source FD, exact bounded publication bytes and decoded publication/marker, plus expected directory identity/protected generation. Immutable-file checks are the existing regular/size/mode/owner/group/no-ACL checks; the private runtime/profile still must actually qualify those resources.

Before resolving capture, the parent compares returned device+inode to that ORIGINAL held FD, never a newly opened current file. It also compares record bytes/length, publication and marker to the hold's original snapshot and verifies the child's declared sample ordering/range. Run existing capture_current against the original FD/current path before acceptance; replacement means refusal, not latest-source repair. Wire identities cannot replace a native held identity.

Convert native uint64 fields directly to JS BigInt with the Node-API uint64 BigInt API; never route through double/Number. Record length alone is a bounded safe Number for buffer sizing. Construct the capture's `identity` from the parent's retained original private JS identity reference, `sourceGeneration` from its immutable protected context, marker from the matched original observation, and bytes as a private copy. Do not return an integer FD as identity or let the worker choose a JS identity.

Keep the exact original R/P0/P1 reading values and their already-established sampling intervals through final observation. Raw integer readings can be represented exactly as data, but a raw point is NOT a qualified physical-time/quantization guarantee. The admitted adapter must use the actual protected profile's accepted sampling conversion at the INITIAL capture, not widen/change P0/P1 later (source.ts explicitly rejects that substitution). If that profile is missing, raw capture may be inspected internally but no admitted source is constructed.

After actual worker cleanup, the parent performs original-FD/current-path checks plus the genuine original producer lifecycle/disruption checks and samples a FRESH native monotonic P2 off-loop. It retains the initial R/P0/P1 intervals byte-for-byte and uses the SAME accepted sampling/rate policy for new P2. The new P2 must not precede the captured P2; no future-return/commit timestamp is invented. `capture_current` alone cannot supply fresh P2 or lifecycle/disruption authority.

## 5. Scope and implementation sequence

This is the same ONE worker/parent/adapter unit: protocol codec → actual worker main using existing capture → native owned-handle/async-work bridge → thin existing-port adapter → focused framing/ownership/source tests. No new coordinator, kernel, mock profile issuer, public route or broad source research is selected.

Owner approval is still required for code and isolated/mock tests across this native child/resource boundary. That approval need not claim native compilation/run. A later exact artifact build and L3 role-free native qualification must establish real FD/child/thread/reaper/clock/filesystem behavior. Protected producer/bootstrap/lifecycle/disruption and accepted source/rate/lifetime policy remain real missing suppliers; this unit MUST keep assertCurrent/observeCurrent/admitted factory refusing when those are absent. A raw capture bridge must not return qualified=true, default TimePremises, caller JSON evidence or a minted AcceptedPreciseTimePolicy to fill the shape.

No installation, accounts/groups, grants, secrets, actual SQL, provider effects, cloud resources, deployment, runtime enablement or spending follows. The already existing L2–L7 sequence and every remaining master requirement remain intact.
