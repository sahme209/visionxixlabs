# Cockpit integration discovery — source supplement

**INTERNAL DRAFT. Customer eligible: false. Editorial/media/browser/native/shipped acceptance: false.** Source inspection: November 5, 2026. This supplement documents two existing discovery links, not working-account health, a new connector, consent or execution authority. B4 remains open. No runtime help IDs or retrieval eligibility are created.

## Find the existing settings

Open **Cockpit → Integrations** (`/control/integrations`) in a signed-in browser workspace. Authentication, organization and email are required; an authenticated account without an organization is sent to workspace selection. Missing current membership roles yields an access alert instead of the page.

| Entry | Purpose and exact destination | Steps and expected result | Limits / safe recovery |
| --- | --- | --- | --- |
| Outlook | Mailbox/calendar context for the consenting user; **Open Outlook settings** → `/account/integrations/outlook`. | If the management link is present, open it and verify the browser account/workspace before using the separate setup controls. | The cockpit card has no health badge/status reader. Outlook settings displays configuration and return notices, not a fresh saved-connection status read. A query notice is not proof of current access. Check current status in Axiom; do not reuse an uncertain callback. |
| ServiceNow | Change-ticket setup/read access; **Open ServiceNow settings** → `/account/integrations/servicenow`. | If the management link is present, open it and verify the matching browser workspace. When connection activation is enabled, settings attempts a bounded current saved-status read. | Failed configuration/status reads do not prove disconnection. Native ticket lifecycle, exact action review and genuine independent approval remain separate; opening settings creates no ticket, evidence note or closure. |

The two cards remain visible without management rights, but their links are rendered only when `isAdminOrOwner` passes: current tenant owner/admin **or** the existing configured platform-admin gate. This is a discoverability rule, not a statement that every setup/consent operation is authorized. Destination and API guards remain authoritative. Both links set `prefetch={false}`; merely rendering them does not prefetch the guarded destination or begin OAuth. Clicking a settings link is navigation; the explicit destination controls can initiate separate requests and consent.

These links carry no desktop identity hints. They use the **current browser** identity/workspace; a paired desktop session is not proof that the browser is the same user or tenant. Setup pages support matching expected-account hints when supplied by existing app flows and refuse a mismatch. Do not invent a desktop account binding from this cockpit navigation.

## Continue with existing guides

- [Outlook connection, reads and exact actions](outlook-controls.md): detailed supported desktop/setup controls, permissions, uncertain outcomes and action boundaries.
- [ServiceNow evidence and closure](servicenow-evidence-and-closure-controls.md): source-described ticket lifecycle, journal proof, consumed/unknown history and closure safeguards.
- [Browser/desktop pairing](browser-desktop-pairing-controls.md): the separate account/workspace handoff and recovery controls.
- [Settings workspace](settings-workspace-controls.md): existing native settings organization. These linked drafts retain their own version/acceptance limits; this supplement does not refresh them.

## Exact inspected source bindings

Paths are repository-relative; ranges are inclusive. Hashes bind the complete inspected file, not merely the named lines.

| Source | Bound lines / purpose | SHA-256 |
| --- | --- | --- |
| `app/control/integrations/page.tsx` | 65–74 (optional badge), 78–84 (browser context and role gate), 149–151 (entries) | `1ea0560a0a8615730490b594ca0f12f6402445e4d04e5a49785bd6bb35e0239c` |
| `app/account/integrations/outlook/page.tsx` | 5–7 (dynamic authenticated setup, account hints, notices; no current-status reader) | `23082367f6ce150ed3ba600ba64769cc5f3e246d78343f2979f97f7679dd17be` |
| `app/account/integrations/outlook/OutlookConnect.tsx` | 1–3 (explicit POST controls and redirect checks) | `6e55750982818218c19598db8b12c31220695f37f54ae512110e27075d45434e` |
| `app/account/integrations/servicenow/page.tsx` | 10–25 (actor/hints, status, configuration and action controls) | `d7929ee02d1c97dade8962ce69905139c6260ca9ebf74a0dbc323af40b8cdc76` |
| `lib/auth/platformAdmin.ts` | 16–22, 40–50 (platform/tenant management gate) | `fbcd20110e9bf602dc018a159c2ba496bbc41a275c17a39d741b497d09d16f16` |

Verification was finite static inspection of these five files and the linked guide headings, plus SHA-256 calculation and a literal check of the two destinations, labels and no-prefetch attributes. No provider, authenticated page, browser, database, build or test was invoked. No screenshots/demos, live status, editorial approval or customer publication are implied. Rebind this supplement after source changes before treating it as current documentation.
