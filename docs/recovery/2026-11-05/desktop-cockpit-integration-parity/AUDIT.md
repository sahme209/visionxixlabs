# Desktop/cockpit integration parity — source audit

Audited source at HEAD350f2594; core native work may be uncommitted in parallel. No UI/runtime/provider/network/database query, test or connection action performed. This compares authenticated `/control` pages with desktop source, **not the marketing integration catalog**. Presence/absence in these inventories is not a live connection or backend-completion verdict.

## Confirmed inventory differences

| Surface | Actual inventory / controls |
| --- | --- |
| Desktop Apps & skills | Fixed GitHub, Slack, Teams, Linear, AWS, Azure, GCP, Airflow list, plus separate searchable Outlook entry. Shared skills/Microsoft Learn MCP are a separate filter. Browser consent for GitHub/Slack/Teams/Linear; current connection validation; existing Slack manager/reviews and Teams/Linear action panels; cloud setup through Settings; Airflow workspace. |
| Desktop Settings | GitHub/Slack/Teams/Linear rows, real Outlook card, guided AWS/Azure/GCP controls and advanced AWS/Azure enrollment. Jira/ServiceNow are not in this central list; their existing ticket workflow is in Releases/ReleaseTicketWorkspace. ServiceNow setup opens the existing browser route with current admin/capability and user/workspace checks. |
| Cockpit Integrations | The same eight base providers **plus JiraSetupCard**, and a separate Microsoft Learn public-MCP link. **No Outlook or ServiceNow discovery row/link here.** GitHub/collaboration menus offer reconnect/pause/resume/disconnect; the generic component has no desktop-style Finish connection/Verify access operation. Jira has its own consent/site/read-validation flow. Airflow opens its workspace; cloud rows direct setup to the desktop. |
| Cockpit Apps & skills | Registered **AWS/Azure/GitHub execution-plugin actions** plus the shared curated skill catalog, not the desktop connection-provider list. Plugin rows are bundled capabilities with Manage access links; installed skill state comes from the same workspace installation model. This is an information-architecture mismatch, not proof those three are the only connectors. |

**Existing omitted entry points:** `/account/integrations/outlook` and `/account/integrations/servicenow` both have authenticated setup/read-access source. Desktop already embeds Outlook and has Jira/ServiceNow ticket components. Do not build duplicate connectors merely because cockpit Integrations omits them. GitLab is not in either audited central provider list; this audit does not establish broader backend absence.

## Confirmed status-source differences

1. **Cloud:** cockpit reads raw `connectorSetupSession` rows. Desktop status API instead uses canonical AWS enrollment, Azure enrollment plus current guided-access reads, and GCP guided summary, explicitly avoiding legacy-success fallback. The two surfaces can therefore display different source states. Whether any current account actually differs is **unverified**.
2. **GitHub and Slack/Teams/Linear:** both use GitHub24-hour read-validation freshness and the same `visibleTenantConnectionStatus`24-hour collaboration policy. Desktop additionally preserves bounded consent-recovery holds; those must not be erased by a shared presentation refactor. No current token/provider health was checked.
3. **Airflow:** cockpit displays stored status directly. Desktop uses its dedicated connection GET, normalizing `revokedAt` to revoked and `connected` to active-and-not-revoked. Neither audited path applies the collaboration24-hour freshness function to Airflow. No claim of a live stale-state incident.
4. **Outlook:** its separate card uses consenting-mailbox-owner states and a bounded metadata/calendar read, with separate exact action reviews. It is not a collaboration-row status, and must not expose mailbox/account detail through the desktop aggregate or a generic browser catalog.

## Smallest coherent local repair design

- Share a **non-authoritative provider descriptor inventory** (purpose/category, supported surface and trusted setup/workflow destination), while retaining surface-specific authenticated status/control adapters. Distinguish connection providers, built-in execution actions, skills and MCP; do not label catalog availability Connected.
- First restore cockpit discoverability for existing Outlook/ServiceNow setup and make Jira/ServiceNow ticket workflows discoverable from desktop Apps. Reuse existing guarded routes/components rather than create OAuth/storage flows. If no safe browser status adapter exists, say status must be checked in the app; a setup link is not proof of connection.
- Then reconcile cloud presentation with canonical current-authority summaries **under the real browser actor**, preserving desktop/browser authentication distinctions. Never mint a desktop session or reuse a desktop-only reader with invented identity to achieve visual parity.
- Preserve admin/membership checks, trusted consent-host restrictions, consenting-user privacy, current validation, unknown-result/recovery holds and independent action approvals. No provider send/activation/new scope is part of parity. Required follow-up is scoped source/UI tests and authenticated local walkthroughs; none ran in this audit.

## Exact source bindings

Ranges are navigation references; SHA256 binds the complete file read in this audit.

| Source:lines | SHA256 |
| --- | --- |
| `desktop/src/views/PluginsSkillsView.tsx:22–33,159–179,205–228` | `bbf5ac0521d7564e38973bcf022c4f001d3911607e17ad5369ef4431ec84bab8` |
| `app/control/integrations/page.tsx:17–25,86–120,136–171` | `4857166e17f467dc43808649d5a8e0ce2237652a6ffb3d873e73cd487158f17d` |
| `app/control/plugins/page.tsx:4–21` | `f2b7353226e46e25c6507731a4b869e6153a828a4c7fbc896f2eb308b392a9d7` |
| `app/api/desktop/integrations/route.ts:64–117,121–148,196–209` | `81748ab28480ec30124e98f9151c7bb2b6e80e7228db21efb9f0e52909cb14ba` |
| `lib/integrations/tenantConnectionState.ts:8–37` | `e6e4425c468e531c286d503d64f58e823ddedd8cf1735191b26c60d32d5b75ee` |
| `app/api/desktop/airflow/connection/route.ts:26–31` | `6f6960b0a88c3a6d4bbfa56b7b6a61f8b4eac28b273bfeb834148a1c51c13cbd` |
| `app/account/integrations/outlook/page.tsx:1–7` | `23082367f6ce150ed3ba600ba64769cc5f3e246d78343f2979f97f7679dd17be` |
| `app/account/integrations/servicenow/page.tsx:9–25` | `d7929ee02d1c97dade8962ce69905139c6260ca9ebf74a0dbc323af40b8cdc76` |
