# Private bootstrap: concrete remaining kernel boundary

Current local source inspection, November 2, 2026. No network, build, native
generation, provider action, or positive issuer identity was performed here.

`packages/verified-issuer-runtime/index.cjs` has a single canonical main/read-only
consumer seam, but deliberately no active identity. The strict internal CJS file
verifier exists. `inspect-launch-controls.cjs` correctly leaves pre-import and
sandbox qualification unavailable. The Python launch path refuses before Next.
The earlier owned readonly-image and child sandbox probes establish their stated
controls only; their receipts are not capabilities for another process.

The missing condition is actual process-local enforcement before importing the
compiled issuer, including protection against writing the readonly image's backing
file. A child cannot establish this by accepting its parent's JSON, environment,
boolean, or pathname claim. A readonly mount alone does not prove backing-file
write denial, and checking environment after Node starts cannot undo a preload.

Local SDK inspection found `sandbox_init` declared in
`/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk/usr/include/sandbox.h`, explicitly
deprecated as no longer supported (macOS 10.5–10.8). That public header does not
declare `sandbox_check` or its filter constants. The system sandbox dylib exports
the latter symbol, but its ABI was not guessed or invoked. Builtins-only CJS has
no corresponding enforcement primitive. Current host build is `26B123`; compiler
observation is Apple clang 21.0.0. Neither observation qualifies a supported launch.

A concrete next design to review is a minimal package-bound native bootstrap
component, called only by lexical main after verifying its own sealed package and
before Next imports. It would apply actual restrictions inside the same process,
instead of trusting a parent assertion. A deny-all-file-write profile with narrowly
bound non-executable mutable data could protect backing files without trusting a
caller-supplied image pathname. Exact native API support, mutable-data permissions,
runtime/native dependency closure, loader isolation, and positive/negative actual
OS tests would all require review. No addon, arbitrary profile port, unsupported
ABI call, initializer, or authority variant was added in this increment.

This is a proposed new native bootstrap prerequisite, not a claim that deprecated
Seatbelt APIs already provide the approved complete profile. Until a supportable
same-process mechanism is reviewed and qualified, actual bootstrap identity remains
unavailable. A mechanical fixed-entry child launch could be implemented separately,
but would still not close this identity boundary; it is not substituted here for
the requested private compiled-consumer proof. Fleet, legacy, activation, and
execution qualifications remain unavailable.

Review correction: the subsequently inspected SDK contract requires
`SANDBOX_NAMED` (other flag values reserved) and rejects an already-sandboxed
process. The arbitrary profile possibility above is not a supported public-API
implementation plan. The corrected `governance-native-bootstrap-proposal.md`
limits the proposed first experiment to fixed `kSBXProfileNoWrite` feasibility,
with no network/process-denial claim or chained-profile assumption. No native
implementation or identity was issued from the earlier possibility.
