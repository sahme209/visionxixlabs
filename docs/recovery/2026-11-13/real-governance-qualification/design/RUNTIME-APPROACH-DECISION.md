# Real qualification runtime — approach decision proposal

November 13, after PR328. The owner requested actual qualification, end-to-end acceptance and enablement, then authorized preparation of a minimal AWS setup/cost proposal. This document prepares that decision; it grants no code, installation, provider, credential, role, resource, execution or spending authority.

## Why implementation is not ready

The complete source/CI checkpoint is merged; neither the Mac protected initializer nor a Linux platform runtime is actually qualified. The Fargate-specific metadata/source research found a documented on-demand error-bound assertion, but not the complete host/instant, observation-to-use, clock-step/suspend and time-scale semantics consumed by the current expiry/closure checks. The existing final reviewer independently agrees those are unresolved. A private `{earliest, latest}` callback or an exact matching JSON object is not the missing supplier.

The previous source API also has direct Date.now consumers, unavailable source/profile defaults and an unregistered human workflow. Substituting a clock alone would not fix those. Native task metadata is not signed whole-process attestation. Unknown credential liability cannot be cleared by stopping a task or assuming six hours. These remain design requirements, not proposed exceptions.

## Two viable next approaches

| Approach | Advantage | Required limitation/tradeoff |
| --- | --- | --- |
| Keep Fargate, hold implementation pending a sufficient native timing/profile contract | Retains the proposed serverless topology and prior illustrative task costs | No invented maximum sample age, drift constant or cached interval. A provider trust assumption must be explicit and must cover final use; documentation/structural tests cannot stand in for actual qualification. Do not continue the same read/probe loop without new evidence. |
| Prepare a controlled EC2 host with AWS ClockBound for the same complete trial | The already-inspected AWS project exposes interval/status clients and an explicit daemon, allowing host/time provenance and current interval use to be specified together | Changes the proposed host/administrative boundary and introduces host upkeep, disk, network and compute costs. Exact maintained release, client semantics, license notices, host protections, provenance, quote and actual qualification remain unverified. EC2 availability in the existing account has not been inspected. |

**Recommendation (Codex's proposal, not owner acceptance): prepare the EC2 alternative.** Reuse the existing interval implementation before considering custom time cryptography or more Fargate parser scaffolding. Do not select or install an unreviewed release, assume the README's example prerelease is production-qualified, or transfer EC2 evidence to Mac/Fargate automatically. If the actual library/runtime cannot support the full contract, report that before code or resources.

## The complete trial stays intact

The alternative must retain the actual compiled private executor, original ledger/admission path, immutable artifact/configuration, protected initializer/custody, exact external observer identity, current source/role/target and signed job binding. Separate fixture database and disposable deployment-target identities remain necessary. The host is not a shortcut around real requester/reviewer authentication or a reason to reuse production secrets in a fixture. Preserve genuine independent decisions and source/derived/unknown credential liabilities.

The specification must identify:

1. Exact host/OS/artifact and trusted administrative writer; immutable code/resources, supported process/isolation controls, startup environment and how the running consumer is observed. No broad shell/agent/model code or implicit provider credential chain.
2. Exact maintained ClockBound release/client and protected daemon/channel; UTC versus smear semantics, synchronization status, interval validity through the actual check, clock steps/suspend and failure behavior. No global Date.now monkey patch or permissive test supplier.
3. One joined time policy across source credential, derived issuance, final admission/send and native closure, including after awaited checks. Observation data cannot mint permission.
4. Real private resource delivery and role/capability separation; same closed stores/executor and complete fleet/renewal cutoff. Unknown histories remain consumed. Host shutdown alone does not prove native revocation/expiry.
5. Genuine separate human test identities, authentication/delivery, original action review/execution/history and no automatic retry. Fixture identity provisioning needs its own exact scope; seeded approvals are not acceptance.
6. Exact artifact, account/region/resources, read-only prechecks, permission differences, finite security/end-to-end scenarios, native readback and owned cleanup/retention. Actual source-supplier and fixture database compatibility precede the trial; production Neon remains separate.
7. Full compute, nonburstable or explicitly controlled credit behavior, disk, IP, image, log, transfer and retention costs. No NAT/load balancer/managed database/extra service by default. No numeric quote or hard cost cap is asserted until verified; the earlier Fargate estimate cannot price the changed host.

Only then request independent review and the appropriate local implementation decision. Actual build/provisioning/native execution/key/identity/provider/write/cleanup authority must name its frozen inputs and remain separate from design approval. Preserve Mac qualification and every remaining master requirement; one successful platform deployment is not full Governance.

## Proposed research scope — not yet approved

Official public search and up to four primary pages total: AWS EC2 on-demand pricing, AWS EBS pricing, and up to two pages/source files from AWS's ClockBound project for a maintained release and client interval/status/host requirements. Reuse existing VPC/Fargate/ClockBound findings rather than reread them or broaden the allowance. Public text/design only; no pricing API, package/clone/download/install, protocol/native time query, account access, credentials, configuration, resource, build/run, production operation or spending. Stop when the four-page allowance ends; do not infer missing guarantees from examples.
