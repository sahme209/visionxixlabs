# GitHub job bootstrap — bounded design/contract request

Status: source gap identified; no implementation/trust change approved here. The previously approved compiler/native transport ports and active refusal remain intact.

## Concrete missing boundary

The source-only workflow compiler now accepts only a privately qualified compiled runtime. Its tests used a synthetic stub. The concrete native token reader calls PrivateGithubJobSource.assertQualified BEFORE capture of the request URL/bearer, but there is no real supplier for that assertion or context. The remote source bridge similarly requires native qualification before token acquisition. Matching an environment name, URL suffix, declared SHA, self-supplied profile or Boolean cannot fill these ports.

The actual signed workload is verified by Axiom after acquisition of its fresh GitHub token. Consequently the job's native token-request channel and the later authenticated workload are DIFFERENT stages. Treating an unsigned job environment comparison as the latter would misstate security. A source compiler/hash test cannot prove either stage's actual host/protection/current-source provenance.

Current exact source: nativeGithubJobIdentity.ts (qualification before context/read), remoteHandoffSource.ts (native qualification before acquisition/current server reads), handoffWorkflowArtifact.ts (qualified runtime supplier absent), workloadIdentity.ts (actual signed identity verification), workloadRunner.ts (current approval/delegation/native admission), and privateStsIssuer.ts (separate AWS credential). No GitHub JWT is forwarded to AWS in the new private runner. Axiom's active checked-in workflow remains refused.

## Approaches for the next design

**Recommended for investigation: explicitly bounded GitHub-native bootstrap trust.** Specify what the fixed reviewed workflow may trust from GitHub's native job context solely to request its own identity token, with exact channel/origin/audience, immutable source/runtime/profile, no caller overrides, no new fallback/retries and no automatic grant of execution. Distinguish channel qualification from cryptographically authenticated current workload qualification. Verify the vendor contract first. Axiom must still cryptographically verify the actual signed run/workflow/attempt/environment/audience and current people/protection/source/delegation/native reservations before AWS acquisition or send. The separate private AWS custodian, full native IAM/trust/fleet/time requirements and live setup gates remain unchanged. Document GitHub/runner/approved-code trust and administrator/break-glass limits honestly rather than claiming universal interception or an uncompromised host.

**Alternative: retain the stronger pre-token native-origin requirement.** Keep the supplier and real artifact unavailable until an independently qualified external launch/attestation source exists. This adds a separate mechanism/setup/qualification dependency; no privileged service/account/key/grant or additional identity system is authorized. It is a hold option, not an instruction to build another issuer.

Neither approach is selected as an implementation grant by writing this request. The first is a recommendation to investigate, not a claim that native environment variables are authenticated, that the vendor contract is already verified or that Axiom has live configuration.

## Requested bounded scope

Up to three official public GitHub documentation pages, using official search only to locate them, about obtaining an OIDC token in a job, native request variables/permissions and protected-job/runtime/source constraints; then a concrete reviewed design of the actual entrypoint/bootstrap/dependency/artifact binding and same-artifact acceptance procedure. No other external reads or provider/account API access. Preserve previous source/research receipts; this is a new exception because the earlier three-document allowance is consumed and did not resolve the concrete bootstrap supplier.

This grant would cover design and public text only. Do not replace assertQualified with an environment/flag/hash success, write or execute a new trust mechanism, access real job tokens, configure environments/trust, build/sign/install a native helper, dispatch a workflow, enable flags, change schema/permissions, contact AWS, deploy, publish or spend. If the official contract cannot support the proposed root, report the remaining gap rather than relaxing it. Later implementation must follow a separately approved exact design unless the owner explicitly authorizes a conditional implementation bundle after seeing it.
