# Temporary credential closure — public source review

Owner approved three official AWS documentation reads. All three consumed November12. No account access, token, API request, policy write or revocation was performed. This document does not grant implementation, provisioning or native action authority beyond existing local scope.

## Sources and findings

1. [Revoke role temporary credentials](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_use_revoke-sessions.html): revocation adds a role policy affecting sessions before a cutoff. Later sessions can escape that cutoff. The console's approximate future cutoff accounts for propagation; it is not a universal completion timer. The operation requires policy-write authority and cannot revoke a service-linked role session. Therefore it must not become automatic cleanup in this local implementation, nor prove that new issuance stopped.
2. [Disable temporary credential permissions](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp_control-access_disable-perms.html): permissions are evaluated on use; policy updates can take time. Resource-based grants must also be considered. Source identity can persist through role chaining whereas a caller-selected session name can change. Therefore a local source-row flag, one policy observation, one session name or revoking only the source role is not sufficient evidence for all recorded derived sessions or resource paths.
3. [GetCallerIdentity](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html): it identifies the calling principal without needing permission, even when explicitly denied. Therefore neither successful identity lookup nor its identity fields prove an ECS write is currently permitted or that a credential is safely closed. No caller-identity probe or authorization-denial retry is introduced.

These are public semantics only. No actual Axiom IAM trust/role/resource policy or custody qualification was verified. Natural expiry is a native bound for a correctly established exact credential, but an unqualified local timestamp does not prove that bound, reliable current time, inventory completeness or cessation of new issuance. Preserve that distinction; do not claim AWS credentials remain valid beyond a genuinely verified expiry.

## Consequences for the current implementation

The existing recorded inventory remains held and never grants activation. Original source/result pending/known/unknown histories must remain unchanged. A later closure qualification can supplement those facts; it must not rewrite a consumed attempt, erase known issuance, reset a generation or permit a retry.

A conservative initial closure design should prefer genuinely qualified issuer/fleet drain plus verified native lifetime bounds over automatic IAM mutation. It needs:

- A current, exact private issuer/profile/fleet snapshot and evidence that every relevant producer/old runtime/maintenance path cannot mint or expose another covered credential after the drain boundary.
- A complete inventory of source and derived sessions and any unknown acquisition. Current bounded platform rows cover recorded attempts only, not actual fleet completeness.
- Qualified provenance for each native expiration or a conservative independently established upper bound for unknown issuance. Never assume the new code's requested900seconds bounds an older/untracked credential.
- A qualified current-time bound beyond those expirations, including clock uncertainty. A wall-clock comparison or fixed sleep is insufficient.
- A separate immutable, current closure observation binding the inventory digest, profile/drain generation and exact credential references. Historical pending/issued/unknown facts remain inspectable and do not become permission.
- Refusal for incomplete legacy inventory, unbounded unknown issuance, unsupported chain/resource paths, new issuance during qualification or stale/revoked evidence. New work needs its own exact current action, never replay of the closed attempt.

This is the next design to specify against the existing enrollment/drain architecture before implementing an activation/closure decision. The three documents do not supply actual fleet, time or custody evidence, and do not establish a generic credential-invalidity API. Real revocation, IAM changes, host drain and provider acceptance retain separate owner approvals.
