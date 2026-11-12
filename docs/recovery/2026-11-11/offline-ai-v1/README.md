# Offline-AI v1 — local implementation in progress

Owner-approved ADR and exact v1 choices are merged in #324 (`3754c049`). Current branch `codex/offline-governed-ai-v1` implements the full plan at `docs/superpowers/plans/2026-11-11-offline-governed-ai-v1.md`; no feature PR is open.

Task1 supplies a pure installation-mode/operator-data contract: exact absent/false/true/invalid modes; bounded JSON; fixed OpenAI-compatible server kinds; exact declared hosts; HTTPS or explicit loopbackHTTP; declared model input/output/byte bounds; explicit per-workspace budget window/cap; immutable semantic digest and expiry/cross-workspace selection. Missing configuration/cap is not an allowance. No environment/DNS/DB/server/model/credential read or execution authority is obtained by parsing. Declared model bounds still need qualification before admission.

Tests: module absence first, non-implementing stub7fail/2pass, restored9pass; root strict native types pass. Final test includes valid-but-oversized JSON whitespace, not just invalid JSON. These are ordinary pure local tests, not native/real-provider qualification. Endpoint DNS/dial/redirect guards are NOT implemented by this parser. Atomic token ledger, qualified reservation bounds, actual bounded transport, opt-in/current-policy/caller composition, all cloud-egress seams, unpriced audit and full review/acceptance remain required. No runtime caller changed or feature enabled.

No production/schema/settings/flags/provider/grants/spending or deployment changes. Do not reuse or reset historical ServiceNow/native/issuer evidence. Source acceptance and a genuine isolated-network model run remain distinct.
