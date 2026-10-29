# Unified Axiom browser cockpit

The browser cockpit is `/control`. It retains Axiom branding, server authorization, billing fulfillment, provider consent, desktop pairing, and audit boundaries.

## Navigation and migration

- Paid pricing selections return through sign-in to `/control/plans`, preserving validated plan and billing interval. Review and an explicit purchase remain required; navigation never starts checkout or grants access.
- The owned isolated TEST checkout deliberately retains `/plans` because its runtime allowlist and reconciliation lane are narrower. Do not broaden that allowlist for presentation parity.
- Free pricing opens sign-in and returns to Control without starting a payment.
- `/account` redirects to `/control/settings`; the legacy billing portal return redirects to `/control/usage-billing`.
- `/auth/success` redirects to Control. Provider return notices move to `/control/connection-return`, preserving the existing bounded notice mappings.
- `/account/integrations` retains its existing Control redirect. Signed-in help retains its URLs and content, using the shared cockpit frame.
- `/dashboard` migrates to Control; `/dashboard/team` retains form-return query context and redirects to `/control/members`. Existing invitation and role endpoints remain unchanged.
- Unmigrated operational and internal routes retain their existing restrictions. No blanket dashboard redirect discards those workflows.

## Authority and availability

The shared layout authenticates identity but does not gate personal settings on cached workspace membership. Organization pages verify current membership, and mutation APIs retain their existing role checks. App Router layouts persist during navigation; do not make access to their children depend on the initial pathname.

Plugins come from the registered execution catalog. Skills come from the fixed Agent skill catalog and organization-scoped installation storage. Search, category filters and capability details work without granting access. Missing storage means unknown installation state. Installation remains in the paired desktop; browser-managed arbitrary MCP installation is unavailable.

Cloud authorization is not fabricated. Azure/AWS setup remains in the supported desktop flow until browser OAuth, configured scopes, state binding and backend validation exist. Collaboration OAuth keeps its existing secure provider start/callback routes. A provider consent or lifecycle record is not proof of active access.

Invoices and payment management remain in the existing owner/admin Stripe portal. The cockpit does not synthesize invoices or change payment fulfillment, quota, allowance, prices or webhook behavior. Existing known Free reservation and Agent identity storage blockers are outside this presentation migration.

Signing out ends the browser session and returns to the public site. Paired desktop sessions remain independent; their real revoke controls are available in Settings. Public marketing command and chat overlays are excluded from account/auth/cockpit surfaces.

## Acceptance status

Local focused tests, source review and production compilation are distinct from an authenticated deployed redesign. The authorized live Google baseline confirmed sign-in, session persistence, billing/profile/device reads and browser sign-out. No credentials were copied into localhost, no payment was initiated, no device revoked, no access granted and no production deployment changed.

Successful local/staging authentication and checkout, full responsive cockpit acceptance, viewer/admin browser journeys, and actual provider authorization remain release gates. Retain issue #200 as the current verified/blocked evidence record.

Member-read failures render unavailable state instead of a fabricated empty workspace; management controls fail closed. The page independently checks accepted membership before showing management controls. A cockpit-scoped error boundary and loading state preserve navigation when a section cannot load.

## Full cockpit refinement — October 22, 2026

The refinement applies a shared, private-surface stylesheet for compact spacing, readable secondary text, keyboard focus and reduced-motion behavior. Integration rows become responsive provider cards with expandable scope details. Page titles match sidebar destinations. The desktop sidebar remains consistent across all sections, while the narrow layout retains horizontal navigation.

Settings uses keyboard-operable Profile, Security and Sessions tabs. Its panels stay mounted so switching tabs preserves an unsent profile draft. Profile saves prevent duplicate submissions and conflicting edits while pending; network failures remain unconfirmed outcomes. Device revocation requires explicit confirmation and retains the existing authenticated DELETE endpoint. Modal focus stays contained while pending and returns to a surviving sessions heading after successful revocation removes its trigger.

Billing uses Overview, Usage and Invoices sections without changing its data readers, allowance arithmetic or checkout/portal authority. Operational metrics are separate from the compact plan/credit summary. Policy explanations remain available in expandable details. Invoices use the existing secure provider portal, not invented invoice records. AI credit top-up availability is described separately from subscription billing.

The visual-gallery test renders actual cockpit page components using mocked example.test records. Its optional export produces standalone, clearly labeled component previews, never a product route or authentication shortcut. All 16 page/dialog states were inspected in the ordinary browser at the available 1041-pixel viewport with no document or main-content horizontal overflow. A forced viewport-emulation request was declined; fixed-size desktop/mobile acceptance is not claimed from that request. Narrow-screen screenshots were inspected at the available browser size. All previews remain distinct from real authenticated deployed acceptance.
