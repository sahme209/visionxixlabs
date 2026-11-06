# Proposed local containment of the unqualified legacy bot call

## Problem and evidence

Four synthetic diagnostic cases retain the actual route→orchestrator→legacy manager→Gateway provider and intercept only the terminal SDK/storage/rate boundaries. The positive call reaches the mock SDK with no workspace attribution or admitted-manager selection; existing missing-configuration503/rate429/message-limit403 controls hold. This is not a demonstrated production leak, an authenticated bypass or an unauthorized charge. Intentional public-embed source means absence of viewer login alone is not a defect.

## Recommended bounded local change — approval required

After the existing IP rate check, return an explicit503 unavailable response before Gateway configuration handling, body parsing, bot/source database reads, model dispatch or message-count writes. Keep the429 rate behavior. State that legacy bot inference is unavailable pending a supported publication/owner/policy/cost-admission contract; do not pretend that adding a session check supplies that contract. Update only this route and focused synthetic tests. Preserve old diagnostic evidence; retain normal admitted app/workforce AI paths.

This temporarily removes legacy inference availability in local code. It could affect a legacy public bot caller if later deployed; live caller/customer inventory has NOT been established. Do not silently declare the public-bot product retired, delete Bot/source data, change embed.js, or substitute workspace billing for owner membership. A future supported public-bot workflow remains a separate design decision.

## Acceptance and limits

Proposed tests: allowed-rate request returns explicit503 with zero bot/source/ledger/model/counter calls, regardless of Gateway configuration or supplied botID; denied-rate remains429; relevant admitted-manager tests remain unchanged. Inspect actual route before first side effect. Code and isolated synthetic tests only, no real provider/inference, database, schema/config, secret, grant, package, production deployment or spending. No claim of full AI/Governance/A7 coverage or live safety. Rollback is reverting the local route/test commit; no persisted records or consumed effects are touched.

## Alternatives

1. Implement an explicit public-bot publication/owner admission/accounting contract first: preserves useful embedding but requires a larger reviewed scope and actual commercial/data decisions.
2. Leave the current call family unchanged but label it unqualified: avoids availability change while leaving the observed metering/ownership qualification gaps open.
3. Recommended temporary local containment above: bounded and reversible, pending the product decision. Production activation would need its own separate permission and acceptance.

Your validation-first master-plan requirement calls for review before changing this inference/availability boundary. This proposal does not authorize implementation.
