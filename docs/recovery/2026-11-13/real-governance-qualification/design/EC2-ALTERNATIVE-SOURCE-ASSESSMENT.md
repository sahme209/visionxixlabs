# EC2 alternative — bounded public research outcome

November 13. Owner approved four public AWS pricing/ClockBound reads and design preparation in response to `call_78791cc556cc401080e7414b023bfb58`. All four requests below were made once. This allowance is consumed, including the failed source request. No account API, pricing API, clone, download/install, time query, credentials, runtime, resource or spending occurred. This is not an implementation or qualification grant.

## Observations and limits

| Requested public page | Observed | What this does not establish |
| --- | --- | --- |
| https://aws.amazon.com/ec2/pricing/on-demand/ | On-demand billing rules are present, including per-second billing for Linux and a 60-second minimum. The returned page did not expose an exact Ohio instance/OS rate. | No instance price, qualified instance family, capacity availability or whole-trial quote. Do not substitute remembered rates or assume free tier. |
| https://aws.amazon.com/ebs/pricing/ | Storage is charged until released; gp3 has included baseline performance, with additional provisioned performance separately chargeable. Billing examples are not an Ohio quote. | No exact selected-region disk quote, deletion approval, retained-evidence cost or free-tier eligibility. |
| https://github.com/aws/clock-bound/releases | The returned listing labels its visible 3.0.0-alpha.1 and alpha.0 releases prerelease. Notes describe changed client stale-memory handling and the 3.0 daemon/client architecture. | No accepted stable release, exact source closure, compatibility, maintenance cadence or support promise. Visible month/day labels do not establish the year/currentness. Do not infer that this is the latest supported release or adopt it. |
| https://github.com/aws/clock-bound/blob/main/clock-bound-client/src/lib.rs | Request returned 404. | No client implementation was read. No interval conversion, freshness, status, daemon-channel or leap/step contract is qualified. No alternate path was fetched. |

These findings do not justify switching runtimes yet. They narrow the decision: the pricing pages establish charge categories, while the observed release listing/source failure does not establish an exact usable time dependency. No more unapproved documentation calls or retries follow.

## Important source-composition finding

Local source inspection adds a separate issue beyond time. `lib/governance/platform/operations/nativeCustodianSupplier.ts` accepts only `/v2/credentials/<bounded-id>` and the private transport fixes host `169.254.170.2`, port80. Capture is opaque and checked against the action's exact profile, account and source role. Directly moving that executor onto a generic EC2 process would not preserve this acquisition contract. Do not widen the path/origin or add the SDK environment/instance-profile fallback as a compatibility fix.

The complete alternative therefore has to specify one of these explicit profiles before implementation:

1. **ECS task on a controlled EC2 host:** investigate preserving the task-role acquisition path while a protected host time service supplies intervals to the exact closed executor. This is a design candidate, not proof that the current Fargate profile, task protections or ClockBound channel carry over. Host role, task role, daemon writer, observer and task isolation must be separately bound and qualified.
2. **Direct EC2 executor with a new private acquisition adapter:** a new credential boundary requiring its own reviewed design and owner approval. Existing source/derived intent records, private issuance, current authority and unknown-liability closure must remain. It is not authorized or preferred merely because an SDK fallback exists.

Recommendation: retain default refusal and finish the first candidate's complete specification before selecting either. If preserving the original credential boundary cannot be established, present the difference rather than silently replacing it.

## Complete design preparation — no resource selection yet

Keep the original requester/reviewer/claim/executor/history path and separate synthetic database and healthy disposable deployment target. Replace only the proposed issuer-host lane if its full contract is accepted. The fixture and target must not gain the issuer's source credential. Production Neon, customer identities, original ServiceNow attempts and the Mac qualification lane are outside this experiment.

| Design gate | Required acceptance evidence before a real trial |
| --- | --- |
| Host and running consumer | Exact OS/image/runtime/dependency artifacts; protected administrative writer; actual running task/process/image/role association; closed process/environment/mount/IPC profile; separate current external observer. Hash or matching JSON alone is insufficient. |
| Protected time | Exact supported library/daemon release and source/license closure; channel ownership and process access; documented current interval/status semantics through each final use; steps/suspend/restart/smear policy; refuse unavailable or stale observations. No cached interval advanced by an invented drift constant. |
| Source acquisition | Exact native task credential path and identity, source generation/cutoff and unknown renewal liabilities; no ambient SDK chain, host-role escape, alternate endpoint or broad shell. Verify real isolation rather than assuming a container proves custody. |
| Joined execution | Actual private initializer/stores and current permissions, independent human review, exact signed job/run/attempt, original claim before resource acquisition, fresh checks after awaits, one final provider send, durable native result or original unknown history. |
| Closure | Complete relevant fleet, issuance cutoff and known/unknown source plus derived lifetime evidence. Trusted earliest time must pass the actual bound; stopping compute or a policy ceiling cannot substitute for credential closure. |
| Full workflow | Actual separately authenticated requester and reviewer, exact visible plan and personal review, requester execution, native healthy-result readback and lost-reply/reload recovery without replay. Synthetic approval rows do not satisfy this gate. |
| Other Governance scope | Existing executor-family coverage, native qualification and independent security requirements remain mandatory. This platform test cannot complete Mac, other provider families, customer migration or full product acceptance. |

## Cost worksheet — deliberately not a quote

Prepare an exact regional/OS/instance choice only after the release/profile is supportable. Avoid burst-credit pricing ambiguity; any selected burstable host needs an explicit credit-mode/cost decision. No reserved commitment, NAT gateway, load balancer, managed database or additional observer host is implicitly approved.

Whole trial cost must include: issuer host seconds × verified host rate; provisioned disk GB × verified regional rate × retention fraction; any extra disk performance; IPs; separate fixture and target compute; replacement overlap; images/snapshots; logs; requests/transfer; setup/cleanup overhead and retained evidence. Existing Fargate fixture/target rates may be reused only for unchanged compatible components; the prior three-Fargate-task subtotal does not price this replacement host. Billing minimums and disk retention outlive a script's test timer. A budget notification or controller timeout is not a native hard billing cap.

No numeric total is ready. Before spend authority, show exact line items, maximum proposed resource lifetime/count, cleanup ownership and a residual-retention decision. Do not create resources to discover the price.

## Next completion gate

The next coherent unit is a reviewed exact host/time/source composition, not another bare time probe or a permissive qualifier. The current four-read outcome leaves exact ClockBound source/release and regional rate unresolved; implementation, build/native execution, account/resource inspection, provisioning and spend remain unapproved. This document records the gaps so they cannot be mistaken for completed qualification. No additional public-read request is automatically generated by a failed fetch.
