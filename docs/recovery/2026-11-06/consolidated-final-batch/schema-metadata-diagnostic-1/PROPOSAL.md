# One private metadata-shape diagnostic — conditional proposal

Design only. No implementation, test, provider call or sensitive inspection performed. The prior preflight grant was consumed: exactly one filter_project_envs call occurred; no decrypted detail or SQL call occurred. Its generic unverified result establishes no underlying cause and no endpoint binding.

## Proposed single conditional decision

Authorize local implementation of one pure, strict allowlisted diagnostic projector; synthetic tests and independent review; freeze its exact source/hash and invocation; then, ONLY if those checks pass, ONE call to `mcp__codex_apps__vercel_filter_project_envs` with exactly:

```json
{"idOrName":"prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp","teamId":"team_j0CEiAAorasdEVQyeAJjpNfm","decrypt":"false"}
```

No retry, fallback, second provider call, get_project_env, decrypted environment detail, Neon operation, SQL, connection-string retrieval, configuration mutation, apply or deployment. This would be a fresh one-call diagnostic grant, not continuation/replay authority for the consumed eight-call preflight. Actual calls remain unauthorized until the user explicitly agrees to this proposal.

## Private handling and finite output

Capture the result only inside the reviewed private Functions isolate. Even decrypt=false is not a guarantee that every connector-returned value is harmless. Provider/platform/connector/private-session traces may retain raw responses; consent must explicitly acknowledge that limitation. The assistant will not display/quote raw responses, environment keys/values, IDs, timestamps, URI/passwords or raw errors in ordinary messages, public exports, workspace files/logs, process arguments/stdin or IPC. No promise of secure string erasure or prevention of private platform retention is made. Discard all raw response references before yielding. Catch exceptions without inspecting/stringifying message or stack.

Emit one bounded fixed-key JSON object containing ONLY reviewed enums/booleans:

- callOutcome: returned / exception.
- toolError: true / false / unknown (only the wrapper isError flag).
- envelope: structured_object / text_blocks / raw_object / unsupported.
- textBlockCount: zero / one / multiple / not_applicable; textParsing: accepted_json_object / malformed_or_unsupported / oversized / not_applicable.
- envArray: present / absent / not_applicable (inspect only the existing supported envs property).
- productionDatabaseMatches: zero / one / multiple / not_applicable, comparing the fixed DATABASE_URL key and production target internally, never returning any key.
- selectedId: valid / invalid / not_applicable, using the existing bounded ASCII-ID predicate without returning the ID.
- selectedUpdatedAt: missing / safe_integer / other_number / string / other / not_applicable. Never return its value or string contents.

Use existing supported normalization precedence, bounded1MiB single JSON text block, fixed field accesses and no dynamic key-name enumeration, response excerpts, exception categories inferred from error text, arbitrary nested-path probing or diagnostic arrays. Unknown shapes stop at the relevant finite category; do not relax the endpoint collector or continue to target inspection. The result is diagnosis of the observed shape only, not current-production identity, schema readiness, credential validity or permission.

## Before the actual call

Synthetic tests must cover exception/isError, unsupported envelopes, multiple/oversized/malformed text, object/array/null distinctions, zero/duplicate matching records, invalid ID and each updatedAt type. Place fake secrets in values, unknown keys and error messages; prove emitted output contains only exact allowlisted fields/enums, never those markers. Run the actual projector in a Functions-like isolate without URL/require/console/network APIs. Independent review must verify no IO/logging/secret forwarding, exact one-call invocation and no retry/detail/Neon/SQL path. Freeze implementation, tests, calling source and packet hashes before the one call; retain only the nonsecret categorical result and authorization/attempt evidence.

Any failed test/review, malformed result, call error or unknown category stops without another request. A later parser change or further read needs a separately reviewed decision. No schema write, row values/digests, new credentials, environment changes, backup creation or publication is included.
