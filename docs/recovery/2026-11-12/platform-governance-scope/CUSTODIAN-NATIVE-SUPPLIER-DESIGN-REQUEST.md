# Fixed AWS custodian credential supplier — bounded design request

Status: proposed design preparation and up to three official public AWS documentation reads; no new implementation or native/account authority. Existing approved private issuance/drain code remains unchanged and no default supplier is enabled.

## Concrete missing requirement

`privateStsIssuer.ts` requires `readCustodianCredential` and `assertCustodianCurrent`; `workloadRunner.ts` only forwards explicitly supplied private ports. The approved initial candidate is an AWS-hosted execution custodian separate from the GitHub job and website/AI process. No actual hosted custodian, protected workload principal or native supplier has been qualified. Connecting a generic SDK credential chain is not a substitute.

The installed source inventory is in CUSTODIAN-SUPPLIER-SOURCE-INVENTORY.json. The available HTTP/container providers accept environment-selected coordinates and may read an authorization-token file; their standard paths have retries. Reading the source is not executing it, proving a host boundary or authorizing these behaviors.

## Design to prepare

Compare the supported ECS task/Fargate credential mechanism with the existing private one-attempt acquisition/lease ledger. Specify one exact supported host profile and a fixed private supplier: authenticated workload origin, narrowly captured provider coordinate, explicit request bounds, no ambient credential/endpoint/file fallback, no redirect or automatic retry, current issuer/runtime/profile checks, native expiration semantics and truthful known/unknown source liability. Determine whether private runtime/fleet qualification can actually justify the profile; reject unsupported guarantees rather than fabricate a safe adapter.

Keep the existing durable source intent BEFORE acquisition, original source lease separate from derived execution credentials, final currentness checks and exact native send unchanged. Successful credential retrieval is not proof of identity isolation, complete producer coverage, safe closure or permission to deploy. No GitHub token may become an AWS token fallback. Host configuration, full native trust/permission paths and independently qualified clock/fleet/lifetime evidence remain required.

This is not an alternative to pending template/image/deployment recovery decisions and must not restart those prompts. Do not implement a generic callback and label it the real source supplier; the deliverable must name the actual supported native mechanism, all remaining inputs and the real acceptance procedure.

## Bounded external evidence request

Search official AWS documentation and read at most three public pages covering:
1. ECS task-role credential delivery and its native identity/lifetime fields.
2. Container credential-provider endpoint/authorization rules and expiration behavior.
3. Fargate/task-role security isolation limits relevant to the private execution custodian.

Record exact URLs, observed facts and unresolved details. Documentation can inform a design but cannot qualify Axiom's actual account or deployment. If three pages are insufficient, record the gap; do not extend the read allowance.

## Deliverable and approval scope

Deliver a source-backed supplier/custody qualification design with chosen supported profile, rejected alternatives, data/secret/authority lifecycle, precise local test plan, operator provisioning requirements, real qualification gates and cost implications before any setup. No actual provider endpoint/metadata/API call, role/account inspection, credential/environment-value/key access, native/service/host change, signing, installation, SQL, workflow run, production action, model inference or spending. No new code/default supplier/activation from this design-only grant. Later implementation and actual provisioning each retain their required decisions.


## Observed completion of this design-only grant

Owner approved design plus3public AWS pages; all3reads are consumed. Deliverables: CUSTODIAN-NATIVE-SUPPLIER-AWS-SOURCE-REVIEW.md, CUSTODIAN-NATIVE-SUPPLIER-DESIGN.md and CUSTODIAN-NATIVE-SUPPLIER-DOCUMENTATION-RECEIPT.json. No code/provisioning qualification is implied; existing initial status above is historical.
