# Agent requester recovery lookup — local increment

Added read-only lookup by original proposal and authenticated requester/organization. It reads the original deterministic operation and validates its immutable binding/history, even if source arguments subsequently change. Current paired-session reader authority is mandatory; no match returns null, ambiguous matches refuse. It never prepares, claims, adopts a different executor session or calls a provider.

Two actual isolated PostgreSQL checks failed against the unavailable stub, then passed with implementation (16 unrelated checks filtered). Provider/auth policy simulated; real stored rows, transactions and database clock. Owned fixture /private/tmp/axiom-execution-policy-pg-iv_nyrw3 stopped. Logs: /private/tmp/axiom-agent-requester-lookup-{red,green}-pg.log.

Public metadata projection rejects private fields and inconsistent state/receipt pairs. Seven focused checks pass after two reproduced receipt-validation failures. Scoped source types pass. Logs: /private/tmp/axiom-agent-dto-{red,green}.log and /private/tmp/axiom-agent-requester-lookup-final-types.log.

Task3 remains unfinished: paired HTTP/service and actual fixed transport execution composition are not mounted. No independent review of this increment yet, no full build, deployment, provider call or native acceptance. Do not ship the intermediate review-only workflow as complete execution separation. Tasks3–5 and full Governance enforcement remain open.

## Paired requester service increment

`agentActionExecutionRequestService.ts` composes the durable store with the existing paired-session resolver (API keys refused, heartbeat writes disabled) and commercial access reader. Exact actor/tenant/session is rechecked by the locked store port. Preparation is default-OFF via AXIOM_AGENT_REQUESTER_EXECUTION_ENABLED; it is rechecked during execution authority. Recovery read/lookup/cancel remain available without enabling execution. No execute operation or HTTP route is exposed yet.

Eight composition tests pass with mocked store/auth/commercial dependencies; these are not real authentication or provider acceptance. Initial missing-service import was RED. Source-scoped TypeScript includes this actual service and passes: work/governance-intelligence/tsconfig.agent-requester-service.json, log /private/tmp/axiom-agent-request-service-final-types.log. Test log /private/tmp/axiom-agent-request-service-green.log. Independent composition/database journey and HTTP boundary remain next, followed by actual fixed transport wiring. Full workflow remains unshippable pending Tasks3–5.
