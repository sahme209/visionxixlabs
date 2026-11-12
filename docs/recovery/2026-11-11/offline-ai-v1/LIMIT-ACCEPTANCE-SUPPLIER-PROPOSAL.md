# Proposed trusted operator model-limit acceptance supplier

Status: owner design decision required before implementing the new authority source. Existing operator-attestation parsing is data only and does not qualify a model or authorize dispatch. Accepted ADR permits offline AI, but does not identify the trusted supplier of verified server-limit acceptance. Do not silently replace verification with a user-editable JSON flag.

## Proposed local implementation

1. A deployment-operator-maintained acceptance file, separate from workspace policy and ordinary model configuration, records the exact installation/config digest, private endpoint identity, model/revision, enforced input/context/output maxima, acceptance expiry and hashes of the actual isolated qualification evidence.
2. A fixed reader validates the complete bounded record and referenced evidence, checks the protected file's owner/mode and refuses writable/untrusted paths, symlinks, missing evidence, stale identity or changed bytes. File provenance is operator custody, not a claim that hashing proves model behavior.
3. The operator must separately perform and review real isolated-model acceptance, including server-enforced context/output limits and usage reporting, before publishing that record. No local simulated test can create an eligible live record. The reader grants no tools, model-server administration or workspace permissions.
4. Current acceptance, membership, policy, model selection and explicit operator budget must be rechecked in the default offline composition. The hold is the full accepted input+output bound, never a bytes-to-tokens estimate. Old unknown/overrun liabilities remain charged. Missing acceptance refuses.
5. Local source/pure/mocked/owned-PostgreSQL tests only for this decision. No actual operator-file provisioning, root/service/account changes, credentials, model server or inference, production change, deployment or spending. Existing native/canonical issuer and on-prem custody gates remain closed.

## What approval would mean

Approve this operator-reviewed evidence-file supplier as the local v1 design, then implement and test it. This is not approval to create an eligible acceptance record, run the live qualification, install/provision protected resources or enable offline AI. Those remain separate real-world gates. If this design is declined, retain the missing-qualification refusal and choose a different trusted supplier explicitly; do not fabricate one.
