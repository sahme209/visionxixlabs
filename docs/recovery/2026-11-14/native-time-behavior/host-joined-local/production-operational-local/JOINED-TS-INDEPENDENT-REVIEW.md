# Independent joined TypeScript graph review

Verdict: **ONE IMPORTANT FINDING; correction required.** No critical finding. Review is independent of the TS implementation author and limited to the approved local source/simulated-test unit. No tests were rerun.

## TS-P2-1 — Original expiry eligibility is checked after fresh native acquisition

`lib/governance/platform/operations/operationalClosureSource.ts:38–45`: `assertReadAllowed` validates the time/native context and calls the native eligibility port, then grants a digest permit. It does not establish that every recorded source/derived lease is issued and present with exact original provider expiration in its private metadata registry. `readEvidence` consumes this permit and immediately calls `captureEvidence`; only afterward do the status and registry checks run.

A pending/unknown acquisition or missing/mismatched private expiry record can therefore invoke the fresh native capture and only then refuse. This is not a claim of unsafe successful closure: the later checks retain the liability. It violates the approved pre-acquisition requirement and performs fresh native acquisition for an ineligible original scope. The original closure store has no preceding registry check; it invokes `source.assertReadAllowed` then `source.readEvidence`.

Finite fix: extract an exact original-expiry eligibility preflight covering status, provider, scope, lease, expiration, manifest and issuer profile. Run it in `assertReadAllowed` before granting permission and repeat immediately before `captureEvidence`; keep all postcapture native scope/receipt/currentness checks. Intercept pending/unknown and missing/mismatched source/derived metadata and require zero capture calls/no original owner event, while preserving eligible positive behavior.

## Reviewed joined behavior

The JSON receipt lists exact current hashes for 35 inspected implementation files. Reviewed original source and derived expiry registries, operational closure source/compiler, common exact-ns predicates, strict compiler compatibility, snapshot/SQL/history/summary/browser DTOs, closure owner and original drain protocol, event assurance, Linux/workload composition, changed real consumer helpers and legacy template flows. The SDK independent report is reused for the signing slice; native C/Rust independent review remains separate. Pending native wrapper beginObservation/interface/deadline qualification is explicitly excluded from this review verdict.

- Operational closure compares exact nanoseconds strictly greater than credentialNotAfter; equality refuses and no millisecond padding/fake physical interval appears. Saved format2 uses distinct ID/purpose/assurance, explicit physicalUtcClosureProven=false, and immutable historical-only labels. Strict format1 body/digest construction remains unchanged.
- Unknown/unproven/static/missing metadata cannot successfully compile operational closure. Native complete inventory/quiescence/cutoff is a required original bridge responsibility; time and registry presence cannot invent it. Empty local rows alone do not establish complete native cutoff.
- Actual source assertCurrent requires the original privately issued evidence hash and original native scope identity/currentness; serialized history alone cannot authorize abort. The drain adapter preserves the original base abort-safety callback. Both original abort-safety checks and both original no-intent checks remain, with final time/source/authority checks after tentative events inside the same transaction. SQL validates original barrier/snapshot lineage across the admitting transition.
- The operational constructor feeds one captured source through custodian, JWT, runner, STS/ECS and the closure adapter. Strict/operational constructors remain separate; JOSE crypto plus DB currentDate/zero tolerance remain alongside exact original JWT/action windows. Unsupported real defaults remain unavailable.
- New event assurance attaches nonsecret serializable metadata via original owner/check associations; public projections expose historical assurance/profile only. Existing plan/state digests and old history are not rewritten. The summary cannot become execution proof.
- Tracked template prepare/current/preview/review paths check selected profile windows and actual participants around original waits and mutations; prospective reviewer checks precede preview/approval, and last source-window equality follows clock/authority work. Legacy generic template prepare/preview now require private time and current sessions; generic original claim/send restrictions persist. Changes in image/settings/workload/ECS/manual helpers preserve original windows and callback completion.

## Minor/limits, separate from findings

The original closure source interface captures its composition signal rather than receiving the per-request observation signal in readEvidence. The owner still checks request cancellation/possession around reads and refuses late output; native capture cancellation currently follows the composition signal. This interface limitation predates the new branch and no new successful-authorization defect was established; it is not counted as a second important finding.

A fully composed real native closure bridge, real fleet/custody/expiry provenance, actual DB/provider/host/human qualification, target ABI and activation are explicitly unqualified dependencies, not fabricated current source defects. Frozen intercepted tests and source review cannot close them. No compiler/native/SQL/network/provider/CI/dependency or spending operation, code edit or commit occurred. Only these review artifacts were written.


## Correction appendix — TS-P2-1 CLOSED by focused source review

Current correction source SHA256: `0fb7f8c90cd2d8dac2b010b40b007b3ed2c38edfbfd4b5262fbbfdc563135d3d`. Current source-test SHA256: `4c458439137f8aa0bddc4fdcf9c9fe12c9d3e1f0df8175db4e1b91c29bc68e76`. Original review/source hashes and finding above remain preserved as historical evidence.

The actual correction adds synchronous `originalExpiries` parsing/capture of each original source+derived issued lease and exact provider/scope/lease/expiration/manifest/profile. `assertReadAllowed` resolves these before time/native eligibility and repeats equality afterward before granting permission. `readEvidence` consumes the original permit then synchronously revalidates metadata BEFORE `captureEvidence`, with no intervening await. It retains native scope/receipt/currentness checks, repeats original metadata after capture and later time/currentness, and binds the metadata digest into privately issued evidence for subsequent original abort checks. Unknown or missing expiry therefore refuses before fresh capture; no additional authority/attempt/expiry was introduced.

The actual saved RED log shows 2 failures / 6 passes, specifically unknown original slots and disappearance after a granted permit reaching forbidden capture. The saved GREEN reports 27 passes / 3 files. Test source asserts zero native capture in both cases. These are intercepted/simulated tests; no test was rerun by this reviewer.

RED SHA256 `4ace48f06fb231fa557ebbf88204c671d3f12e6fc944379256c6d1521f236a13`.
GREEN SHA256 `9b3dc3ee33364cb4969304337ea5b9f51ef289047525626a46d7ee6ff70de4f2`.

Focused correction verdict: **CLEAR; TS-P2-1 closed, no remaining critical/important finding in the reviewed TS slice.** Native wrapper/C v3 acceptance remains the separate independent review; this appendix does not claim a new native/SQL/provider/whole-suite run. Existing composition-versus-request signal limitation remains separately documented and unchanged.
