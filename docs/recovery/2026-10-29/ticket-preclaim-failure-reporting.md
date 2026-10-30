# Ticket dispatch refusal reporting correction (local only)

The live Jira link is confirmed (one attempt). A subsequent approved Jira closure and the approved ServiceNow note were refused without a committed durable attempt. Neither may be automatically resent. The exact refusal causes remain unconfirmed.

The HTTP handler previously set dispatchAttempt merely from the incoming action, before service composition/preflight/claim. Any refusal therefore returned HTTP 502, which the native client correctly treated as uncertain. This misreported a known pre-claim refusal.

The local correction uses a trusted in-process callback immediately before the durable claim. Errors before that point return existing bounded HTTP 409/no-retry. Once a claim may have begun, failures remain conservatively uncertain HTTP 502/no-retry, including ambiguous transaction commit responses. No client field, authority, deadline, provider operation or retry behavior is added.

Two regression assertions failed before implementation (incorrect pre-claim 502; missing claim-start signal). All 16 focused HTTP/service checks pass afterward. Independent review reports no important or critical issues. Scoped type checking of both runtime files and tests passes. The broad root check was cancelled after over five minutes without output, so it is not a passing check. No production activation is authorized or performed. Logs: work/ticket-install-completion/preclaim-report-{red,green,types}.log.

Current successful Jira link: jira_action_b38c35b94902c26665e684448998eb68faa79d168e83546b009098a80d3f89bf, confirmed/version4/attempt1/providerWritePerformed true. Jira closure f643d648 independently approved/version1/attempt0; requester authorized one closure; one UI dispatch refused before committed claim, do not retry unchanged. ServiceNow note b38 approved/version4/attempt0; its deadline has elapsed. Both isolated desktop identities remain signed in; no account switching is needed.
