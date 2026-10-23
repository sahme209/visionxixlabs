# Desktop integration cleanup

The desktop settings page mixed working connection controls with non-actionable roadmap cards for grouped GitLab/Azure DevOps, Jira/ServiceNow and observability providers. The user asked to remove unnecessary desktop clutter while keeping the accepted web cockpit unchanged.

The chosen presentation removes those roadmap-only cards, preserves all existing connection actions and cloud summary, adds the existing Axiom web provider artwork to GitHub/Slack/Teams/Linear, and uses compact wrapping rows. AWS/Azure enrollment forms remain available under a labeled cloud-connections disclosure; diagnostics remain available separately. No backend, OAuth scope, credential handling, account/session/billing behavior or provider capability changes are introduced by this presentation change.

Verified status styling now uses explicit positive labels: disconnected, unverified, consent-only and overdue states cannot be colored as verified by a substring match. Native and responsive visual acceptance are recorded separately; visual polish is not evidence of real provider acceptance.
