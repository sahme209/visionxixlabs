# Native execution-limit review and read-only recovery — local increment

The still-unregistered Governance prototype now mounts an execution-limit panel for a verified paired identity. It deliberately makes no request on mount. Readers deliberately load an exact saved policy; reviewers must explicitly acknowledge the exact scope, numeric ceiling, actions, named executors and expiry. Requester and named-executor self-review is disabled in presentation and remains independently refused by the durable server.

Administrators may read an exact current pointer, then activate only a matching-parent approved limit policy or revoke the loaded exact revision. Server role, session, expiry, independent-review, nonce and CAS checks remain authoritative. Active limits do not authorize provider actions or enroll a baseline. Expired policies cannot be approved/activated in the panel.

The strict native DTO/client facade validates closed policy/revision/activation/pointer/lookup shapes, exact version/digest/content and original nonce bindings. The fixed paired transport explicitly distinguishes POST history reads from mutations for cancellation and uncertain outcomes. Pointer history now includes the exact selected scope, allowing the client to reject swapped-scope responses. No browser-supplied execution authority or arbitrary endpoint is accepted.

A pending mutation is held and displayed with its original nonce in the current panel. Its recovery button performs only historical lookup. A found historical result clears displayed policy authority and requires a fresh policy/pointer load. Missing/unconfirmed records never trigger resubmission. Late results after workspace/account changes are discarded. Pending UI recovery state is currently memory-only: restart/unmount recovery and a discoverable policy directory are still unfinished and must not be claimed complete.

## Verification

- Initial client and component stub tests failed before implementation.
- Final focused batch:52 checks passed across five files (new client/panel, existing Governance client/view, updated store). No unique whole-product test count is implied.
- Desktop TypeScript and frontend production build passed. The frontend reports its existing large-chunk warning; bundle size optimization is not claimed complete.
- Scoped server types include the actual route and the pointer-scope addition.
- Independent source review found no important issues before the final additional negative tests (no subsequent functional change).
- No signed/native visual acceptance, real user decision, provider read/write, production flag, schema, deployment, paid CI or public installer publication.

## Remaining core workflow

Native policy proposal authoring, discoverable saved revisions/principals and durable pending-request recovery; complete verified executor coverage; transactional baseline enrollment; actual composed enforcement journeys and subsequent exact full production/native builds/review. The current Settings preview remains deliberately read-only. No full Governance MVP claim.

Evidence: /private/tmp/axiom-policy-native-final-{tests,types}.log, /private/tmp/axiom-policy-native-frontend-build.log, /private/tmp/axiom-policy-native-server-types.log. The last full production build852e predates recovery4f9 and this delta; current full batch build remains required before activation review.
