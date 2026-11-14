# Verified source origin — precise-anchor feasibility

Source-only assessment of the successfully verified 322-blob pinned archive at `work/pinned-clock-bound-371058f8-archive-inspection-1/source`, revision `371058f8f6a1786d4a4ab3eed9f5f2f16eea7777`. No downloaded source, build script, macro or executable was imported or run. No further source fetch is needed to locate these paths.

All source references below are relative to `clock-bound/src/daemon/` in that verified directory.

## Actual bound epoch: important correction

`clock_parameters.rs:18–31` defines the error bound as the bound of `time` at `tsc_count`, NOT the wall-clock instant when the structure is allocated. `time_at` at34–38 extrapolates from that TSC epoch.

`clock_sync_algorithm/ff.rs` is the module/utility container; the actual constructors are in its `ntp.rs` and `phc.rs` children. NTP `feed` at80 onward explicitly documents at86–98 that its coarse timestamp ought to precede the input event's TSC-post read, but instead subtracts a heuristic 10 ms at100–105 to cover scheduling. A precise read merely before `feed` would therefore NOT establish the desired lower anchor: the event can already be arbitrarily old in a queue. This source confirms the previous before-computation suggestion needs a concrete earlier I/O hook.

NTP creates parameters at189–196 from the event TSC midpoint and the calculated theta/bound. PHC `feed` at101–112 samples coarse time before computation but still uses the earlier input event midpoint at112 and194–201. Both outputs must retain their original observation provenance across later selection/queueing; a new read at Shm0 is too late.

`io/phc.rs:878–900` locates the concrete PHC I/O hook: inside the actual blocking closure, immediately BEFORE `read_timestamp_counter_begin`, which then brackets the PHC ioctl and `read_timestamp_counter_end`. This is an exact place for a precise monotonic lower anchor that precedes the entire input measurement, including its midpoint. Do not capture it only outside the closure after `spawn_blocking`, or after its future resolves.

For NTP, the exact hook is `io/ntp.rs:553–560`, inside `inner_timeout` immediately before `let send_timestamp = read_timestamp_counter_begin()`. That anchor must travel in the same successful tuple back through `sample_packet` (`497–520`) into the accepted event; invalid/unmatched UDP replies cannot replace its association. No feed-time minus guessed scheduling constant is acceptable for Axiom's strict anchor.

## Minimal truthful source change

Preserve stock V2 bytes and its `as_of_monotonic` behavior for compatibility. Add a distinct Axiom precise-anchor field/provenance path originating in the native I/O observation, carried in the exact event, retained in the winning `ClockParameters`, cloned/selected with that object and used only by the private immutable publication. When `ntp.rs:198–219` rejects a new candidate as not more accurate, the old retained parameters must retain their OLD anchor; never refresh only the timestamp. Missing origin (including reconstructed logs, synthetic defaults and unsupported source kinds) must not acquire a usable anchor. The existing log conversion at `logging/ffevents/types.rs:263–279` reconstructs coarse time with a default, so logs cannot become an authoritative replay input for this field.

A single precise lower anchor before the real event measurement is sufficient to remove the COARSE→MONOTONIC projection from elapsed-age computation: measured later precise elapsed time overestimates age from the input's midpoint. It does NOT establish the time/rate bound itself. A field captured at feed entry or immutable-file publication is insufficient.

The least protocol change is a separately versioned Axiom record containing the exact precise lower anchor plus the actual bound/drift/status/generation/publication/disruption fields. Do not relabel the old twelve-line `clockbound-v2` record's coarse `as_of` as precise. The corresponding decoder/interval path must require the new version explicitly; stock V2 and its 1000-second metadata stay unchanged. Preserve mandatory Unknown startup/disruption/pre-correction publication.

## What the inspected arithmetic really establishes

- Shm0 `shm_writer/shm0.rs:69–81` measures `ClockBound` versus realtime and computes `B = parameter_bound + abs(offset) + RTT/2`. `time/inner.rs:69–77` shows the precise order is ClockBound read → realtime read → ClockBound read, with midpoint offset. `time/clocks.rs:61–66` evaluates ClockBound using current TSC and `ClockParameters::time_at`.
- These operations are source-visible formulas. They do not independently prove source UTC accuracy, TSC stability or a maximum realtime/monotonic rate. Moving the age anchor cannot turn the formula into a physical guarantee.
- Shm0 `111–112` publishes `void_after = coarse_as_of + 1000 seconds`; this is a software lifetime selection, not evidence that all assumptions hold for 1000 seconds. An Axiom age limit may be shorter, but inventing a short limit does not validate an otherwise unbounded rate.
- Shm0 `122–130` sums oscillator dispersion and estimated software skew. `time/tsc.rs:283–290` converts skew using nearest-integer `.round()`, not upward rounding. Therefore copying that integer as a mathematically conservative strict drift coefficient is not justified solely by this source. An Axiom coefficient requires checked outward rounding of its actual inputs (and numerical error accounting), or a separately evidenced upper bound; no silently added arbitrary ppb margin.
- `clock_parameters.rs:46–60` grows old samples for comparison using configured max dispersion. This comparison mechanism is not proof the configuration bounds actual hardware.
- `time/clocks.rs:5–7` explicitly permits realtime phase/frequency steering and forward/backward jumps. The existing pre-correction Unknown patch handles Axiom's direct correction cut point, but does not demonstrate absence of external clock setters or establish quantitative ongoing PLL rate limits.

## Required concrete guarantees, not more generic ports

A usable new record must bind: exact I/O-origin lower anchor; source observation and parameter identity; outward-safe B and D calculations; same producer generation/disruption validity; a finite selected lifetime; and an actual quantified rate relation for the clocks used to age/sample/advance UTC. These must derive from the chosen source/native control implementation, not from user JSON, `clock_getres`, a callback named qualified, or the mere presence of a configured ppm value.

Conclusion: the precise I/O anchor is a concrete feasible way to remove the coarse-projection gap while retaining stock V2. It is NOT yet a complete solution for strict B/drift/rate/lifetime guarantees. The complete archive closes the source-location question; the next work is a reviewed finite source/protocol design using these actual hooks and arithmetic, not another source-read loop or a claim that raw capture alone supplies an admitted clock.
