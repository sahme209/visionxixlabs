# Independent review — precise I/O-origin correction design

Verdict: CLEAR for an owner decision on the stated finite LOCAL SOURCE / PURE-MOCKED TEST unit. This is not approval or evidence of a connected qualified native clock. No additional public-source search is needed to specify these changes.

## Source-grounded and implementable

- The chosen anchor is at the real I/O boundary: saved complete `daemon/io/ntp.rs` inner_timeout begins its original TSC read before send; `daemon/io/phc.rs` takes pre/post counters inside the blocking ioctl closure. Inserting precise monotonic before those first counters and carrying that same tuple is concrete. Capturing outside the blocking closure, at event enqueue/dequeue, feed calculation or publication would not implement this design.
- Adding a distinct optional non-deserializable origin to actual events/ClockParameters and retaining it through the selected parameter clone addresses the actual queue/selection path. Missing/replayed/log-created provenance stays absent; rejected candidates must not refresh the winning origin. An earlier anchor increases age conservatively; it is not a claimed tighter point-time estimate.
- The closed Stock/Axiom writer enum and one typed same-operation publication/delegate method make ownership and compatibility concrete. They avoid a mutable global provenance lookup or separately replaceable publisher/delegate. Startup/disruption/pre-correction invalidation stays mandatory and cannot depend on a usable snapshot or accepted lifetime.
- New magic/layout version2 prevents reinterpretation of historical coarse V1 fields. Old historical decoding may remain, but admitted precise composition must select only the new format. C/Rust/TS must share exact line count/domain and status refusal; raw struct memory remains forbidden.

## Numerical assurance limit — preserve explicitly

The actual `ClockParameters::time_at` and related upstream model paths use represented float-derived periods. Exact rational conversion plus outward ceiling of the represented dispersion and period-error ratio protects THIS coefficient conversion; it cannot prove those estimates cover physical error or prior floating/model rounding. Likewise ceiling the nonnegative half-RTT fixes odd-integer truncation only. It does not repair time_at, period/model error, timestamp quantization, source truth or continuing kernel discipline automatically.

The design already states this limit and holds source/numerical B/D evidence, rate/lifetime/quantization and native runtime qualification. Implementations and receipts must retain that distinction. A synchronized status with a precise anchor is insufficient to mint an admitting clock/profile. Missing accepted bound/rate/lifetime evidence must yield Unknown/refusal, never an invented default or no-op qualifier.

## Scope/actionability conditions for the implementation plan

Freeze the exact source patch inventory and introduce the private precise-record type as a separate discriminated version before coding. Name how stock builders/fixtures are preserved and how only the qualified Axiom writer consumes the new object. Use checked finite representations for exact IEEE rational conversion; an unrepresentable rational is a refusal, not permission to add an unreviewed dependency or silently round. Retain the original counter/generation, single operation and nonreturning publication failure path.

Local tests should bind actual patch/order and call the real codec/arithmetic implementation. Avoid test-owned orchestration loops as evidence of Rust control flow. Native compilation, actual source/clock calls, foreign dependency execution, process/host/source supervision, resource changes, real premises, supplier enablement, credentials/provider actions, SQL and deployment remain separately held.

No material contradiction or invented supplier was found in the current design. It closes the coarse-to-precise origin gap as SOURCE PREPARATION only; remaining physical/model/rate/lifecycle guarantees are not waived or counted complete.
