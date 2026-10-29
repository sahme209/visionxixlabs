# Shared collaboration connection availability

Cockpit collaboration actions and the desktop status endpoint now share one server-side registration-readiness function. Slack and Linear require their client ID and secret; Microsoft Teams additionally requires its tenant ID. All require a trusted callback origin. The boolean is only configuration availability, not proof of provider registration, consent, token validity or connection health. Existing provider-start and callback checks remain authoritative.

Unconfigured disconnected cockpit actions are disabled with a visible service-unavailable explanation, matching the verified desktop change. Existing connected records retain management controls; reconnect remains blocked if registration is unavailable. The consent destination guard now also rejects embedded user credentials and nonstandard ports, matching desktop expectations. No scopes, permissions, secrets, account records or provider consent are changed.

Regressions first failed for missing availability handling and two misleading provider authorities. Fourteen focused suites then passed 63 tests. Full exact-source release evidence is recorded separately.

A read-only production environment-name audit confirmed the seven expected Slack, Microsoft Teams and Linear registration-setting names absent. No secret values were retrieved, no settings were changed, and no provider registrations were inferred. Cockpit Slack Connect was observed returning unavailable before this change. Real one-click OAuth acceptance remains blocked until the service operator supplies valid registrations through secure configuration. Callback URLs are not standalone login links.
