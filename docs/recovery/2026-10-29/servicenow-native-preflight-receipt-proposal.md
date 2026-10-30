# Bounded native-preflight reuse for associated ServiceNow evidence links

## Evidence
The live read-only inspector passed every current prerequisite for consumed child7292. Reported in-request checks were authority1118ms, credential4ms, journal2398ms, native3629ms, exact record93ms, final native3812ms and final authority1117ms. The execution path adds durable claim/history checks beyond the read-only inspector. A local controlled-clock test reproduces a pre-write final-authority timeout when each extra durable check is modeled at844ms (the observed saved-record phase). This demonstrates timing fragility, not the confirmed historical refusal cause.

## Local repair proposed
The trusted request composition already performs nativePlan before claiming a provider action. After that validation and its current-authority check both succeed, mint a request-local, one-use receipt bound to the complete candidate hash, current association reference and connection revision, expiring within15seconds and no later than the candidate deadline. It cannot be supplied by a client, serialized, saved, reused between requests or shared between candidates.

For associated evidence-note links only, transport may consume that receipt in place of its first duplicate native-model validation. It still performs current durable authority, credential validation, exact marker and absence checks, exact record reads, and the final fresh nativePlan plus current durable authority immediately before the one write. No receipt means existing full validation runs. Invalid/expired/changed receipts never skip a check. Publish and close paths are unchanged. No lease, execution deadline, scope, state transition or approval is extended.

This changes where one native validation is satisfied and therefore needs the user's validation-first boundary approval before implementation. Proposed approval is local code/tests only. No deployment, new note, child-chain recovery or automatic retry is included. Both consumed attempts remain unchanged. Any future live write requires a separately reviewed eligible recovery path and exact authorization.

Required tests: one-use binding/expiry/wrong hash/reference/revision; unchanged fallback and publish/close paths; final native or authority failure prevents mutation; measured timing-model reproduction passes only with a valid server-issued receipt while still making the final fresh native read; no valid receipt skips marker/absence/credential checks.
