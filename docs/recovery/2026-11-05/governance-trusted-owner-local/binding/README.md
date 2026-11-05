# Native owner protocol/broker source preparation

Original selected model retained: actual native per-message owner requirement, privileged bootstrap lookup, native SELF equals intended unreaped owner child, private challenges/connection and fresh strictly increasing live sequence. No unsupported kernel sender getter, JSON authority or reconnect. Operational flag remains literal0, requirements/UID/GID/lifetime missing by default refuse. No customer/resource qualification follows.

## Source and bounded evidence

- Pure actual owner_protocol.c server/client state tests: initial refusal stub compiled then failed assertion exit134; implemented sanitizer test passed. Exact generation, private peer/challenge, deadline, journal-before-child, stale sequence, wrong SELF, unauthenticated response, lifetime loss, late response and duplicate request paths are covered by actual pure decisions with simulated native observations.
- Actual private native response validator:16 cases passed with all reached Security/XPC/clock/process calls replaced by inert test functions. `nm -u` before invocation contains ONLY assert/puts/strcmp. Separate test-only mutation removing response-deadline guards failed134. These validator tests were added after source; mutation sensitivity is not a claim of test-first development for the complete native transport.
- Actual default-closed binding entry compiled with dead stripping: zero native Security/XPC/dispatch imports (only assert). Its startup/current refusal paths ran with no platform API call. This supplemental test was added after source, not a TDD claim.
- Source-order regressions: owner startup precedes ANY supplier startup, worker/delivery guards and supplier per-item context retain fresh owner checks, late signature validation cannot accept after its request deadline, and ECHILD never becomes successful reaping. Separate observed RED failures preceded those corrections; final6source checks pass. Source assertions are not runtime/native qualification.
- Supplier installation_context remains operational0 first, then owner current. Lookup/inspection/read paths use it; original Security callbacks remain inert in the affected derived read test. Initial test-only link failure (new owner function lacked mock) is preserved; explicit aborting mock was added and fresh evidence directory run passed original valid3read/27bounded refusal cases. Historical November5 adapter receipts were NOT overwritten. Derived runner now requires a fresh --evidence-dir, preventing accidental historical overwrite.
- Actual native binding, broker and supplier compile with strict C11/ARC/fblocks flags where applicable. Objects are0600 and never executed. Real transport handshake/callback/race behavior is compiled source only, NOT accepted from the pure tests.

No actual Security/Keychain/XPC/process/privilege/service call, Node execution, root state operation, provider/network/deployment/spending occurred in these tests. Produced operational binaries must remain unexecuted; source activation and all master acceptance gates remain closed.

Reproduction commands (not automatically rerun):

```sh
clang -std=c11 -Wall -Wextra -Werror -fsanitize=address,undefined packages/verified-issuer-runtime/native/owner_protocol.c packages/verified-issuer-runtime/native/tests/owner_protocol_test.c -o <owned-test-path>
clang -std=c11 -fblocks -O2 -ffunction-sections -Wall -Wextra -Werror -DAX_OWNER_REQUIREMENT='"synthetic-test-requirement-not-authority"' packages/verified-issuer-runtime/native/tests/owner_binding_validation_test.c packages/verified-issuer-runtime/native/owner_protocol.c packages/verified-issuer-runtime/native/tests/owner_xpc_type_mocks.c -Wl,-dead_strip -o <owned-test-path>
python3 packages/verified-issuer-runtime/native/tests/test_owner_broker_integration.py
python3 packages/verified-issuer-runtime/native/synthetic_supplier_read_mock_test.py --evidence-dir <fresh-owned-evidence-path>
```

Final source-review correction: both startup/current trylock refusals now permanently revoke the native binding before returning0; a failed check cannot later resume. One focused source regression RED1→GREEN1 and strict native client compilation passed; no real lock/transport API was invoked. Earlier six source checks were not repeated for this literal branch correction.
