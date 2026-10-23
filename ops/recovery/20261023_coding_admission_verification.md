# Coding proposal durable admission verification

The real coding proposal executor now reserves credits and claims a single-use dispatch before each initial or refinement generation. Stable workspace/stage/phase keys prevent a stage replay from buying the same attempt again. Each attempt reloads workspace policy and pins the initial selected model. A failed or still malformed refinement fails the stage rather than returning the broken original patch.

The admitted manager records each Gateway generation before returning it. The executor verifies that durable evidence instead of writing the generation again. Requests use the existing shared 4096-output-token ceiling with SDK retries disabled. No global output limit or credit pool was expanded.

## Verified locally

- Four original RED regressions reproduced missing admission and stale refinement policy.
- A real manager/provider regression reproduced the incompatible old 32000-token bound, then passed with the shared 4096 bound. Its SDK transport is synthetic.
- Eight tests against a new owned PostgreSQL17 database and the installed SDK's fixed synthetic transport passed: valid patch accounting, same-stage replay, separately accounted refinement, policy disable, model change, insufficient public Free pool, machine-label refusal, uncertain dispatch retention, and malformed final output. Some tests assert more than one behavior.
- The same portable runner also passed thirteen Agent/approval transaction tests and ten database approval guard tests. The owned local cluster was removed afterward. No live database, customer authentication or external model inference was used.
- Independent review found no remaining blocker after the token-bound correction.
- Final source checks: 9967 passed, zero failed, 107 skipped (including eight explicitly opt-in coding PostgreSQL cases run separately above). TypeScript and the production build passed.

Run the private fixture with `scripts/test-agent-credit-postgres.py` using an explicitly supplied local PostgreSQL17 tool directory, Node24 and a fresh private output directory. It refuses external database URLs and uses a private Unix socket with TCP disabled. The coding suite runs after the Agent suite so its pending usage cannot interfere with the latter's all-workspace reconciliation assertions.

## Explicit limits

This is not real desktop Agent acceptance or a complete GitHub coding journey. Machine/evaluation actor labels are refused until a verified billing principal contract exists; no workspace owner is substituted. Public Free coding still uses the generic 1000-cent reservation, so its 200-cent pool refuses it. The special bounded Free Sonnet Agent path is unchanged. Unknown provider outcomes retain their durable hold; this change does not invent a successful receipt or release uncertain spend.

No cockpit redesign, new tool permission, installer publication, provider configuration or paid inference is part of this batch. Production release status must be recorded separately after final source checks.
