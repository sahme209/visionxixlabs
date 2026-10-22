# Cockpit reference behavior audit

Inspected the signed-in Cursor account flow on 22 October 2026. The live Settings destination is the Grok dashboard, matching the supplied reference images. This is an interaction audit, not proof that Axiom has the same services.

## Measured visual reference

At the inspected desktop viewport: sidebar 264px, main content inset 32px, heading top 32px, h1 24px / 32px line height. Integration Connect buttons are 32px tall, 13px text, 14px horizontal padding, pill radius, #f3f3f3 background. Sidebar and integration cards use #111111 against a black canvas.

The candidate now uses these frame and integration action dimensions. Its Axiom artwork, labels, role information and governed cloud controls remain. Exact cross-page pixel parity has not been established.

## Observed interactions and Axiom mapping

| Reference action | Observed behavior | Axiom authority / gap |
| --- | --- | --- |
| Sign in with Google | Existing identity enters agent surface; Settings opens account cockpit | Axiom enters unified /control; original authentication remains |
| Upgrade | Opens plan chooser; annual selector changes plan prices and purchase intent | Existing Axiom plans and checkout API; do not copy competitor SKUs or prices |
| Buy credits | Without saved card, opens secure Stripe card setup | Existing add-on checkout endpoint and signed fulfillment; live acceptance pending |
| Auto top-up | Separate threshold and amount dialog with Save/Cancel | No verified equivalent; do not show a fake working save |
| Monthly limit | Dollar limit dialog with Save/Cancel | Preserve Axiom budget policy; no unsupported credit limit mutation |
| Invoices | Empty state and All/Paid/To be charged/Failed filter | Axiom secure billing portal; no native invoice list parity claimed |
| GitHub actions | Manage on GitHub, Reconnect, Disconnect | Existing installation and transition API; do not disconnect real reference account |
| Azure DevOps Connect | Opens legitimate Microsoft organization authorization in another tab | Distinct from Axiom Azure cloud enrollment; separate valid app/scopes required |
| Plugins | Search, connection filter, grouped rows and detail dialog | Actual Axiom registry and skill catalog; installation capability varies |
| Plugin details | Publisher, verification label, constituent skills and MCP definition | Do not invent publisher verification or capability counts |
| MCP Add | HTTP/Command transports, secret headers/env, optional OAuth client | Browser-managed arbitrary MCP not implemented in Axiom; desktop setup only |
| Edit mcp.json | JSON editor with Save/Cancel | No browser config mutation parity claimed |
| Start team | Team name, free/premium seats; checkout and conversion disclosure | Preserve Axiom workspace membership roles and billing contracts |
| Usage | Date range, product/model/type filters, grouping and CSV export | Existing authoritative Axiom usage readers; richer reporting parity pending |
| Profile settings | Profile, appearance, pull requests, voice, privacy and sessions sections | Implement only Axiom-supported account/security controls |
| Sessions | Device table, pagination, Revoke actions | Existing Axiom paired desktop session controls and confirmation |

No reference payment, team creation, provider consent, plugin installation, profile change, privacy change, MCP save, credential change or session revocation was submitted.

## Release condition

Production promotion remains conditional on functional and visual verification. Local component previews use mocked test data and are not authenticated end-to-end evidence. Shared hosting preview configuration is not an isolated test environment. Do not label this audit complete feature parity or production acceptance.


## Account overview implementation

The overview now reads the same tenant billing plan and current allowance authority as Usage & billing, within the existing isolated read scope. It presents the recorded plan and status, remaining allowance and unresolved holds, and workspace commercial-access status using the desktop access policy. A read failure renders unavailable; it never implies a Free subscription or zero balance. Access status is not a claim that a desktop device is paired.

Product cards connect to Integrations, Plugins, and paired desktop sessions. The session deep link selects the Sessions tab and preserves its allowlisted destination through sign-in. Governed approvals, operational counts, members, governance and downloads remain reachable. Existing billing/permission policy is unchanged.

New coverage checks the authenticated-workspace reader calls, failed reads, canceled paid contract, membership boundaries, session deep linking and invalid section fallback. Component previews still use fixture data. Production acceptance of purchases, desktop synchronization and real provider execution remains pending.
