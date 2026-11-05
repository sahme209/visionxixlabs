# Native ingress implementation tasks (pending decision; no implementation)

Source inspection/plan only. No code/tests/compile/OS calls performed. Implement only after the joined IMPLEMENTATION-REVIEW decision; current operational/source gates remain unchanged. Follow the reviewed native-ingress-design, existing six-operation envelope and canonical identity design; no new channel/authority mechanism is selected here.

## Partition 1: pure business-state model and wire grammar

New `packages/verified-issuer-runtime/native/request_protocol.h/.c` plus `native/tests/request_protocol_test.c`. Keep `origin_runtime_protocol.*` unchanged. Types: one `AxiomRequestSlot`, enum absent/admitted/dispatched/completed/cancelled/expired/unknown; native-created id, original desktop connection identity, consumed child connection identity, epoch, absolute monotonic deadline, bounded payload/response counters, pending fresh-arbitration nonce, terminal/completion-consumed flags. No raw JS/user field can populate trusted peer/child/current-origin facts.

Internal functions admit/dispatch/cancel/arbitrate/complete/revoke accept facts produced by actual native callers, not public decoding. All transition functions require current monotonic time and exact connection/epoch/id. One outstanding slot, zero queue. Fresh arbitration serializes against cancellation and permanently rejects terminal/expired work. Terminal response/notification consumers drain once; no duplicate dispatch or automatic replay. Preserve history semantics outside this model.

Strict wire namespace `axiom.issuer-owned-request/1`, separate from existing origin op schemas. Define finite message kinds request/cancel/request_current/request_current_result/response with exact key/type/count validation. Request carries native id/epoch/deadline + <=4096 envelope bytes; response carries bounded status/body; current exchange carries private native fresh nonce and returns exact matching id/epoch/nonce plus eligible/refused. No arbitrary endpoint/root/header/resource/callback fields. Original origin begin/ack/live messages remain byte/schema compatible.

Pure tests: invalid type/extra keys; wrong epoch/connection/id; bounded sizes; one-slot overflow; cancel-before-arbitration; arbitrate-before-later-cancel (no impossible rollback claim); duplicate/late completion; timer/clock failure; teardown; terminal references cannot resurrect slot. Treat actual peer authentication as stubbed input here, not qualified evidence.

## Partition 2: broker bridge

`native/origin_broker.c` owns the new state and fixed request listener `com.visionxixlabs.axiom.issuer-request`. Separate request peers/jobs from origin Peer.busy/MAX_JOBS so a 25s handler cannot queue/block the 250ms origin challenge. Extract a narrow native helper only if needed for pure tests; do not introduce another executor.

Authenticate each external sender via actual message code identity against selected installed desktop requirement. Validate external cancel correlation against its original connection, not an id alone; durable `cancel_execution` remains ordinary six-op business input. Send only to the existing consumed slot.peer and still-owned unreaped child/epoch. Handle new child response/arbitration namespace in a distinct dispatcher before the unchanged origin handle parser; authenticate actual sender and exact current connection/SELF using existing native trust model. Broker control serialization is the arbitration linearization point. Uncertain connection/child/currentness revokes eligibility; no reconnect/adoption/resend.

Mock-only tests exercise actual dispatch function with stubbed XPC/message identity/clock/owned-child facts: wrong sender/connection, cancellation while JS delivery delayed, no blocking origin lane, reply loss/late completion, one-slot overflow and teardown. No real XPC/Keychain/helper/service path in tests.

## Partition 3: owned native session and N-API data bridge

`native/origin_session.h/.c` retains the same authenticated origin connection. Current event handler invalidates on every unsolicited event; replace only with strict accepted business namespace, actual broker-message identity and captured epoch/SELF checks; unknown/error events still revoke. Keep begin/ACK/live exchange and independent sync-origin budget unchanged. Add internal next-event queue capacity1, terminal notification, response send and fresh request-current exchange. Queue delivery on private dispatch/N-API main-thread notification; retain exact native session until callback cleanup. No calls into JS while holding broker control or while JS synchronously waits for native assertion.

