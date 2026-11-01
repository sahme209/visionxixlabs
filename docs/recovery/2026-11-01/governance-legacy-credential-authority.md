# Legacy plugin authority investigation and ownership repair

## Verified source findings

The shared execution engine (`lib/execution/pluginEngine.ts`) receives user/project/lead context but no organization or exact current baseline scope. Its mutation callers include execution/run, cloud-operator execute-plan/run-recurring, assistant/contact tools and cloud connectors. The legacy GitHub transport (`lib/connectors/githubWrite.ts`) differs from the guarded installation-token client and has no current tenant/Governance callback. It is called by the workflow-generation plugin and automation/remediate. The latter decrypts its lead PAT directly. These paths cannot be registered as complete Governance admission from their existing interfaces.

The existing AWS legacy mutation kill switch remains unchanged and defaults OFF. No denial was retried. No provider credentials or services were accessed during investigation.

## Reproduced ownership defect and local repair

The plugin credential provider accepted an actor userId but selected only a lead's encrypted payload. Azure/GCP ignored userId entirely. Its PAT helper had no user argument. Consequently the credential owner was not checked before decryption/construction. Local mock regressions reproduced this mismatch without real credentials.

The shared reader now selects stored Lead.userId and encrypted payload in one query and requires an exact nonempty caller match before decryption, STS role resolution or Azure credential construction. AWS/Azure/GCP and the PAT helper use this check. The PAT helper requires userId plus credential key; its sole repository caller now supplies the server plugin context userId. Old one-argument calls fail closed. Missing/unowned/foreign records return no credential; database failure is not treated as positive absence. No fallback identity or new credential/grant is introduced.

Seven ownership checks plus prior IAM/GCP regressions:19 passed. Scoped production TypeScript includes the reader and actual GitHub plugin caller. Independent source review found no important issues. No full current production build, signing, deployment or provider acceptance is claimed for this source increment.

## Remaining core admission work

This is a necessary stored-owner check, NOT authenticated organization binding, role authorization, last-write revocation enforcement or complete execution coverage. The original legacy apply paths still need authoritative organization/resource binding through canonical tenant-owned connections and exact guarded transport. Membership guessing or an arbitrary context Boolean cannot create execution coverage. Unmappable writes must remain unavailable under enrolled Governance; activation remains refused until the full actual mutation inventory is verified.

Next investigate the raw GitHub PR transport's two callers, canonical installation/repository mapping and actual current authority before any write. Preserve partially dispatched/unknown outcomes and one-attempt records. Do not count this ownership fix as a policy-admission receipt, enable any legacy flag, or invoke a live provider.

Evidence: /private/tmp/axiom-legacy-owner-{red,green,final-tests,types}.log. All credential material in tests is explicitly synthetic.
