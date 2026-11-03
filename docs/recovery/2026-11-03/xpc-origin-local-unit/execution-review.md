# Pending one component feasibility experiment

**NOT authorized or executed by the local implementation approval.** No issuer identity, coverage enrollment, policy activation or production action is involved.

Prepared app: `/private/tmp/axiom-origin-unit-prepared-ze5igxef/Axiom Origin Unit.app`. Manifest SHA256: `6d0380e929d43d564ad5008c2ebea8f383fc6ad06f18a65c91f291420ffc8a94`. Fixed driver: `packages/verified-issuer-runtime/origin-unit/run_prepared.py`; its exact source hash is in `source-sha256.json`.

The proposed single run would:

1. Recheck all prepared file hashes, local strict signatures, private root ownership/mode, SMAppService status NotRegistered and absence of `gui/<uid>/com.visionxixlabs.axiom.origin-unit`.
2. Create the permanent one-use `host-experiment-claim.json` before registration. Existing claims refuse; no reset/retry.
3. Register only the diagnostic app's per-user LaunchAgent through SMAppService. macOS may show this under login/background items or require user approval. A denied/pending request stops; no approval/settings workaround.
4. Run its pinned diagnostic controller once, bounded at 25 seconds. The broker may spawn only its exact copied Node24/candidate, records a permanent pre-spawn claim and checks the per-message signing/SELF/challenge exchange. The client exits independently within 15 seconds; broker lifetime cleanup is 30 seconds. This probe reports only `component_observed; executingIssuerIdentity=unavailable` if that exact child exited successfully.
5. Always attempt unregister of only that same diagnostic service, including a partial/failed registration. Save result/status/launchd absence; unknown cleanup is a material failure requiring diagnosis, never a retry. Artifacts and consumed claims remain for audit. A crash/forced termination of the Python host is an unresolved cleanup hazard; the owned child deadline still bounds that child, and the registered service may require the exact cleanup command later.

There is no image/mount/restriction run, real credential, network/provider request, main-app restart, source/production deployment or paid operation. Positive current liveness and canonical/private same-consumer admission remain unqualified. The diagnostic child is intentionally unrestricted; this cannot qualify a real issuer.

Review should authorize only one invocation of the exact frozen driver. It should separately acknowledge temporary user background-service registration and removal, rather than treating local code approval as service-installation consent.

If a host crash or cleanup-command exception prevents the result receipt, stop and inspect the preserved one-use claims and this exact bundle's status. Do not rerun the experiment. A separately authorized cleanup would invoke only `/private/tmp/axiom-origin-unit-prepared-ze5igxef/Axiom Origin Unit.app/Contents/MacOS/AxiomOriginRegistrationHost --unregister-reviewed-unit`, then verify that exact service status and launchd absence. No blanket launchctl removal or other background-item changes are permitted. This is a cleanup instruction, not permission to execute it now.
