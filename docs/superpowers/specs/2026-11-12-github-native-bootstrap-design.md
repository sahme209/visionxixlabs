# GitHub-native handoff bootstrap — proposed local design

Status: owner approved public documentation/design preparation only. NOT implementation, real token acquisition, workflow/configuration, publishing or spending authority. Existing strong supplier refusals remain unchanged.

## Intent and approaches

Finish the actual job entrypoint behind the prepared exact-run handoff without inventing native identity from caller/environment/hash metadata. The owner approved investigation of the recommended GitHub-native channel approach. This proposal still needs acceptance before code.

Recommended: treat GitHub's native request channel, fixed reviewed job code and explicitly qualified channel profile as a bounded external bootstrap trust root. Obtain one identity token; authenticate its actual signed workload at Axiom, then apply every existing approval/currentness/private-AWS gate. Channel trust is NOT workload authentication or AWS authority.

Alternative: retain proof of stronger native origin before reading the request variables. This keeps the path unavailable until an independent attested launcher/qualification source exists. It requires another mechanism, not a successful callback or flag. No new privileged service/identity system is proposed or authorized. The recommended approach avoids inventing a second launcher for the GitHub job while retaining the separate AWS custodian's full trust/custody requirements.

## Public contract verified within three-page allowance

1. GitHub OIDC reference documents job-scoped token permission and the native request URL/bearer variables. It lists issuer/audience, repository IDs, run/attempt, workflow ref/SHA, environment and runner-environment claims. It supports custom audiences and multiple subject formats; a configured subject must be matched exactly, not inferred from repository name. URL suffixes and environment variables are not described as independent process attestation. Source: https://docs.github.com/en/actions/reference/security/oidc .
2. Deployment environments documentation says configured protections pass before a referencing job is sent to a runner. This verifies a hold mechanism, not this repository's actual configuration or bypass prevention. Source: https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments .
3. Secure-use guidance warns that workflow actions may compromise other work/secrets. It recommends dependency review/immutable references and keeping untrusted context out of generated shell syntax. Redaction is not a substitute for avoiding secret output. Source: https://docs.github.com/en/actions/reference/security/secure-use .

The pages do NOT establish the exact current token endpoint origin/path/query/response shape for our future run, this repository's live protections/key profile, an uncompromised runner, our pinned action's current provenance or actual private AWS trust. No linked discovery URL, source repository, public key endpoint or account API was opened. Those qualification gaps remain explicit. The new allowance is consumed.

## Distinct security stages

1. **Bootstrap channel checked:** fixed compiled code/protected profile and exact qualified GitHub-owned endpoint policy are checked. Native URL/bearer values may then be captured once. This stage asserts only the accepted channel trust assumption. Unsigned GitHub environment hints can reject malformed/mismatched input but never establish workload identity, reviewer consent or permission. No general credential chain, arbitrary full URL, file/token fallback or caller-supplied expected origin.
2. **Token acquired, identity unverified:** one bounded same-audience request returns a JWT. The request bearer/JWT remain lexical. Decoding the JWT locally is not authentication. No source metadata is trusted as permission; no AWS exchange occurs. Unknown acquisition stops without reacquisition.
3. **Workload authenticated/current:** Axiom's existing cryptographic verifier checks the real signed token using independently qualified current keys/profile and exact repository IDs/workflow/run/attempt/environment/audience/subject/expiry. Current source/protection/humans/independent approval/requester delegation are required. Its response is nonsecret metadata, never an execution proof.
4. **One original execution:** unchanged durable claim, identity replay exclusion, native reservation, source/derived credential liabilities, private custodian AssumeRole and exact final send. GitHub JWT never reaches AWS. Source-current reads after a result cannot re-admit the consumed action. Unknown stays consumed; history has no resend/rollback authority.

This is a proposed change to the current pre-token qualifier's meaning, not a relabeling of an existing success. Rename/split the native qualifier API into explicit bootstrap-channel and authenticated-workload stages. Add a versioned channel-profile purpose; old source/profile/approval hashes remain historical and cannot silently gain v2 qualification. Missing supplier/configuration refuses.

## Actual fixed entrypoint and artifact composition

Prepare one fixed repository entry module joining the real native token reader, remote source bridge and one-attempt sender. It accepts only original action/version and the compiler's nonsecret protected profile. Fixed bootstrap capture reads only the documented native URL/bearer plus bounded job-context hints needed for comparison. It must not enumerate/print environment values, read AWS/other credentials, accept CLI endpoint overrides or infer protection from a name.

The channel profile has exact reviewed native origin and supported URL/query/response constraints, Axiom source/submit origins, audience, protected environment/profile revision and explicit source/runtime references. These are independently supplied setup evidence, not derived by trusting the very environment URL being checked. The three docs do not qualify actual values. Real defaults remain unavailable until a separately authorized source/setup packet establishes them. A profile is metadata requiring current qualification, never a Boolean proof or a substitute for real backend JWT checks.

