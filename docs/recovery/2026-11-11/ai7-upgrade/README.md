# AI SDK 7 upgrade — November 11, 2026

Implementation; merge requires all green CI checks. Production remains build 4 (`a344f4f6`). AWS PR #315 merged
with all green checks before this batch began. No real model/provider call,
credential, database migration, deployment, feature flag or billing change.

## Source and protocol review

`dependency-fix.yml` run 43089439933 generated exact ai 7.0.170 and its lockfile:
Gateway 4.0.143, provider 4.0.37, provider-utils 5.0.79. No lock edits by hand.
AI 7 requires Node >=22; CI and local checks use Node 24.

Reviewed installed Gateway source against the public package CDN; hashes match
(`source-hashes.json`). `createGateway` defaults to
`https://ai-gateway.vercel.sh/v4/ai`; `GatewayLanguageModel.getUrl` appends
`/language-model`; its protocol header is `4`. This is the existing Vercel
origin, not a new provider or a caller-selected URL. Official documentation:
https://vercel.com/docs/ai-gateway and
https://vercel.com/docs/ai-gateway/models-and-providers/provider-filtering-and-ordering.

The real installed-SDK dispatch test first failed at its old v3 URL assertion.
After reviewing/re-pinning that URL it exposed another actual change: SDK7's
`prepareToolChoice` defaults to `{type: "auto"}` even without tools. The
existing text-only adapter now explicitly passes `toolChoice: "none"` for text
and streaming. Tests require `{type: "none"}` and no tools on the serialized
request. No tool capability, fallback route or additional paid attempt is added.

The coding test retains exact redacted prompt/system, output cap, Anthropic-only
route, no tools, one consumed dispatch and refusal to reuse it after a transport
failure. The matching PostgreSQL and route-composition test transports use the same reviewed v4
URL; their store/admission assertions are unchanged. The two manual root-tooling workflows
(auth preflight and production migration) select Node 24 to satisfy the new
minimum; neither workflow is dispatched. Desktop-only Node 20 jobs do not
install/import this root AI SDK and remain unchanged. Native v4 streaming mocks
now test completion metadata, interruption, safe errors and terminal usage.

## Living documents and acceptance

No connector, product flow, route, public API, guide or UI changes: no ModuleIntro,
demo, guide count, heading index or four-language SDK update applies. Corpus
freshness is checked. Handoff and remaining-work records are updated here.
No live provider acceptance or enabled Governance/offline capability is claimed.

## Local validation

- 651 focused AI/installed-route/governed-call tests PASS across 47 files.
- Full Vitest: 17,806 passed, 893 skipped, one expected failure; the same two
  pre-existing Apple-silicon-only schema-pin fixture failures remain. Exact
  baseline cause/hashes are recorded in `../aws-sdk-upgrade/README.md`; this
  batch does not change those pins or claim a fully green local suite.
- Root TypeScript (12 GiB heap), desktop TypeScript and Vite build PASS.
- Python CLI: 36 tests PASS. Corpus generator: 104 sections, no output changes.
- All source pins and generated lockfile hash verified. Two independent review
  passes found no actionable issue. CI for this branch is still a merge gate.

Not verified: live AI inference, production Node-version qualification, paid
metering, and the six changed PostgreSQL fixture transports (not executed against
an owned database in this batch). Synthetic wire tests exercise the installed
SDK, not a live model. No real database or AI call was made.

## Deployment runtime gate

Production Node >=22 must be confirmed before an owner-approved deploy. The
read-only deployment connector did not provide a usable Node-version field;
this is not a claim that production was qualified or changed. All code tests
use Node 24. No environment, runtime setting or deployment was changed.
