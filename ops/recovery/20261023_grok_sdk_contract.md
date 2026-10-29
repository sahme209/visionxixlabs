# Grok Gateway SDK contract

Public catalog and primary documentation were refreshed on October 23, 2026. The current exact identifier is `spacexai/grok-4.20-multi-agent`; no stored model policy or approval was renamed or expanded. The Gateway model documentation describes maxOutputTokens including reasoning. Direct xAI API limitations must not be applied blindly to Gateway-normalized requests, nor inferred away without checking the installed adapter.

Four tests exercise the installed AI SDK 6.0.291 and Gateway provider through a fixed .invalid transport: streaming and non-streaming serialize a 1024-token output limit and the exact model header; reported total output includes reasoning rather than text alone; generation metadata remains attached; failed transports dispatch once with no retry. No network/provider request, customer key, paid generation, tool grant or model selection change occurs in these tests. This verifies wire behavior, not provider enforcement, actual inference or billing acceptance.

Sources: https://vercel.com/ai-gateway/models/grok-4.20-multi-agent and https://docs.x.ai/developers/model-capabilities/text/multi-agent . A live acceptance still requires specific new spending/model authorization; the earlier one-task environment-listing authorization was already consumed.
