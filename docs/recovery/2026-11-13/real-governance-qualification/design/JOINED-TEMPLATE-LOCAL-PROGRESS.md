# Joined template timing — local partial checkpoint

Owner grant: call_89eb4532167a4e55b4c65c38f8fe44cc, local integration and simulated tests only. Existing approved design and immutable histories remain binding.

## Changed
- `executionTime`: optional private participant restrictions intersect captured original bounds; neither original nor extra malformed timestamps can be hidden; one-use successful-check, retirement, cancellation and acknowledged authorization remain mandatory.
- `principalTime`: reuse the exact session-row lifetime reader without separately reading a different clock for each participant; original role/membership/possession checks remain separate.
- Template execution intersects locked requester/reviewer lifetimes and original approval. Actual SDK HTTP handling now gates after asynchronous preparation, inside the original final locked authorization owner, before dispatch. Original admission/reservation are not repeated.
- One-use link delivery also intersects stored hard URL expiry before key copying/decryption/output. Source/profile/current key/channel/people checks repeat after the clock await. Historical confirmed/unknown records and consumed claims are never reset.
- Private request composition captures one clock supplier and carries the original request cancellation signal. Missing signal/source refuses execution/output; existing nonsecret history remains separate.

## Evidence and correction
- Six initial additional-window tests failed behaviorally, then passed; an additional malformed-original test caught an invalid bound hidden by intersection and was fixed without weakening assertions.
- Two native-port tests reproduced ignored approval interval and omitted successful-check acknowledgement.
- Real installed-SDK tests intercept only HTTP: without the actual final-handler gate, late expiry/revocation allowed one outgoing simulated write. The corrected gate allows zero, while a valid command sends once and cannot replay.
- Joined memory-store/reservation/outcome/SDK tests cover accepted once and final reviewer-expiry -> original UNKNOWN/no write/no replay.
- Independent review identified source/profile/key/channel revocation during the final clock await. The send regression first observed one write and now observes zero plus one unknown. Delivery tests use real context/claim/crypto kernels and inject revocation at every observed clock await; removing the final post-clock checks reproduced three usable-output leaks. Restoring the checks blocks all cases. Same reviewer reports no remaining important issue in this slice; source review only.
- Final focused: 72 passed across 8 files. Strict root TypeScript passes. Full ordinary: 18,985 passed, zero failed tests/suites, 1,142 pending of 20,127. Broad run preceded a test-only S3 response content-type typing correction; the affected 9 cases and all72focused checks passed again afterward. Existing Vite native-loader warning is retained.
- No actual SQL ran. Existing PostgreSQL fixtures now carry explicit synthetic clocks/signals; they remain opt-in/skipped under the current grant. No native build, signing, real runtime or live provider/security acceptance.

## Remaining gates
This is a partial local source integration, NOT full Governance or native qualification. Template held credentials currently have no expiry metadata; explicit expiry binding remains required. The signing clock is still an unqualified separate native/profile obligation. Other source-acquisition/image/post/schedule/manual clock consumers and transitive/participant consistency need completion. Actual source/time/custody/fleet qualification, SQL journeys, genuine independent people and provider end-to-end validation, frozen build/green PR, production schema/recovery and owner enablement remain open. No default issuer/clock/profile was qualified or enabled. No push, deployment, production change or spending occurred.
