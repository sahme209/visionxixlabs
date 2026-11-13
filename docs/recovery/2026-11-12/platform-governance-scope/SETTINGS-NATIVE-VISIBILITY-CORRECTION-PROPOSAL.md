# Proposed local native visibility correction

Status: owner approved local correction/tests November12; deterministic mapping, explicit request/response checks and reviewer display are now implemented and isolated-tested. Actual qualified profiles/default/live execution remain unavailable. Evidence: SETTINGS-CURRENT-SOURCE-REVIEW.md (three approved official pages consumed).

The prepared create-only manifest distinguishes sensitivity and encrypted/plain storage, but the native request currently forwards encrypted/plain and omits visibility. Current Vercel documentation treats write-only Secret differently from readable encrypted Config. A qualified default cannot accept that ambiguity.

Proposed deterministic adapter behavior for NEW exact proposals under a newly qualified profile:
- sensitivity=secret requires the existing encrypted semantic selection and maps to native type=sensitive, visibility=secret.
- sensitivity=nonsecret retains encrypted/plain and maps to visibility=config.
- The reviewer-facing metadata explicitly displays that native mapping before the independent decision. Existing native receipt/source profiles are not silently renewed. Historical stored manifests/receipts remain readable with their original meaning; unsupported old/current profiles refuse execution.
- The actual single-variable POST includes explicit native type/visibility, no upsert/branch/custom-environment expansion. Response confirmation requires exact matching type and explicit visibility; omitted/contradictory fields remain unknown, never inferred success. Current private qualification remains mandatory before credential access and at final dispatch.
- Preparation/review/artifact context stays exact. Current requester, genuine reviewer, expiry, permanent native reservation, one child attempt and no automatic deployment/retry remain unchanged. Existing-setting updates stay unavailable.

Requested scope: local code, pure mapping/source-contract/transport tests and existing owned isolated SQL with synthetic values/keys/provider responses only. No real metadata read, secret/value/key access, provider setting, grant, flag, production schema, deployment or spending. Actual supplier/custody/completeness/race qualification remains separate. This proposal changes the native request/review semantics, so the owner's validation-first decision is required before implementation.
