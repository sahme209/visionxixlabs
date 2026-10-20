# Pinned Next RSC header/cache-hash proof — inert source execution

Two tests execute the actual installed Next 16.3.8 cache-hash helpers, the exact
extracted server hash-validation branch and the exact extracted client createFetch
function. Fetch, browser redirect-following, response processing and decoding
boundaries are fake; no HTTP, listener, process, browser, app, provider or database
runs. Server metadata is absent, the request is explicitly synthetic RSC, and
client decoding is disabled and guarded by a throwing stub. The tests verify
actual default validation enablement and its client build-flag mapping.

The initial prediction that fully stripped routing headers cause 21 fetch calls
was disproved by the installed code: the real result is 2 client fetch calls and
one server 307. With no hash-input headers, the server redirects to bare `_rsc`.
The actual client replay helper removes only `_rsc=` pairs, retains that bare
parameter, then appends its original nonempty hash. URL.searchParams.get reads
the first empty value, matching the server's empty expected hash; the second
fetch is accepted. The regression explicitly checks this bare-plus-hashed replay.
Preserving all routing headers yields 1 fetch and 0 redirects.

A second test partially preserves Next-Url while dropping router state. Both hash
values are then nonempty. The actual server/client functions perform 21 fetch
calls and 21 server redirects: the initial request plus the client's bounded 20
replays. This demonstrates why an incomplete header repair is unsafe to assume
correct. No proxy behavior or configuration is changed by this proof.

These results establish a protocol mismatch and replay behavior under fixed
synthetic headers, not the cause of the recorded documentation timeout. In
particular, the current fully stripping proxy does not match the 21-replay case.
A real sanitized navigation receipt is still required. No network guard, RSC
validation, router assertion, timeout or application behavior was relaxed.

Final validation: 2 inert tests pass; scoped ESLint and whitespace checks pass.
The original disproved assertion is retained in `/tmp/axiom-rsc-header-replay.log`;
corrected evidence is `/tmp/axiom-rsc-header-replay-corrected.log`.
