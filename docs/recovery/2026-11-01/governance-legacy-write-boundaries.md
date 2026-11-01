# Legacy write boundaries — local containment, not registered admission

The source investigation identified two registered infrastructure-mutating execution plugins: legacy IAM key disable and GitHub workflow generation. Both lacked a mounted organization-scoped admission issuer. The separate raw-PAT GitHub PR helper is also called by automation/remediate. Merely importing modern Governance guards cannot cover these alternate paths.

## Local changes

The raw GitHub helper now refuses calls without a trusted server `beforeWrite` closure before any provider request. Its two existing production callers do not supply such authority and therefore become explicitly unavailable in this local source. This is intentional containment, not a claim that their tenant mapping is implemented. Configured callers are still responsible for exact stored operation/tenant authority, durable one-attempt claims and recording/recovering unknown results; this helper issues none of them.

When a guard is configured, it is checked initially and immediately before every mutation. A shared15-second abort deadline and caller cancellation bound guards, requests and response bodies. Responses are limited to256KiB each/1MiB total and redirects refuse. The old422 branch-create fallback no longer PATCH-overwrites an existing branch or retries. Generic errors omit private provider payloads. Any failure after a write was attempted is marked outcomeUnconfirmed=true, including partial Git object creation. Those positive paths are tested with synthetic closures, not accepted production authority.

The legacy IAM plugin keeps its default-OFF switch and dry-run behavior. Flag=true alone now cannot send the command: a trusted server mutation guard is additionally required. The existing legacy engine does not issue it. The single SDK send uses caller cancellation and a15-second deadline; a dispatched failure remains unknown and is not resent. `maxAttempts:1` disables hidden SDK retries after authority validation. No flag was changed and no AWS denial was retried.

## Verification

Eight GitHub transport checks pass after initial RED cases: unbound/changed/cancelled authority, exact guard phases, partial-write uncertainty, no422 overwrite/retry, bounded response bodies and no private error disclosure. Seven IAM checks pass, including an explicit SDK maxAttempts regression that failed before its fix. The preceding ownership checks also passed in the initial combined20-check run (overlap; not an additional unique count). Scoped production TypeScript includes both actual writers, engine types and remediation route.

Independent review found the SDK-retry gap; the correction was reviewed as resolved, with no remaining important findings. All network/SDK responses and guard authority are simulated. No provider call, human decision, deployment, setting/schema/grant/credential, paid CI or publication occurred. Exact clean28d967e8 full production build and Next TypeScript passed, including the prior owner-binding repair. Receipt: governance-legacy-write-build.json.

## Still incomplete

Canonical organization/resource/provider binding and real mounted trusted issuance for these legacy flows; durable unknown-outcome composition for any future positive migration; complete execution coverage/enrollment and composed active-enforcement acceptance. Existing consumer result handling must be reviewed before mounting a real positive issuer—transport-level uncertainty alone is not a complete durable workflow. Do not turn a test no-op closure into production authority, register a disabled/imported path as covered admission, or claim full Governance completion.

Evidence: /private/tmp/axiom-legacy-{gh-boundary-red,gh-boundary-green,gh-boundary-final,iam-boundary-red,iam-retry-red,iam-retry-green,write-boundaries,write-types}.log.
