# Independent native source review

Result: **two important corrections required**. No critical finding identified in this source review.

Reviewed exact manifest SHA256 `88a2d57c0539a51538b1216baa89ce4b8ecbd14bba1fa32110f4751d3077c96e`; all ten source hashes match its inventory. This reviewer performed file inspection and hashing only: no tests, compiler, native execution, network, host or provider action.

1. **N1 — original deadline is not revalidated after the native completion queue.** `time_operational_binding.c:68–76` accepts `t->success` based on N-API completion status and live context. A worker operation finishing before its original deadline may be delivered by the event loop after that deadline and still resolve authentic success. Add native monotonic checks at completion entry and after execute's final currentness work; clock failure or `now >= sample->deadline` must retire/reject through existing unpin/disposal. This finite check does not purport to prevent arbitrary suspension after the last instruction.
2. **N2 — post-startup discontinuity can recover inside the same accepted generation.** `time_operational_owner.c:200–201` accepts and ACKs non-Ready updates, then permits a later Ready. If a correction/invalidation and Ready cycle finishes between consumer CHECKs, the original source sees neither transition; forward correction need not trip realtime regression. After startup Ready, permanently retire on any Unknown/Disrupted/Withdrawn event. Preserve startup Unknown→Ready and routine Ready publication. Any required invalidation ACK may be boundedly sent before shutdown, without reaccepting the generation.

No separate minor findings. The original held/capture native type checks, same parent/hold association, REAPED/I/O completion gating, reference pins, original worker deadline propagation, CHECK-A/bracket/CHECK-B, one-use sample tag, fixed FD initialization, exact sequence/revision/generation tuple comparison and strict-policy-None separation were inspected. No additional confirmed important defect was found in those inspected paths.

Startup hashes with pre/post coherence and per-response held/named metadata checks are reviewed under the explicit trusted Linux/root premise; no full-file per-STATUS rehash or performance proof is asserted. Empty hash macros refuse by default. Full installed dependency closure, actual materialization/ABI/linkage, host/service/suspend qualification and production network profile remain explicit gates; the existing network-denying fixture filter must not be widened by this review. Genuine custody/fleet/provider/human/coverage and activation remain open.

Exact reviewed source hashes and structured findings are recorded in `NATIVE-INDEPENDENT-REVIEW.json`.

## Focused correction closure — v2

**N1 and N2 are closed in the reviewed local source.** Exact v2 manifest SHA256 `f9fa1e6d3da3a131b910f21103c64e899aca8062031042973247a3eaceffba75`; all ten source hashes match. N1 now checks the same original deadline at execute exit and actual N-API completion entry, preserving failed-result retirement/disposal/unpin. N2 latches withdrawal on post-startup non-Ready BEFORE bounded invalidation ACK, then exits before any consumer CHECK can be served; startup Unknown→Ready remains unchanged. Routine Ready publications remain eligible.

Saved V2-RED records two failures among thirteen SOURCE checks; V2-GREEN records thirteen passing SOURCE checks. Reviewer read these logs and did not rerun them. No native compilation/execution or actual timing/lifecycle acceptance follows. Original findings and reviewed hash inventory above remain historical; current exact source/evidence hashes are in `NATIVE-INDEPENDENT-REVIEW-v2.json`. All prior installed/native/host/network/custody/fleet/provider/human/coverage/activation gates remain open.

## Focused immutable binding and whole-budget closure — v3

**N3 and N4 are closed in reviewed local source; N1/N2 closure is preserved.** Verified exact v3 manifest SHA256 `ea80412e1827005f1f9c4410d7a4ff754ea59bf1a6f62a3bfcf8d34a98e7ec89` and all ten hashes. Context freeze is checked before reference/exposure; sample freeze is checked before the final ownership-transferring wrap, so freeze failure retains native disposal without finalizer double-free. The captured private no-argument begin method runs synchronously before raw hold. Its checked native monotonic +500ms deadline cannot be renewed while pending/active; sample admission clamps to the earlier begin/child deadline and execute/current/completion retain that bound. Successful current consumption/unpin clears it; retirement is sticky. Strict/raw parent source remains unchanged.

Inspected the saved N3 RED1/14→GREEN14 and N4 RED1/15→GREEN15 source-check logs, plus the joined wrapper log (12 passing tests). No reviewer rerun, native compiler/load/execution, clock experiment or network action occurred. These are source/simulated results, not native behavior proof. Exact current source, joined-wrapper and log hashes are retained in `NATIVE-INDEPENDENT-REVIEW-v3.json`. All previously stated real qualification and activation gates remain open.
