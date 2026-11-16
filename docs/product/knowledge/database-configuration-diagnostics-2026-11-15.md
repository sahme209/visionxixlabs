# Private database configuration diagnostic map

INTERNAL SOURCE NOTE. Unpublished and customer/retrieval ineligible. November 15, 2026. These are static codes for private server/build diagnosis, not live configuration findings or a public troubleshooting interface.

`postgresConnectionOptions` retains the message `postgres_connection_configuration_unavailable` and attaches only a fixed string `Error.cause`. It never attaches the rejected target, its fields, query names/values or a native parser exception. No new logging or environment access is introduced. Acceptance predicates, their evaluation order, defaults, TLS and target identity remain unchanged. Codes describe grouped refusal sites; they do not identify rejected field values.

| Cause | Existing refusal site |
|---|---|
| PCP_001 | Input type, absence, length, outer whitespace or literal control/space envelope |
| PCP_002 | URL parsing |
| PCP_003 | Protocol, required URL identity/path structure or fragment |
| PCP_004 | Unsupported or duplicate query option |
| PCP_005 | Schema selection |
| PCP_006 | Certificate acceptance selection |
| PCP_007 | Channel binding selection, including unsupported strict requirement |
| PCP_008 | Pooler selection syntax |
| PCP_009 | Port range |
| PCP_010 | Local Unix socket selection, character or length constraints |
| PCP_011 | TLS mode selection or remote TLS disablement |
| PCP_012 | Identity/password/database percent decoding |
| PCP_013 | Decoded identity/database absence or decoded null character |
| PCP_014 | Application identifier absence, length or control characters |
| PCP_020 / PCP_021 | Connection limit integer syntax / range |
| PCP_022 / PCP_023 | Connection timeout integer syntax / converted range |
| PCP_024 / PCP_025 | Pool timeout integer syntax / converted range |
| PCP_026 / PCP_027 | Query timeout integer syntax / converted range |
| PCP_028 / PCP_029 | Idle lifetime integer syntax / converted range |

Source: [connection policy](../../../lib/database/postgresConnectionPolicy.ts) and [synthetic diagnostic tests](../../../lib/database/__tests__/postgresConnectionDiagnostics.test.ts). Tests cover every code, nested error inspection without synthetic private input, original refusal precedence and accepted option results. Existing policy, driver, factory and direct-session tests retain their assertions. No SQL, real TLS session, account/configuration read, provider call, preview deployment or production operation is established by these checks. The cause of the observed preview refusal remains unknown until an authorized build actually reports its fixed diagnostic code; no unsupported setting is accepted to bypass that refusal.
