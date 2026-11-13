# ECS credential custody: next design boundary

Status: owner approved bounded design preparation and three official AWS reads. Research/specification prepared at ECS-PRIVATE-ISSUANCE-DESIGN.md; no implementation or real configuration authorized.

## Evidence requiring a change

Independent exact-run handoff review found that the current local workload runner gives its incoming GitHub JWT to STS. If AWS trusts that JWT directly, the GitHub runner might exchange it outside Axiom and omit Axiom's approval/claim/reservation checks. A job hold, selected session policy or a successful mocked ledger test does not eliminate that alternate path. Existing qualification defaults remain unavailable; no live bypass or existing account policy has been tested or asserted.

## Proposed investigation and deliverable

Specify a private issuance design in which GitHub's token authenticates only the exact Axiom request and is not by itself sufficient to obtain the ECS write credential. Determine the actual native trust/credential supplier and non-bypass properties before choosing a mechanism. Assess dedicated custodian issuance with a separately qualified platform principal against the already approved private-runtime/custody architecture; do not fall back to server-wide environment credentials or pretend a new broker exists.

Deliver one connected design covering exact original human approval/delegation/run/environment; private issuer identity and provenance; credential acquisition/lifetime and native liabilities; currentness immediately before mint/send; raw token/credential non-export; no direct native alternate exchange; unknown/no-retry recovery; default/legacy caller coverage; historical compatibility; concrete negative and positive qualification evidence. Unsupported prevention or unqualified identity keeps activation refused. The existing role trust could require an owner-approved change later; no such change is part of design preparation.

Requested scope: local design/source inspection and up to three official AWS public documentation pages, using official search, for STS role trust and caller authentication/credential delegation. No account/repository/provider reads, real JWTs/credentials/keys, IAM/trust/profile/environment changes, code implementation, workflow/run, native launch, installation, deployment or spending. Implementation and every real configuration/qualification action require separate reviewable authority. The prior three-page GitHub allowance is consumed and does not cover these reads.

Other approved manual release/settings/workflow work continues while this decision is pending. This does not shrink P01 or substitute refusal for a usable governed deployment flow.
