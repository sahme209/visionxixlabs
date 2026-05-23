# VisionXIXLabs SDK Snippets

Drop-in single-file clients for the VisionXIXLabs v1 API.

Each language directory contains one file that gives you:
- A typed client wrapping every public `/api/v1/*` endpoint.
- An HMAC-SHA256 verifier for inbound webhook deliveries.
- Closed-union typed responses that match the platform's
  `WebhookEventKind`, `ApiKeyScope`, and `GateBlockerKind` unions.
- Zero external dependencies — copy the file into your project and ship.

## Languages

| Language   | File                                  | Min runtime         |
|------------|---------------------------------------|---------------------|
| Swift      | `swift/VisionXIXLabs.swift`           | iOS 13 / macOS 10.15 |
| TypeScript | `typescript/visionxixlabs.ts`         | Node 18+, Bun, Deno, Workers, Edge |
| Python     | `python/visionxixlabs.py`             | Python 3.9+         |
| Go         | `go/visionxixlabs.go`                 | Go 1.21+            |

## 3-line integration test

The fastest way to confirm your API key + network path is healthy is to
hit `GET /api/v1/whoami`. Every SDK exposes a one-liner:

### Swift
```swift
let client = VisionXIXLabs(apiKey: "vxlk_live_…")
let me = try await client.whoami()
print(me.organization.planTier)            // "growth"
```

### TypeScript
```ts
const client = new VisionXIXLabs({ apiKey: process.env.VXL_API_KEY! });
const me = await client.whoami();
console.log(me.organization.planTier);     // "growth"
```

### Python
```python
client = VisionXIXLabs(api_key=os.environ["VXL_API_KEY"])
me = client.whoami()
print(me["organization"]["planTier"])      # "growth"
```

### Go
```go
client := visionxixlabs.New(os.Getenv("VXL_API_KEY"))
me, err := client.Whoami(ctx)
log.Println(me.Organization.PlanTier)      // "growth"
```

## CI deploy gate

Use the release-gate endpoint to refuse deploys when last night's eval
regressed. Every SDK exposes `releaseGate()` / `ReleaseGate(ctx)`.

```bash
# Plain curl works too — the SDKs are just typed sugar over this:
curl -fsS -H "Authorization: Bearer $VXL_API_KEY" \
  https://visionxixlabs.com/api/v1/release-gate \
  | jq -e '.gate.passed' >/dev/null || exit 1
```

## Webhook signature verification

When you register a webhook endpoint, the platform returns a `secret`
ONCE. The integrator stores that secret and uses it to verify every
delivery's `X-VXL-Signature` header.

The canonical signed payload is `"<X-VXL-Timestamp>.<rawBody>"`. Every
SDK ships a `verifyWebhookSignature` helper that:

1. Recomputes HMAC-SHA256(secret, payload).
2. Compares constant-time against the header.
3. Rejects timestamps outside a ±5 minute window (replay protection).

### Swift
```swift
let ok = VisionXIXLabs.verifyWebhookSignature(
    rawBody: rawBody,
    signatureHex: req.headers["X-VXL-Signature"]!,
    timestampSec: Int(req.headers["X-VXL-Timestamp"]!)!,
    secret: endpointSecret
)
```

### TypeScript
```ts
const ok = await verifyWebhookSignature({
  rawBody,
  signatureHex: req.headers["x-vxl-signature"] as string,
  timestampSec: parseInt(req.headers["x-vxl-timestamp"] as string, 10),
  secret: endpointSecret,
});
```

### Python
```python
ok = verify_webhook_signature(
    raw_body=request.body.decode(),
    signature_hex=request.headers["X-VXL-Signature"],
    timestamp_sec=int(request.headers["X-VXL-Timestamp"]),
    secret=endpoint_secret,
)
```

### Go
```go
ok := visionxixlabs.VerifyWebhookSignature(
    rawBody,
    req.Header.Get("X-VXL-Signature"),
    timestampSec,
    endpointSecret,
    0, // 0 → default tolerance of 300s
)
```

## Idempotency

`POST /api/v1/pipelines/runs` accepts an optional **`Idempotency-Key`**
header. When supplied, the platform deduplicates retries:

| Scenario | Response |
|----------|----------|
| First call with key `K` | 202 + new run; result cached for 24h |
| Same key `K` + same body | 200 with `X-VXL-Idempotent-Replay: true` |
| Same key `K` + different body | 422 `body_mismatch` |
| Same key `K` while first call still processing | 409 `in_flight` |
| After 24h, same key `K` | 202 + new run (cache expired) |

Key format: 8–255 characters from `[A-Za-z0-9_\-./:]` (UUIDs, ULIDs,
nanoid, namespaced like `ci_job:12345`).

```bash
curl -X POST https://visionxixlabs.com/api/v1/pipelines/runs \
  -H "Authorization: Bearer vxlk_live_..." \
  -H "Idempotency-Key: 9c5b94b1-35ad-49bb-b118-8e8fc24abf80" \
  -d '{ "pipelineId": "ai_coding", ... }'
```

This is critical for CI runners where a transient network failure
could otherwise fire two pipeline runs.

## Endpoints covered

| Endpoint                          | Required scope        | SDK method            |
|-----------------------------------|-----------------------|-----------------------|
| `GET  /api/v1/whoami`             | any read-class        | `whoami()`            |
| `GET  /api/v1/release-gate`       | `release_gate:read`   | `releaseGate()`       |
| `POST /api/v1/pipelines/runs`     | `pipeline:trigger`    | `startCodingRun()`    |
| `GET  /api/v1/pipelines/runs/{id}`| `pipeline:read`       | `pipelineRun(id)`     |

## Error handling

Every SDK raises a typed error on non-2xx responses with:
- the HTTP status
- the closed-union `error` code (e.g. `quota_exhausted`, `missing_scope`,
  `unknown_token`, `parse_failed`)
- the optional `retry_after_seconds` (from the `Retry-After` header on
  429s — back off until the next monthly reset)

## Webhook event types

The platform delivers these closed-union `X-VXL-Event-Type` values:

```
release_gate.passed         pipeline.run_started        api_key.created
release_gate.blocked        pipeline.run_completed      api_key.revoked
eval.regression_detected    pipeline.run_failed         billing.threshold_crossed
eval.run_completed          pipeline.stage_failed       billing.quota_exhausted
coding.pr_opened            coding.lint_failed          coding.test_failed
```

## Versioning

These SDKs target the v1 API. The envelope version (`version: "v1"` in
every webhook payload) will bump if the wire format changes; the SDKs
will publish a `v2` directory at the same time so you can stay on v1
indefinitely.
