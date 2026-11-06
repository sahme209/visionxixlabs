# Public Integrations filters — actual browser evidence

Used a new hidden IAB tab on the existing guarded0c9 public preview, then closed only that test tab. Current page, IntegrationCatalogBrowser, publicIntegrationCatalog and global stylesheet bytes match0c9; source-parity.json records four exact comparisons. Original user tabs, app, accounts and drafts untouched. No setup/provider/account link clicked; filtering is the source-owned local catalogue operation, not account discovery or permission state.

Observed in actual browser:
- Planned+GitLab search returns one GitLab card, Planned, no customer-ready activation, no setup available, zero card links. This is not a GitLab connector/login acceptance.
- Enter activation of Clear filters resets search and all three select values, restores15cards, removes Clear and places focus on Search. Initial focus for this activation was set with a supported locator.
- Source & CI +Available workflows +Receive events yields0cards, explicit no-match guidance and a Clear button. Native Tab from Operation model reaches Clear. Space activates recovery, restores15cards/all filters/search focus, and removes the empty heading.

Select choices used the supported selectOption API; this is not a full keyboard-only dropdown journey. An initial exact getByLabel selector found no match before any action; the fresh DOM snapshot exposed the correct combobox roles/names, which succeeded. No application defect is inferred from that tool selector mismatch. Saved JSON records actual states. The screenshot captures the empty recovery state and visible focus; no measured contrast claim.

Minor open copy finding: one result currently says `1 connectors shown`; use singular `connector` in a later batched UI copy change. It does not block filtering/recovery and was not silently changed during verification.

Remaining: screen-reader live announcements, measured contrast, other devices/viewports/themes, touch, zoom/reflow, performance, full navigation and native/provider/production acceptance. No B6/A6/Governance completion or public-catalogue completeness claim. This verifies the named public filter flow only.
