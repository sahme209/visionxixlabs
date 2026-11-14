# Actual daemon integration correction — source-derived plan and scope review

Status: DESIGN ONLY; no implementation, native compilation/execution, source fetch, provider/resource action or enablement is authorized by this document.

## Observed actual path

Saved pinned upstream source only (revision 371058f8f6a1786d4a4ab3eed9f5f2f16eea7777):

- PUBLIC-READ-1.txt:125–128: Daemon::construct currently accepts configuration and cancellation only. Lines188–195 call ClockState::construct with initial Unknown; no protected publisher context is passed. Lines249–258 start IO before spawning ClockState::run.
- PUBLIC-READ-2.txt:110–135: ClockState constructs the actual V2 ShmWriter and boxes it into Shm0. V3 is separately constructed at117–122/136–141. This V2 construction is the exact decorator insertion point.
- PUBLIC-READ-2.txt:185: ClockState::run invokes Shm0::initialize before its event loop. Saved five-file-structural-audit/PUBLIC-READ-4.txt:41–54 builds this initial Unknown through a conditional create_shm_snapshot; absence of a write is possible. Existing first-Unknown guards do not prove initialization occurred before an adjustment if initialization never invokes the adapter.
- PUBLIC-READ-2.txt:275–281: handle_sync_parameters invokes the real discipliner before fresh V2 publication at311–312. An old synchronized Axiom file can therefore remain current during correction unless explicitly invalidated first.
- PUBLIC-READ-2.txt:346–355: disruption updates both writers only when sync_parameters exists, then clears parameters and notifies the discipliner. With no parameters, the stored Shm0 marker is not advanced by that branch.
- PUBLIC-READ-3.txt:85–110/407–448/497–506: SourceIO owns source/disruption plumbing, not publication writers. VMClock initialization may fail while the source/shared state remains installed. No publisher patch is needed in io.rs from the inspected path.
- PUBLIC-READ-4.txt:57–70: the actual discipliner dispatches initializing/running correction. Lines75–88 explicitly retain ongoing PLL corrections on disruption. A new Unknown record is refusal evidence, not proof that kernel corrections have stopped.

## Minimal proposed correction

1. Pass one explicit protected publisher context/owned generation resource from a private Daemon constructor into ClockState construction. No optional/default path in the qualified constructor; no environment/JSON-created generation or fallback to vendor SHM. Keep any stock/unqualified constructor distinguishable and unable to supply Axiom qualification. Wrap only the actual V2 writer at the identified box; preserve V3 compatibility behavior.
2. Add an explicit, nonoptional startup invalidation operation that produces a valid bounded V2 Unknown record without depending on the conditional synchronized snapshot builder. Require its successful nonreturning-failure publication acknowledgment before the event loop can call any discipliner adjustment. Do not invent an elapsed-time/rate bound for an unusable Unknown record. Codec domain and fail-closed semantics must remain explicit.
3. At every actual disruption marker event, advance the authoritative publisher/Shm0 marker and publish an unusable status even when no synchronization parameters exist. Do this before clearing/continuing control state. Marker/publication failure kills the producer generation; no catch-and-continue or marker reset within a generation.
4. Immediately before each actual handle_clock_parameters correction, publish Unknown through the same checked publisher and require acknowledgment. Then permit the correction; derive and publish a fresh V2 value afterward. Any inability to derive the fresh value leaves Unknown, never restores the previous synchronized record or rolls back its counter. Existing fatal publication behavior remains mandatory. The separate actual native disruption/liveness checks remain required throughout.
5. Keep bound, drift, precise/coarse projection, kernel discipline behavior and runtime/source currentness qualification held. This correction does not establish those premises, future physical-send timing, or removal of the already accepted scheduling limitation.

## Proposed local acceptance tests (pure/mocked only after approval)

- Actual constructor passes exactly one owned context to the actual V2 decorator; no fallback/default, no V3 substitution; missing context refuses qualified construction.
- Initial Unknown publication completes before the first correction; skipped/failed initialization yields zero correction/delegate continuation.
- Disruption with and without parameters advances the same marker and emits unusable status before control continuation; stale synchronized record cannot survive as eligible.
- Ordered trace: acknowledged Unknown → exactly one correction → newly derived V2 publication; correction/build/publication failure leaves refusal or fatal generation, with no replay, counter reuse or old-record restoration.
- Existing vendor compatibility publication and separate native lifecycle/disruption requirements stay intact. Fixtures cannot qualify the native constructor, Linux filesystem or clock.

## Approval determination

The accepted IMMUTABLE-TIME-PUBLICATION-LOCAL-DESIGN.md explicitly requires actual startup/update/disruption wiring and Unknown before startup adjustment as eventual acceptance. However, its approved local preparation list covers codec/state machine, source-only adapters, arithmetic/supervisor and graph composition, and expressly holds actual daemon constructor/build integration as a real-artifact gate. It does not explicitly authorize changing the upstream discipliner call ordering or replacing conditional startup/disruption snapshot behavior.

Therefore request ONE narrow local source/pure-mocked-test approval for this concrete constructor and control-order correction before coding. This is not a request for another broad mechanism redesign. Native compilation/run, fetched dependency adoption/build, daemon launch/install, real filesystem/clock/security calls, resources/accounts, provider/SQL access, credentials, enablement/deployment and spending remain separately held. The previously consumed four-source-read grant provides evidence only, not implementation authority.
