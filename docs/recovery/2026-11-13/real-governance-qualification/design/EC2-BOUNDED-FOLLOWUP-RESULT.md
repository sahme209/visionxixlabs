# EC2 timing and regional cost — six-read follow-up

Owner authorization `call_a80b2e23d5c44bba8b67decb65972362`, November13. Six public page requests consumed, including a broken README-linked client document. No substitute source request, account access, installation, native time query or resource action. This supersedes the earlier missing-regional-rate finding only; original receipts remain unchanged.

## Public-source record

1. https://github.com/aws/clock-bound — repository listing shows `clock-bound`, `clock-bound-ffi` and `docs`. README describes a daemon/client interval system and uses3.0.0-rc.0 as an example. This is not an accepted release pin, code review or maintenance guarantee.
2. README's actual client link https://github.com/aws/clock-bound/blob/main/docs/rust-client.md — returned404. No fallback fetch.
3. https://github.com/aws/clock-bound/blob/main/docs/protocol.md — v3 documents TSC-based current-time calculation, drift/period-error growth, Void-After validity, synchronization/disruption state and update-generation handling. This supplies a concrete protocol-level candidate for freshness/growth; it does not prove the matching client implementation, immutable release, source-clock correctness or protected host. Do not write a custom protocol client merely because these formulas are available.
4. https://github.com/aws/clock-bound/blob/main/Cargo.toml — workspace version3.0.0-rc.0 and actual members are visible on mutable main. No immutable commit or supported release is established. Keep prerelease selection and dependency adoption unapproved.
5. https://aws.amazon.com/ec2/pricing/on-demand/ — actual rendered public table: AWS Region, US East (Ohio), Linux; filtered `m6i.large` row shows2vCPU,8GiB,$0.096/hour,EBS-only. This is a pricing candidate, not a selected/qualified host or an inventory/capacity/architecture/PTP/VMClock finding.
6. https://aws.amazon.com/ebs/pricing/ — actual rendered region selection is US East (Ohio), us-east-2; gp3 storage$0.08/GB-month, baseline3,000IOPS/125MB/s. Table shows additional throughput$0.040/MB/s-month, unlike the generic example's$0.06; use the regional table, not the example. Extra performance is not proposed. Standard snapshot$0.05/GB-month is observed but no snapshot is authorized.

The public browser price interaction changed only local table filters. An initial input focus failure was followed by inspection and a successful click/type on the same page; it caused no new page request or cloud action. No API/account state or permissions changed.

## Illustrative complete-topology subtotal

Candidate, not resource selection: one m6i.large issuer host,20GB baseline gp3; the previously priced separate Fargate fixture DB and disposable target, each0.25vCPU/0.5GiB; three publicIPv4s. Use30minutes simultaneously for comparison only. The approved earlier Ohio Fargate and VPC rates are reused from FULL-TRIAL-COST-SUPPLEMENT.md; no refetch occurred.

| Line item | Calculation | USD |
| --- | --- | ---: |
| Issuer EC2 compute |0.5hour×0.096 |0.048 |
| Separate fixture DB + target compute |0.5hour×(0.5vCPU×0.04048+1GiB×0.004445) |0.0123425 |
| Three publicIPv4s |3×0.5hour×0.005 |0.0075 |
|20GB gp3 during the same30minutes |20×0.08×1800/(30×86400) |0.0011111111 |
| **Illustrative subtotal** | Sum above | **0.0689536111** |

This is roughly6.90cents for the enumerated simultaneous components, not a whole-trial quote, authorized spend or hard cap. The disk calculation assumes a30-day month and30-minute storage lifetime; retaining20GB costs$1.60 per such month independently of compute. The actual retention decision must be priced; stopping the host does not release storage. No deletion is authorized by the arithmetic. Preserve all existing branches/backups/evidence.

Still excluded/unpriced: exact OS/image disk minimum, build/bootstrap and observer duration, replacement overlap, image storage, requests/logging/transfer, retained evidence/backups, any separately required host/component, taxes. ClockBound support for the candidate instance and task/host isolation are unverified. A budget alert or process timer is not an AWS billing cap. Do not infer capacity, existing EC2 availability or source-credential closure from a price.

## Design consequence and next local unit

The v3 protocol makes EC2 a stronger timing design candidate than the incomplete Fargate metadata contract, but does not qualify a runtime. Retain the task-credential-preserving ECS-on-EC2 proposal and the full host/channel/source/fleet/human acceptance gates. Complete the exact supported source/release review before any native adapter, dependency or install decision. No further research request or retry is automatically authorized.

Independently of library choice, the real consumers still need the joined interval-policy composition in JOINED-TIME-COMPOSITION-DESIGN.md. Prepare the concrete local implementation proposal for owner approval; only after approval implement the joined consumers and scoped tests, keeping native suppliers and activation unavailable; do not claim that completing this integration alone completes Governance. Actual SQL, native execution, credentials, resources, source adoption, production and spending remain separate grants.
