# Bounded observed endpoint-candidate parser

Source-only candidate normalization under existing local quote design approval.
`parseCodingEndpointMetadataCandidate` has no caller in the quote/coordinator/
manager/provider path and returns no opaque capability or trusted pricing type.
Every output says `qualified:false`, `quoteEligible:false`, and enumerates the
remaining provenance/estimator/output/freshness qualification gaps.

One saved approved metadata response is read locally by tests. The parser copies
bounded raw bytes before hash/strict UTF8 decode, refuses shared-memory input,
rejects duplicate JSON keys after escape decoding, bounds JSON depth/node count,
and rejects unsupported schema/rate/route shapes. It records only observed maxima
for the selected Anthropic endpoint and its explicitly advertised regions. It
neither establishes that region enumeration is exhaustive nor assigns an official
meaning to status0. ZDR/training flags are not returned as security claims.

The actual snapshot carries nonzero search/cache charges and therefore returns
explicit quote-contract rejection reasons. Synthetic zero-fee modifications can
produce an observational candidate with no fee rejections, but never eligibility.
Regional price shape requires every supported regional token/cache field;
nonzero base ancillary fees stay rejected across all regions. There is no new fee
applicability assumption, source fetch, inference, pricing-guarantee/expiry claim,
production integration, database change, push or deployment.

Evidence:
- red.log: setup failure, module missing; NOT behavioral RED.
- behavioral-red.log: minimal unavailable stub;7 failed/23 passed.
- green.log: initial30 cases passed.
- green-final.log:39 cases passed after additional finite contract cases.
- types-final.log: strict ES2017 module types pass after literal-only type fixes.
- receipt.json: exact source/test/raw-observation hashes and limitations.

Focused tests ran once per meaningful implementation/test change under a kernel
sandbox denying network and repository writes, with env-i, private HOME/TMPDIR
and separate owned cache. The test-root.txt file identifies that owned cache;
no old fixture, database, real credential or provider was used.

Final determinism correction: a targeted two-region test observed host collation
ordering `test_1` ahead of `test-1` (ordinal-red.log:1failure/39excluded). Sorting
now uses explicit UTF16 code-unit comparison of canonical serialized records,
without localeCompare. The justified exact-source rerun passes all40 cases
(ordinal-green-full40.log); strictES2017 module types pass in
`types-ordinal-final.log`. receipt.json contains the final source/test hashes.
Earlier39-case evidence remains historical and is not the final-source total.
