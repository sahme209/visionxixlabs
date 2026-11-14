# Precise I/O-origin publication — concrete local correction design

Status: DESIGN ONLY. This proposes one finite source/protocol correction against the verified pinned archive, not a runtime clock qualification. Implementation, native compilation/execution, dependencies, installation, resource changes, credentials, deployment and spending are not authorized by this file.

## Selected mechanism and invariant

Axiom must use an actual precise `CLOCK_MONOTONIC` lower anchor read inside the exact source I/O operation BEFORE its first TSC read. Carry it with that observation and the resulting winning parameters. Never manufacture it at feed, selection, clock adjustment, SHM publication or reader time. Preserve stock V2 `as_of_monotonic`, its coarse compatibility semantics, V3 and PLL algorithm. Axiom's separately versioned publication will no longer require a coarse-to-precise projection.

This removes one concrete missing premise only. It does not prove source UTC accuracy, CPU drift, realtime/monotonic rate, kernel steering, quantization, or a safe validity duration.

## Actual files and changes

All upstream paths below are under the verified `clock-bound/src/daemon/` tree, commit371058f8f6a1786d4a4ab3eed9f5f2f16eea7777.

1. **`time/clocks.rs`**: add an explicit precise monotonic reader using the already selected Linux clock API. It returns checked nonnegative integer nanoseconds in signed64 range and fails on an OS/error/range failure. Do not substitute `MonotonicCoarse`, realtime, a log timestamp or `clock_getres`. Native reading remains unexecuted under a code-only grant.
2. **`event/ntp.rs`, `event/phc.rs`**: attach a distinct optional `axiom_origin` to the actual event, separate from the stock measurement. Define a crate-private immutable origin value carrying precise lower anchor and the original TSC-pre/post association, plus native source kind; construct it only in the real I/O module after verifying the same measurement's counters. Stock/replay constructors yield absent origin, not a default zero. No user JSON/deserializer/log can supply this value. Pure tests may use a test-only constructor.
3. **`io/ntp.rs:553–560`**: inside `inner_timeout`, read the anchor immediately before `read_timestamp_counter_begin`. Extend its successful return tuple and `sample_packet` handling at497–520 to carry that exact origin into `event::Ntp`. Keep the same anchor while discarding invalid/unmatched replies; never substitute a different exchange's anchor. Timeouts/errors produce no trusted observation. A pause after the precise read merely makes the lower anchor earlier, which is conservative for age.
4. **`io/phc.rs:878–900`**: inside the actual blocking closure, read the anchor before `counter_pre`, retain it alongside the ioctl's chosen measurement and `counter_post`, then propagate through `read` and event construction at500–528. Do not capture only outside `spawn_blocking` or after its completion. If multiple measurements compete, the winning sample retains its OWN origin; no independent newest timestamp.
5. **`clock_parameters.rs:18–31`**: add optional immutable Axiom origin to `ClockParameters`. **`clock_sync_algorithm/ff/ntp.rs:189–219` and `ff/phc.rs:194 onward`** copy the input observation origin into each newly calculated candidate. If a candidate is rejected as worse, retain the old parameters AND old origin; no timestamp refresh. `clock_sync_algorithm/selector.rs:46–80,171–180` already clones the whole parameters object into `SyncParameters`; test that the origin travels with that clone and source selection. No standalone lookup table keyed only by latest time.
6. **`logging/ffevents/types.rs`**: explicitly omit the new provenance from log schemas and set it absent in reconstruction, just as current reconstruction defaults coarse time at263–279. Update exhaustive struct patterns/fixtures across the verified source closure. Logs can explain events, never requalify captured origin.
7. **`clock_state/shm_writer/shm0.rs` and the existing Axiom adapter**: preserve stock snapshot construction byte semantics. Add a separate private Axiom publication input constructed from the exact selected parameters/origin and actual post-correction bound computation. Do not smuggle private fields through `ClockErrorBound::V2` or global mutable side-channel. The V2 wrapper continues compatibility delegation, but its Axiom side receives an explicit same-operation immutable publication object. Missing/invalid origin leaves Unknown, never reuses the last synchronized record. The previously approved mandatory startup/disruption/pre-correction invalidation stays in force; acknowledgement precedes correction and compatible continuation.

## Exact private protocol change

Introduce **`AXIOM_TIME_V2` / `clockbound-precise-origin-v1`**, a new twelve-line ASCII record, not an interpretation change to `AXIOM_TIME_V1 / clockbound-v2`:

1. magic `AXIOM_TIME_V2`
2. layout `clockbound-precise-origin-v1`
3. protected source generation
4. strictly increasing positive uint64 publication
5. precise I/O-origin lower anchor ns
6. precise monotonic exclusive expiry ns
7. outward-safe nonnegative bound ns
8. outward-safe nonnegative drift ppb (<1e9)
9. closed status (`unknown`, `disrupted`, `free-running`, `synchronized`)
10. actual uint64 disruption marker
11. actual disruption-support flag (`0`/`1`)
12. `END`, followed by final newline