`native/origin_guard.c` captures this NativeOrigin in the existing fresh constructor and proposes the three reviewed data functions alongside existing assertCurrentOrigin/consumeBootstrapResources:
- `nextRequestEvent(): Promise<RequestEvent>`; zero args, one pending waiter. Request event contains opaque native id and copied envelope bytes; cancellation event contains that id only. Native deadlines remain native, not caller-settable.
- `completeRequest(id, responseBytes): void`; exact id + bounded serialized response data only. One completion per dispatched request; native parses fixed status/body framing before emitting response. It cannot create a slot or execute another operation.
- `assertRequestCurrent(id): void`; bounded fresh broker request-current exchange, exact id/epoch/connection/nonce/deadline and actual broker reply identity; throws on refusal/timeout. Child cancellation-cache/global origin-live are insufficient.

N-API parses only fixed types/arity, copies bounded buffers, freezes exports and permanently revokes on origin loss. Teardown rejects pending Promise, invalidates outstanding request and cleans notification references once; queued late callback cannot access freed native state. Sync assertion uses a distinct native worker queue rather than a JS callback. Stubbed N-API/XPC tests: malformed args, concurrent waiter, cleanup races, oversized buffers and assertion timeout; no live N-API loading required in this local unit.

## Canonical/TypeScript consumption contract

Root owns index.cjs/index.d.ts/bootstrap/private composition. Canonical privately captures exact frozen functions; public canonical export remains only readIssuerIdentity. Request loop builds one AbortController/id binding, invokes existing fixed data dispatcher and returns bounded reply. Trusted per-request closures invoke captured request-current guard before claim, credential exposure and final send; no envelope field accepts that closure or a verifier. Closing lifetime disables dispatch first, aborts/invalidates native eligibility and disconnects once. Current artifact identity remains independent from runtime/fleet/action authority.

Implementation detail requiring root alignment before code (not new authority): responseBytes encoding must preserve existing `{status:number,body:Uint8Array}` without inflating the 262144 BODY-byte cap or logging secrets. Use one fixed status+length binary header plus body, not arbitrary JSON/proxy headers; freeze exact header width/endianness and test bounds alongside canonical serializer. Native id concrete representation should be one fixed opaque native-random width, with exact Node/native parser agreement. Neither value is proof or caller-minted authority.

## Source closure, compile-only recipes and finite verification

Add new pure protocol .c to broker AND guard role source arrays in `scripts/governance_local_issuer/system_preparation.py`; its included header is discovered/bound with full source closure. Existing `_recipes()` supplies `/usr/bin/xcrun clang -std=c11 -Wall -Wextra -Werror -Wno-deprecated-declarations -fblocks -mmacosx-version-min=13.0`, fixed config include and framework flags, guard Node-header/bundle flags. Generate new recipes on fresh approved preparation only; never mutate old stages or reuse old signatures as new-native proof.

Planned pure command: `clang -std=c11 -Wall -Wextra -Werror native/request_protocol.c native/tests/request_protocol_test.c -o <owned-test-output>` then only that pure test. Stub native compilation uses existing fixed test harness and stub SDK functions, not real Security/XPC/resource entry. Exact production compile-only argv must come from fresh system `_recipes`, not a hand-edited old artifact. This plan authorizes none of those commands.

Runtime package.json files allowlist remains index/types/README/internal verifier/generated origin_guard.node; new native C/header sources are build inputs, not loose runtime payload. `system_build_inputs.py` consumes System source inventory and fixed generated paths; extend associated source-closure tests, not role names or runtime identities. Do NOT edit legacy native_overlay.py/historical receipts or silently route legacy to System. `scripts/emit-private-release-bootstrap.cjs` still externalizes canonical package and emits actual private graph. Future source archive/package must bind changed index/types/guard/broker/bootstrap and same real compiled consumer; existing signed artifacts remain immutable/unqualified for new code.

Finish one combined focused test selection/scoped types/compile-only review after component RED→GREEN. Local mocks prove source behavior only. Actual XPC namespace/message routing, N-API lifetime, installed principals/material/custody, real origin and SAME-compiled-consumer matrix remain later exact operational gates; no root/install/service/key/provider or full-package rebuild implied.
