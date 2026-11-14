# Combined source release — production preflight readiness

**Source-only assessment. No production, credential, database, network, build, push or deployment operation performed.** A combined PR/merge can be prepared independently; an owner Vercel deployment still needs the existing target/schema/driver gates resolved. Local website success does not resolve them.

| Gate | Existing evidence and smallest next step |
|---|---|
| Exact current production target | Last saved owner deployment observation is commit `0caaaaab6c809f2188d1a4c8fdd64980e6ef35f0`, observed November13UTC (`2026-11-12/platform-governance-scope/OWNER-DEPLOYMENT-READONLY-OBSERVATION.json`). It is historical, not a fresh configuration read. Current Vercel DATABASE_URL-to-Neon mapping remains unverified. The November13 allowance stopped after ONE metadata response, before any decrypted detail/Neon/SQL, and is consumed. |
| Baseline schema/migration discrepancy | November11's recorded Neon read found AuditSeal/AgentGatewayRequest and both November9 migration rows absent, contradicting historical build3. Cause remains unknown. The later metadata-only screen is prepared but unexecuted. Missing proposed platform tables alone do not block every unrelated web release; missing baseline/runtime tables and the old discrepancy still require reconciliation. |
| Genuine Prisma7 connection policy | `lib/database/postgresConnectionPolicy.ts` uses verified remote TLS, default pool10 and finite connect/pool budgets. `channel_binding=require` and legacy `statement_cache_size` are unsupported and refuse; no downgrade is permitted. The old pure `target-comparison/compare.cjs` only compares endpoint/database and parameter names: it allows those parameter names without proving current driver compatibility or a TLS handshake. Neither it nor Neon connector SELECT success is application-driver TLS/pool acceptance. Privately review the actual selected URL's policy compatibility without exposing it; genuine target/driver/TLS/pool and recovery evidence remain release gates, not waived by CI. |
| Exact release and owner deploy | After normal combined merge, require green applicable CI on exact main commit, compare `prisma/` with the confirmed last deployed commit, and retain defaults/flags closed. New migrations or required repair need separately reviewed precheck/apply/verify and owner-run writes; never apply old SQL or alter ledger automatically. Owner selects exact main commit in Vercel only after gates pass. |

## Reusable finite procedure — no new research needed

Reuse `docs/recovery/2026-11-13/production-compatibility-preparation/LIVE-READ-REVIEW.md`: at most FIVE calls, stop on any ambiguity/error, no retry:

1. Existing Vercel project/team environment metadata, decrypt=false; select exactly one unbranched production DATABASE_URL with the reviewed private selector.
2. Detail for ONLY that unchanged ID/update record; privately compare recorded endpoint/port/database. Never persist/log/echo URL, username/password or raw response. A current project variable is not proof of an older deployment's captured environment. Check current driver policy separately rather than treating endpoint match as TLS compatibility.
3. Recorded Neon endpoint in explicit project; confirm exact branch association.
4. That explicit Neon branch; confirm identity/protection. This is not backup/recovery proof.
5. One exact pinned metadata SELECT on explicit confirmed project/branch/compute/database, max_rows1. Preserve the same live invocation handle if delayed; do not restart or chase another target.

The existing SQL remains source-current by ordinary file reads today: schema SHA matches its inventory; all120 migration file hashes and their exact path set match;195 table names separate175 baseline from20 proposed platform models. Query SHA256 is **`23a6718683fba5baff445e24ab1f648ca8c03e56d478594e2fe37a6d83dc1098`**. It reads catalogs plus migration metadata, not application data/log/default-expression values. It is a structural screen, not complete schema/recovery/driver qualification.

## Smallest fresh owner permission

If the owner supplies/privately confirms the exact current production target and connection-policy facts, the narrowest next operation is ONE owner-run pinned SELECT in that target's Neon SQL Editor, returning only its metadata result. Do not request any secret to be pasted into chat. Otherwise ask once for the already reviewed maximum-five-call sequence above, explicitly including consent that private tool traces may retain the decrypted Vercel response. Earlier unused call slots cannot be reused. No schema write, setting change, restore/backup action, deployment or spending is included in that read permission.

A successful screen does not alone settle genuine driver TLS/pool compatibility or recovery identity. Record those exact remaining facts instead of promising immediate deployment; any additional actual application-driver connection must have explicit target-bound read-only scope. Do not launch another investigation loop or improvise a connection probe here.

The owner has requested a combined PR/merge followed by an owner deployment; this note does not send an approval question or expand that into credential/database operations. Follow CODEX_HANDOFF.md section7: owner runs approved database writes, owner clicks Vercel production, then separately scoped smoke checks and a release receipt. Governance activation, provider runtime/custody qualification and proposed platform schema deployment remain separate and disabled.
