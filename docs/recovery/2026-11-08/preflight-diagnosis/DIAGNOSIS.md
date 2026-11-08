# Production read-only preflight — offline diagnosis (2026-11-08)

Prepared by Claude from repository source and receipts only. **No provider, Vercel, Neon, SQL or credential call was made.** Status: diagnosis prepared; the diagnostic itself is **not run** and needs fresh authority.

## What is known

- Preflight runner: `../../2026-11-06/consolidated-final-batch/schema-readonly-preflight-3/private-isolate-preflight.cjs`; parser: `scripts/schema-endpoint-binding.cjs`.
- Nov 6 attempt (`OBSERVED-RESULT.json`): exactly **1 call** (`vercel_filter_project_envs`), no SQL, then `private_readonly_preflight_stopped`.
- Nov 8 attempt: same `unverified/private_readonly_preflight_stopped`; phase and call count not exposed. Handoff: the two earlier attempts also stopped in environment metadata.
- So every recorded attempt stopped **before any Neon call or SQL**, at the first step: Vercel env metadata → `selectDatabaseEnvId` returned null, or the call threw.

## Why it can't be diagnosed from the result

The runner maps six distinct conditions to one indistinguishable `stop()`:

| # | Condition | Where |
|---|---|---|
| 1 | Tool call threw (auth, parameter validation, tool missing in the runtime) | runner `try/catch` |
| 2 | Response `isError: true` | `normalizeToolResponse` |
| 3 | Unrecognized shape: ≠1 text block, non-JSON, or no top-level `envs` array (e.g. nested under `data`/`result`, or a bare array) | `normalizeToolResponse`, `selected` |
| 4 | Not exactly one `DATABASE_URL` whose `target` array includes `production` (0 if the integration names it e.g. `POSTGRES_URL`; ≥2 if branch- or custom-environment-scoped records also target production) | `selected` |
| 5 | `updatedAt` not a safe integer (e.g. ISO string, or absent in filtered output) | `selected` |
| 6 | `id` fails `^[A-Za-z0-9_-]{1,100}$` | `selected` |

The source cannot say which applies; the original never retained the response (by design). **No cause is claimed here.** Two environment notes:

- The runner calls `mcp__codex_apps__*` tool names, which exist only in Codex's runtime; this Claude session has no Vercel/Neon connector. Run in Codex, or map to an equivalent authenticated tool.
- It passes `decrypt:'false'` as a string. That matches Vercel's query-string semantics, but if the MCP tool schema expects a boolean it may reject the call (condition 1). The diagnostic deliberately keeps the identical argument so it reproduces the same call.

## The fix: counts-only diagnostic (prepared, mocked-tested)

`env-metadata-diagnostic.cjs` makes the **same single Vercel metadata call** and returns only a fixed reason code from the six conditions above plus non-identifying counts (env count, `DATABASE_URL` count, production-targeted count, target shapes, counts with git-branch/custom-environment scoping, pagination present). It never returns values, IDs, URLs, key names (other than the fixed literal), branch names or raw errors. No Neon call, no `get_project_env`, no SQL, no retry.

Mocked checks (no provider calls; run on Claude's Mac with plain Node):

```bash
node docs/recovery/2026-11-08/preflight-diagnosis/test-env-metadata-diagnostic.cjs      # 14 cases PASS, no leaks
node scripts/tests/test_schema_endpoint_binding.cjs                                      # 9 cases PASS (existing)
node docs/recovery/2026-11-06/consolidated-final-batch/schema-readonly-preflight-3/test-private-isolate-preflight.cjs  # 3 cases PASS (existing)
```

## What each result would mean

| Reason code | Next step (each needs its own review) |
|---|---|
| `tool_unavailable` / `tool_threw` / `tool_is_error` | Runtime/auth/parameter problem, not data. Check the tool's schema and connection; no data conclusion. |
| `text_block_count_not_one` / `text_not_json` / `envs_not_array` | Response shape differs from the parser. Adjust `normalizeToolResponse`/`selected` for the observed shape, re-test mocked. |
| `production_database_url_count_not_one` | Data shape: 0 means a differently named variable; ≥2 means scoped duplicates. Decide, with the user, the exact selection rule (never guess). |
| `id_shape_invalid` / `updated_at_not_safe_integer` | Narrow parser fix for that field type. |
| `metadata_shape_accepted` | Step 1 is fine; the stop happened later or intermittently. Then a phase-coded version of the full runner is needed. |

## Authority requested (not granted)

**One** call of `vercel_filter_project_envs` (project `prj_BwKc7V1daPJ938ZW2QKYxZsTkZnp`, team `team_j0CEiAAorasdEVQyeAJjpNfm`, `decrypt:'false'`) through `runEnvMetadataDiagnostic`, from Codex's runtime (or an equivalent authenticated tool), returning only the reason/counts object. No retry, no Neon, no SQL, no env value read, no write. The full preflight stays consumed and would need its own fresh approval after a parser fix.

Deployment stays blocked until types + tests, one frozen production build, and the production DB compatibility check (`PipelineAICallReservation.admissionContract`, `quoteEvidence`, recovery, cutover) all pass.