All numeric fields use canonical decimal integer text; existing4096-byte cap remains. Unknown/Disrupted sentinels remain structurally bounded (anchor0/expiry1/bound0/drift0) and are rejected before usable-time arithmetic. The private publisher derives expiry by checked addition of the protected accepted maximum-age policy to the precise origin; do not copy vendor coarse+1000s or invent a default accepted lifetime. Missing lifetime evidence yields Unknown/refusal.

Update exact schema/codec and first-Unknown checks in `lib/governance/platform/nativeTime/record.ts`, `publisher.ts`, `source.ts`, `interval.ts`, and native `time_publication.c`/`.h`/Rust adapter together. Preserve explicit old-format decoding only for historical inspection; the new admitted precise path must require version2/layout and cannot relabel historical V1 records. Update C parser and all cross-language tests; never serialize Rust/C struct memory. The existing worker outer envelope must separately retain bytes/R/P0/P1/P2/file identity, not derive those from this payload.

Concrete ownership shape: replace the private Shm0 writer field with a closed enum `Stock(Box<dyn ShmWrite + Send + Sync>) | Axiom(NativeTimePublisher)`. Stock construction wraps its existing delegate in `Stock`; qualified construction consumes the same protected context into `Axiom`, which alone exposes the typed precise-publication method. Shm0 matches this enum at its existing actual write sites: Stock writes compatibility V2; Axiom acknowledges the matching precise record then writes that same compatibility V2. There is only one owned delegate and one counter. Update builder call sites/fixtures explicitly; do not downcast a trait object, expose a cloned publisher handle or split publisher/delegate across independently replaceable fields. This changes private source types, not stock wire/clock behavior.

The native immutable publication and compatibility write must be one owned operation: no opportunity for an async task or unrelated snapshot to replace its private metadata between acknowledgement and delegate. Choose a private typed `publish_precise_then_delegate(publication, compatibility_v2)` method on the existing owned adapter, invoked by the real Shm0 path; do not introduce a public generic grant or qualification callback. Invalidation uses its own closed typed operation.

## Conservative integer arithmetic

The original `time/tsc.rs:283–290` rounds skew to nearest integer ppb. Do not modify stock clients merely to satisfy Axiom. For the private coefficient, check period>0, error>=0, oscillator dispersion>=0, every input finite, and all results within explicit representable domains. Compute `ceil(1e9 * (dispersion + period_error / period))` outward from the actual represented values using checked exact rational conversion of the finite IEEE inputs, rather than `round()` or a guessed epsilon. Reject overflow and a result>=1e9; reject missing/invalid input rather than saturating. This protects conversion rounding of represented inputs; it does NOT prove those estimated floats upper-bound physical drift or contain all upstream numerical/model error.

Retain the actual source bound derivation and measure realtime offset/RTT only after correction, but audit all divisions/float-to-integer conversions on this selected path for outward rounding. A nonnegative half-RTT should round upward for Axiom when odd. Do not assert that one final ceil repairs all upstream statistical/model error: the protected accepted source/numerical evidence must cover B and D as upper bounds. If not available, the design remains unusable for admitted execution regardless of passing synthetic arithmetic tests.

## Concrete qualification evidence still required

The actual protected qualification profile must bind the exact daemon/patch/Node/addon/kernel/host/source configuration and accepted source-bound/numerical evidence; generation/owner/descriptor/lifecycle/disruption controls; precise read quantization assumptions; positive bounded realtime-to-monotonic progression during the selected maximum age and final P2; and the accepted finite lifetime. These are independently accepted evidence records held by the real protected initializer, not request-created values or booleans. No guessed lambdaMin/lambdaMax, “getres means accuracy,” default15ppm, vendor1000s or fallback wall clock.

If any premise is absent or stale, the actual supplier refuses; raw source capture and local tests cannot mint it. Source/OS rate and external-clock-writer control remain explicit real acceptance work, not another abstract callback implementation.

## Finite local verification after approval

Use exact-source patch application plus intercepted/source-derived tests: anchor before actual NTP/PHC counter-pre; same tuple/sample through event; long queue delay; source switching; worse/rejected candidate retaining old origin; missing/replayed/log origin refusal; Unknown-before-correction; post-correction same-operation publication; unchanged stock coarse V2/V3; exact versioned TS/C/Rust wire; nonfinite/negative/extreme/exact/fractional rounding, odd RTT, overflow, lifetime and first-Unknown failure paths. These tests establish code/order/arithmetic, not native clock correctness. No further public-source acquisition is necessary for this design.
