# Connection entry-point clarification

Desktop Settings and the plugin catalog no longer send end users to operator OAuth-registration guides when the service reports an unavailable provider. They show a disabled Connect control with a visible service-unavailable explanation. Providers reported configured retain the existing secure browser authorization path, URL validation, state ownership and validation lifecycle. No unconfigured provider is presented as working.

The operator documentation now states that callback URLs are registration values, not connection entry points. Opening a callback without an active authorization state correctly fails; this protection is preserved. OAuth application registration, secrets, callback trust and consent still need valid operator configuration. This change neither creates credentials nor establishes Slack/Teams/Linear connectivity.

The missing-state regression first failed, then the integration/plugin suites passed 29 tests. All desktop suites passed 998 tests with zero failures and ten opt-in skips. Exact-source and native follow-up results are recorded separately. Accepted cockpit layout and role boundaries remain unchanged.
