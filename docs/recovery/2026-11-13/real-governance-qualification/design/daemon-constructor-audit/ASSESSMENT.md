# Pinned daemon constructor and control-order assessment

## Completed finite read authority

Owner approval `call_81a3cd488b7e4b65b8ee6e8787f88568` is consumed. `OBSERVED-RESULT.json` records four requests, four validated public-text files, `failed:false`, `complete:true`, at pinned official `aws/clock-bound` commit `371058f8f6a1786d4a4ab3eed9f5f2f16eea7777`. Completion was recorded at `2026-11-14T01:54:45.191Z` (November13 Eastern). The packet verified exact byte counts/Git blobs and saved SHA256 observations; no fetched source was executed. This assessment performed no further fetch, native call, compilation or test.

| Saved file | Actual source | Bytes | Saved SHA256 |
| --- | --- | ---: | --- |
| PUBLIC-READ-1.txt | clock-bound/src/daemon.rs | 37992 | bd45a24d82a516c7bbf33fdc75daee38ec1985a3042e1a86cc4c203934d648b5 |
| PUBLIC-READ-2.txt | clock-bound/src/daemon/clock_state.rs | 30558 | d8c955afabeab7b0eae3e1b915dce76763d6d7ee7de0d9350e6df511aa258abc |
| PUBLIC-READ-3.txt | clock-bound/src/daemon/io.rs | 35932 | 2c34d38c4270a8a9367d22b4f0a645e8f5391f74be6cee7de97193050a0cfdd2 |
| PUBLIC-READ-4.txt | clock-bound/src/daemon/clock_state/system_clock_discipliner.rs | 5842 | 83abca63f75ceed198cfb56aeca29587d363cf301b66dc9fef13e549b2417b29 |

## Concrete constructor and startup findings

- `ClockState::construct` creates the V2 writer directly for the V0 path, advertising V2/V2, at `PUBLIC-READ-2.txt:110–115`. It creates the separate V3 writer at `117–122`. The actual V2 decorator insertion point is `Shm0::builder().shm_writer(Box::new(shm_writer_0))` at `130–135`; Shm1 is built independently at `136–141`. Do not wrap Shm1 in the V2-only adapter.
- The constructor derives disruption support from whether VMClock parameters exist, including when initialization failed (`2:97–103`). The flag is not evidence that the source is healthy. A failed VMClock state is inspected at `159–165` and forces both statuses to Unknown during sync processing (`273–309`).
- `ClockState::run` calls `self.shm0.initialize()` before entering the event loop (`2:179–186`). Disruption events have priority over sync events in that loop (`187–195`). This establishes intended ordering, not guaranteed successful Unknown publication.
- The previously saved `five-file-structural-audit/PUBLIC-READ-4.txt:41–55` shows that `Shm0::initialize` builds zero clock parameters and writes only if its optional snapshot construction succeeds. Its caller receives no success result. This assessment does NOT establish that the default initialization actually returns None; it establishes a source-visible skipped-publication path that the caller does not acknowledge.

## Source-proven integration assumption corrections

### A first-Unknown writer guard cannot alone protect the clock-adjusting caller

The prepared `NativeTimePublisher` refuses a non-Unknown first publication. However, `ClockState::handle_sync_parameters` invokes the system clock correction at `PUBLIC-READ-2.txt:277–287`, then publishes Shm1 at `303–304`, then Shm0 at `306–312`. If startup's optional Unknown snapshot were skipped, the guard could first run on this later publication, AFTER correction. The guard remains useful and fail-stop, but constructor decoration alone does not establish Unknown-before-adjustment.

`SystemClockDiscipliner` starts in Initializing (`PUBLIC-READ-4.txt:28–32`); its first parameter handling delegates to `initializing.to_running`, and subsequent handling delegates to `running.apply_offset` (`54–64`). It reports Unknown while Initializing and Synchronized while Running (`80–85`). The inspected file does not establish the full delegated step/slew conditions. Do not infer that every later correction invalidates the old error bound, or that no later correction can do so.

### No-parameters disruption bypasses the Shm0 marker/publication

`ClockState::handle_disruption` obtains a marker at `PUBLIC-READ-2.txt:345–346`, but calls both concrete writers only when `sync_parameters` is Some (`347–351`). It then clears parameters and forwards the disruption (`353–355`), finally recording a component status change (`357–358`). Therefore an event before the first sync, or another event after parameters have been cleared, does not call Shm0's marker/publication path.

The concrete Shm0 handler updates its own marker only when called, before attempting its Disrupted snapshot (`five-file-structural-audit/PUBLIC-READ-4.txt:85–97`). Without an additional invalidation path, a later Shm0 publication can retain the older marker. This is a source-control-order observation, not a demonstrated live clock failure.

### Disruption does not reset or stop the active correction mechanism

`SystemClockDiscipliner::handle_disruption` is a no-op with a comment that correction continues through the PLL (`PUBLIC-READ-4.txt:67–77`). Do not claim that receiving the event stops corrections, resets the state machine, or closes any credential/effect lifetime. Changing that correction algorithm is not part of the narrow publication integration below.

## Narrow proposed source integration

1. Carry the fixed protected publisher context through the actual constructor and wrap ONLY `shm_writer_0` before giving it to Shm0 at the identified insertion point. No environment-selected directory, new public constructor input or V3 substitution.
2. Provide a non-skippable unusable-status publication path independent of optional skew/clock-parameter estimation. Startup must complete that publication before adjustment-capable processing. Encoding/publication failure must terminate, not return through the void writer. Keep the existing TS/Rust/C first-Unknown defenses.
3. On every actual disruption, update the Shm0 marker and publish unusable status even when no synchronization parameters exist. Do not invent synchronized bounds for the missing-parameters case. Preserve independent native disruption/lifecycle checks: a notification can follow the physical event.
4. Before a correction that could invalidate the existing V2 bound, invalidate Axiom's publication first. The concrete conservative option is to publish Unknown before every `system_clock_discipliner.handle_clock_parameters` call, then publish the newly computed V2 value only after correction/measurement. An optimization preserving old data instead needs evidence that the selected correction preserves that bound; the inspected delegation alone is not that evidence. This is a proposed integration choice, not an already approved source change or measured performance claim.
5. Preserve the original system-clock correction algorithm, Shm1 compatibility behavior and current final publication/status logic. Successful Axiom publication must precede compatibility delegate continuation; publication/delegate failure stays fatal to the producer generation.
6. In the next authorized source unit, test the exact constructor/control flow with ordinary intercepted fixtures: startup optional-snapshot refusal, failure before correction, no-parameters/repeated disruption, marker propagation, correction-before-final-snapshot ordering and fatal publication/delegate cut points. Do not replace this with another generic qualifier callback or repeat unrelated passing suites.

## Disposition and limits

This four-file pass closes the specific constructor/control-order source inventory. Do not automatically fetch a fifth file, rescan releases or claim that the adapter is wired merely because the hook exists. Actual local source integration needs its applicable reviewed scope; actual compilation, daemon installation/launch, clock adjustment, filesystem/process qualification, account/resources/credentials and spending remain outside this consumed public-read grant.

The already recorded native lifecycle/descriptor and conservative clock-premise requirements remain unchanged. These findings do not create a new universal physical-dispatch guarantee, prove a native clock, qualify a real supplier or complete Governance. The next source work is the concrete integration above, not another broad research gate.
