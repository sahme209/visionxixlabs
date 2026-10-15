# Neon preview capacity dependency audit

Read-only metadata observation: 2026-10-15 UTC. Known project `visionxixlabs` (`odd-union-57413470`), default branch `main`. No connection-string or decrypted-secret getters, SQL, data rows, Time Travel, provisioning, deletion, upgrades or deployment actions were used. Endpoint hosts/IDs and owner information are intentionally omitted.

## Verified inventory

The Neon branch listing returned ten branches: one ready default/main branch, six ready preview branches and three archived preview branches. All nine preview branches identify Vercel as their creation source and main as parent. The endpoint listing returned ten read-write endpoints: main active and nine preview endpoints idle. Idle/suspended compute and archived branch state do not establish absence of clients or retention requirements.

The known ten-of-ten capacity blocker is consistent with this count; this audit did not independently inspect plan entitlement. No capacity was freed or purchased.

For each preview branch, a branch-filtered Vercel deployment listing and the latest retained READY non-production deployment metadata were inspected. Every one has a matching Git ref and one retained alias. None of these nine sampled aliases is the public product domain. These are known retained deployment references correlated by Git ref, **not verified database bindings**: deployment metadata does not expose the Neon branch/database binding. Historical deployments with target `production` also exist on several feature refs, which is not proof that they currently serve production.

| Neon preview branch | Neon state | Retained READY preview / alias | GitHub PR metadata | Classification |
| --- | --- | --- | --- | --- |
| `preview/codex/workspace-integration-foundation` | archived | Yes / one | #4 merged | Known retained deployment reference; actual DB clients unknown |
| `preview/codex/request-revision-iteration` | archived | Yes / one | #2 merged | Known retained deployment reference; actual DB clients unknown |
| `preview/codex/push-all-changes-20260930` | archived | Yes / one | No matching PR returned | Known retained deployment reference; actual DB clients unknown |
| `preview/fix/models-screen-stuck-checking` | ready | Yes / one | #8 merged | Known retained deployment reference; actual DB clients unknown |
| `preview/hotfix/terraform-apply-kill-switch` | ready | Yes / one | #3 merged | Known retained deployment reference; actual DB clients unknown |
| `preview/fix/membership-bootstrap-observability` | ready | Yes / one | #7 merged | Known retained deployment reference; actual DB clients unknown |
| `preview/fix/github-app-manifest-same-origin` | ready | Yes / one | #9 merged | Known retained deployment reference; actual DB clients unknown |
| `preview/docs/p03-terraform-flag-resolved` | ready | Yes / one | #6 merged | Known retained deployment reference; actual DB clients unknown |
| `preview/fix/production-migration-audit-event-status` | ready | Yes / one | #5 merged | Known retained deployment reference; actual DB clients unknown |

The first branch's deployment listing was limited to ten results and has an older-page continuation. Other sampled branch listings returned one to four deployments without an older-page continuation. The sample establishes retained references, not an exhaustive all-project client map. GitHub search results were followed by explicit PR metadata reads for #2–9; all eight are closed and merged. Closed PR status does not authorize removing its database or retained deployment.

## Production binding remains unverified

Main has `protected:false`. Metadata separately reports integration-managed restrictions on deleting the branch, deleting its read-write endpoint and moving that endpoint through the API, with reasons identifying a Vercel production designation. These restrictions prove neither branch protection nor recovery readiness nor serving-deployment database equality. Preserve `bindingNotYetVerified`.

A scoped Vercel Neon integration-configuration listing returned an empty result. This does not establish that there is no integration: provider-managed integration/resource scope and deployment-captured binding may not be represented by that listing. No secret-based comparison was attempted.

## Safe capacity resolution plan (not executed)

1. Preserve main and all existing branches while constructing a private operator dependency attestation. The three archived branches are review priorities because of archival state, **not authorized-unused candidates**: each still has a retained READY preview alias.
2. Privately correlate project integration resource mappings and captured deployment environments with each exact Neon branch/database. Include all retained preview/custom deployments, production/rollback candidates, CI environments, local clients, external services and recovery/retention obligations. Public branch names and alias metadata cannot answer this.
3. Record a sanitized per-branch result: known dependent client count/categories, current alias/rollback requirement, unknown clients remaining, data-retention owner decision and whether a replacement/retirement is explicitly authorized. Do not publish connection strings, endpoint hosts or account records.
4. Only after dependencies and retention are resolved, present the exact proposed branch retirement or separately approved capacity purchase/provisioning action, impact and recovery limitations for approval. This audit recommends neither deletion nor upgrade. Merely removing an alias would not establish that direct deployment URLs or other clients stopped using the database.
5. After a separately approved capacity action, verify capacity with metadata, then seek approval for an isolated recovery rehearsal branch. Capacity availability itself is not proof of a usable PITR timestamp, correct serving binding or restore readiness.

At present: **zero branches verified unused; zero deletion actions authorized**. The next essential private evidence is the operator attestation of actual deployment/database binding and clients/retention, followed by a reviewed capacity decision. Existing six-hour history configuration is not a restore rehearsal result. Authentication-only production repair remains gated by correct binding, usable recovery point, verified restore procedure and explicit approval of exact SQL; unrelated engineering can continue.

## Evidence sources and limits

Connected read-only metadata tools: Neon list_branches/list_postgres_endpoints; Vercel list_projects, branch-filtered list_deployments, get_deployment and scoped list_integration_configurations; GitHub search_prs/get_pr_info. No raw provider responses are stored in this document. Results are a point-in-time inventory and may change as integrations create or retire previews. This document does not certify live preview database health, login success, lack of unknown clients, production binding or safe deletion.
