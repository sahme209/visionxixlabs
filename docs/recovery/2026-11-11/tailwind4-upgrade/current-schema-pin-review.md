# Current-schema unit-helper review

This restores the two macOS mock-only unit tests; it does not qualify an issuer,
restore an old packet, run an engine, generate/apply SQL, or change production.

- Old schema SHA256: `50e1fbbf50d5d28ba08e862a72789de3c5a9fdad5d7589751a86e0135c5eb031`, located exactly at commit `0253588b`.
- Current main schema SHA256: `4a8c274ec951f381a04a2c6e9bbf4d2d2e5f6f98c1054f4c756dac41b6bd202b`, introduced by `07d7863b`, present at `172bf5ee`.
- Reviewed complete diff: only appended `AuditSeal` and `AgentGatewayRequest` (65 lines). No existing model, field, datasource, index or generator is changed by this repair. The main schema file itself is untouched.
- The mocked compiler's full model list is derived from the actual current schema; missing table coverage still refuses. Engine pin `57b090d4...fa408a`, synthetic seed and `qualification:false` remain unchanged.
- New platform-independent negative test changes only schema comment bytes and requires refusal before even opening a nonexistent engine path or invoking the compiler. No new skips/suppressions.

## Historical authority stays closed

`scripts/governance_local_issuer/fixture_recipe_packet.py` independently retains
its original SCHEMA_SHA `50e1...`. Existing packets also bind the helper's old
hash. They deliberately cannot use this changed helper; no packet or historical
receipt was rewritten. A new operational export remains a separate reviewed and
authorized action. Independent review explicitly checked this boundary.
