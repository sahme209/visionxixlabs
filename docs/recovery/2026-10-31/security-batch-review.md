# Local AI observability security batch

Prepared October 31, 2026. Latest verified narrow candidate: `b3191cb3d2cbc5ea314093bd271afbbf03500635`. This is a review handoff, not a deployment approval or independent security assessment.

## Completed local repairs

| Area | Result | Evidence |
|---|---|---|
| Tenant isolation | Customer JSON/CSV global requests refuse before log queries; direct global engine pages redirect. Normal queries use the authenticated organization. Customer global controls removed. Workspace OWNER is not platform-wide authority. | ai-log-tenant-boundary-local.json: RED3/GREEN25 route/responder mock tests; production build/types pass |
| AI call-log diagnostics | Known-credential redaction before persistence and historical serialization; fixed read-failure message. Stored historical rows unchanged. | ai-log-disclosure-local.json:20 mock responder tests, focused types; full production build/types pass after dependency recovery |
| Invocation metadata and counters | Separate AIInvocation logger redacts metadata and omits contaminated correlation IDs. Invalid/negative/fractional/non-finite/storage-overflow token counts omitted; genuine zero preserved. | token-integrity-local.json:12 mock-store tests and production build/types pass |
| Desktop call-log isolation | Context changes remount local state; obsolete responses/errors cannot replace current workspace results. Arbitrary transport error strings are not displayed. | ai-log-context-fence-local.json / ai-log-safe-errors-local.json: latest5 component tests; desktop/native build/signing pass |
| Token transparency | Total-only provider reports retained; missing counts distinguished from zero. Call-log input/output/total labels explicit. Bot shows instruction/context character sizes without token estimates or automatic trimming. | token-evidence-delivery.json / prompt-size-delivery.json / ai-log-clarity-local.json |

Test counts overlap across successive runs; do not sum them into a unique total. Providers, request authority and repositories were simulated in these tests. No live cross-tenant probe, real customer database mutation, paid AI call or provider write was performed.

## Production gate

Production remains unchanged. The tenant-isolation source finding is important; prioritize a narrow activation review. Do not describe these local controls as active production protection.

1. Narrow candidate **b3191cb3d2cbc5ea314093bd271afbbf03500635** is now prepared from recorded production **3b59629124f7db241ec82df99ae8baecee0dbcd7**, with51 candidate tests and its exact production build/types passed. Reconcile the actual live production base before activation. The development branch contains unfinished Governance work and must not be promoted wholesale. See narrow-security-candidate.json for the10-file manifest and backup evidence.
2. Complete final review of the exact narrow diff. Candidate-specific build/test evidence now exists; any later source change requires proportionate revalidation.
3. Obtain the specific Vercel-freeze exception before any upload/deployment. No schema, role/grant, credential or provider-action change is part of these repairs.
4. After an authorized rollout, verify only appropriately scoped session/access responses. Cross-tenant live tests require controlled test tenants and explicit authorization; do not probe other customers.
5. Keep the active local desktop session intact. Public immutable v0.1.21 installers remain unchanged; desktop distribution follows its separately protected publication process.

## Build recovery

The previous production type stall was traced to a filesystem read on an SDK declaration marked dataless. A temporary dependency overlay restored143 existing SDK packages with exact lockfile versions/integrities and scripts disabled. Preserve the original nested dependency trees too: flattening MSAL resolution selects the wrong already-installed version. A fresh build needed a process-only6144MiB heap on this24GB host. Source/compiler protections were not relaxed. See locked-sdk-build-recovery.md/json and the retained failed-attempt receipts.

## Limits and remaining product work

Pattern redaction is not general PII removal or detection of every secret. This batch is not an independent penetration test, zero-vulnerability guarantee, universal execution coverage or Governance MVP completion. Governance's real admission/coverage/workflow gates, ServiceNow's already-written unknown-note reconciliation/native lifecycle/closure, customer installation/Store acceptance and protected publication remain on the roadmap. Preserve all historical attempts and genuine human approvals.

Standing priorities: **security, visual quality, clarity and ease**. Token savings must be measured per equivalent successful task; these changes improve integrity/transparency and do not establish reduced token consumption.

Focused output review: CSV and the direct engine page previously bypassed responder redaction for old rows. Two RED tests reproduced it. The updated candidate applies canonical known-credential redaction at those outputs, before engine truncation/grouping;39 candidate tests and its full production build/types pass. This is self-review, not an independent assessment or blanket signoff. Preserve the specific activation gate.

Spreadsheet export review: CSV text with common ASCII/full-width formula prefixes or leading control prefixes receives a quoted tab safety prefix; ordinary CSV quotes and numeric values remain valid. All51 candidate tests and the exact production build/types pass. The UI identifies this as Spreadsheet CSV because safety prefixes affect raw programmatic imports. Based on [OWASP CSV Injection guidance](https://community.owasp.org/attacks/CSV_Injection); there is no universal sanitization guarantee across all spreadsheet tools and transformations. No live spreadsheet acceptance was performed.