Use an offline fixed compiler/bundler recipe with current cached dependencies to emit the ACTUAL entry module and its closed dependency graph. No arbitrary user-selected entrypoint/module/source code, network install or historical issuer/profile renewal. Audit the emitted module graph: job-side contracts/transport/hashing only; no Prisma, private AWS issuer/custodian, credential vault, web session, arbitrary dynamic import, general plugin or customer code. Hashes bind build source, runtime bytes, dependency closure and generated workflow; source identity must distinguish build commit from eventual installed workflow commit to avoid self-hash/commit cycles.

The existing source-only artifact compiler emits the protected job plus that actual closed runtime. Reuse the repository's currently pinned checkout commit only after its existing provenance is rechecked in the batch audit; do not claim it is verified solely because another file contains the same string. Checkout exact GitHub source SHA, no persisted credentials, only the fixed runtime path. Verify read runtime bytes and import the SAME in-memory bytes, avoiding path reopen after hash. Require supported Node; do not auto-install dependencies. Inputs enter via bounded data/environment values, never generated shell expressions. No extra OIDC job, arbitrary setup/plugin, cloud command, automatic rollback, polling or retry.

The local artifact itself is prepared_only/installed:false/executionAuthorized:false. No active .github change follows. Merely writing an environment name cannot qualify native protection. Actual repository settings, source/key/profile evidence, bootstrap channel, native currentness, host/fleet/private custodian qualification, same-artifact live acceptance and owner activation remain distinct gates.

## Threat boundaries and non-goals

The recommended bootstrap explicitly trusts GitHub's hosted job/token service and the approved workflow/compiled code/dependency chain within its stated profile. A malicious authorized administrator, compromised vendor/runner/action/runtime or altered native channel is not prevented by a local name comparison or a JWT. A JWT attests documented workload claims; it is not a general proof that every process in the runner is trustworthy or that protection settings have not changed. Axiom's private current-source/protection suppliers and no-direct-GitHub-to-AWS trust qualification remain mandatory.

Do not claim universal interception, military certification, free hosting, real setup, real key/source custody or completed Governance. Do not weaken the private AWS custodian's existing pre-acquisition host/source/trust/time/fleet gates: this proposal changes the GitHub job's sign-in bootstrap only. No account/role/service/key/grant/OS installation or new identity issuer is authorized.

## Local acceptance after a separate implementation approval

- Real fixed entrypoint and compiler closure, not a synthetic substitute. Compile once from frozen source with cached dependencies; execute only isolated synthetic/mocked entrypoint scenarios under the local grant, never real native endpoints/runtime/issuer.
- Separate stage/type contracts. Channel success alone cannot enter execution or claim authenticated identity. Bad signature/audience/subject/run/attempt/environment/profile, key/source/protection loss and forged job hints refuse before AWS issuance.
- Missing/unqualified origin/profile, alternate host/port/userinfo/fragment, unsupported query/response or malformed/profile-mismatched native-variable substitution refuse before sending the native request bearer to an unqualified destination. A valid-looking same-channel replacement is not promised detectable before sending: same-channel tampering is within the stated compromised-runner boundary, and a token for another workload must fail the backend signed-claim checks. Conflicting audience cannot be normalized into another purpose. One bounded acquisition, no retry/fallback/files/secret output.
- Actual generated same-runtime bytes traverse intercepted native token request, server preflight/source-current and the original SQL runner. Positive, early release, no delegation, revoked human/source, expiry, concurrency, lost token/claim/send/receipt and original-history recovery remain separate assertions. At most one source acquisition/mint/ECS send; no renewed approval or replay.
- Runtime hash/dependency/source mismatch, changed bootstrap profile, arbitrary caller code/shell/endpoint and helper mutation refuse. Unknown real channel/protection/key/host evidence does not become a synthetic default.
- Full required types/tests/build and one planned final whole-source review; all exact-head PR checks green before normal merge. Real provider/native/workflow/production acceptance stays unavailable until separately authorized.

## Scope requested after this design is accepted

Local source, fixed compiler/entrypoint preparation, type checking and intercepted/synthetic/owned isolated-PG tests only. No real environment read, bearer/JWT/key acquisition, discovery/key fetch, service/role/environment/workflow configuration/run, signing/install, route/flag enablement, production SQL/deployment/post, dependency adoption or spending. This design-only/public-read approval does not grant that implementation. Other held image/template/deployment decisions remain unchanged.

## Builder check and author clarification

A fresh read-only builder check found one consequential wording ambiguity: whether every native-variable replacement could be detected before token acquisition. Author clarification: only malformed or profile-mismatched substitutions are rejected locally; same-channel tampering is explicitly inside the compromised-runner trust boundary. Another workload cannot gain authority because the backend must verify exact signed claims. This clarifies the recommended design rather than inventing pre-token process attestation. The actual endpoint/profile remains a separate qualification/activation gate. No additional owner choice or public read was inferred.
