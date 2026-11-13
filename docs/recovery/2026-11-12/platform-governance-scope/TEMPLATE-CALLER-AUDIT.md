# Template caller and contract migration — local source audit

Covered source scan: app, lib, scripts, desktop and packages; TypeScript/TSX/JS/Python/shell sources, excluding vendored dependencies, test files and historical qualification material. Searched actual template helper symbols, resource namespace/override name and AWS bucket/upload/presigner operations, then inspected the concrete matches. This is source evidence, not universal runtime/fleet qualification.

- `app/api/aws/quick-deploy-url/route.ts` is the only production compatibility-helper consumer found. It calls `ensureTemplatePublished()` without execution authority; the helper returns review-required before credentials or native I/O. No GET publication, URL override or automatic grant exists.
- `templateHosting.ts` compatibility writers/signing are retired shims; shared bounded body and exact signed-URL validation remain for the replacement adapter. Broker environment fallback/native clients were removed from this module.
- Generic action claim/child/final-send and `runPlatformEffect` refuse every template family, including mixed legacy plans. Old source previews/metadata review/history remain without gaining execution authority.
- Actual new native operations are in `templateNativeTransport.ts`, reached by the private `templateExecutionStore.ts` through committed SQL admission, required private qualification and one-use observations. Real resources remain unavailable by default; no shipping handler is registered.
- `lib/config/env.ts` still parses an unused legacy URL field; no source consumer of that field was found. It does not authorize an override or publication.
- `AwsKeyConnect.tsx` retains separate historical broker/AssumeRole policy guidance. Its old object-path example is NOT evidence of valid permissions for the new content-addressed profile. No grant/policy was expanded or qualified. Known template-review refusals now take a dedicated read-only operator notice before those controls. Full customer-role onboarding/IAM qualification remains separate.

## Preserved contracts

| Former legacy acceptance | Replacement evidence |
|---|---|
| us-east-1 creation risk; fixed regional endpoint/no retry | Migrated native contract tests plus exact binding profile and actual SDK configuration tests |
| Conditional upload, expected owner, current bytes, enabled versioning, non-null version | Migrated native tests and joined SQL successful/unknown upload cases |
| Exact-version/content readback before signing | Migrated native tests and joined native/SQL access issuance |
| Signature host/version/TTL/headers/date/credential/owner substitutions | Migrated native contract cases; existing strict shared validator retained |
| Revocation after asynchronous read/sign | Migrated native tests and new actual SQL reviewer revocation during readback; no artifact or replay |
| Expiry during authorization or result recording | Native post-sign expiry case; validated private observation remains historical while output admission rejects expired grants; actual SQL delivery expiry under a still-current review |
| Installed SDK presigner with synthetic credentials | Existing `templateNativeTransport.test.ts` installed-SDK case and joined SQL access execution, with intercepted native reads |
| Paired HMAC/source preview/review | Existing SQL fixture retains this flow; old default execution now refuses before attempt/native read. Full new authenticated workflow follows in Task5. |

No positive capability was replaced solely with unconditional-denial tests: all three replacement operations and durable output are covered by actual isolated SQL with simulated native/key/profile/channel sources. Old test meanings were updated explicitly for intentional retirement, without asserting live qualification or customer availability. No real AWS action, permission change, signing-key operation, production change or spending.
