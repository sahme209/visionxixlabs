# Apps & skills: catalogue loading and empty results

Internal living source supplement · November5,2026 · source `cb4ec4f815d0d855f6cc9c8b5ed2b08c20a1db6b`. This is scoped B4 documentation, not a published knowledge article, shipped-version guide or customer-eligibility decision. It adds no help IDs, ingestion binding or runtime authority. The [historical r1 guide](desktop-apps-skills-controls.md) and article remain unchanged.

## Purpose and location

In desktop **Apps & skills**, choose one catalogue view and optionally enter **Search apps and skills**. Browse and Saved views are alternatives; Enabled/Disabled show saved skills. Search/view selection changes local presentation only. A loading result, failed read and successful empty result have different meanings.

| Observed source state | What is displayed | Safe next step / limit |
|---|---|---|
| Skills are still pending, and no matching provider, skill or Outlook section is shown in a skills-relevant view | **Loading skills…**, exposed as a status | Wait for the existing request. No empty result or successful response has been established. This is the initial unknown catalogue state, not a new status promised on every refresh. |
| Skills request fails | Existing **Skills could not be loaded right now. Your existing Agent permissions and integrations are unchanged.** warning and **Retry**; no additional false no-match panel in skills-relevant views | Retry requests current capability data; it is not a skill install, consent, action replay or permission repair. Other independently available sections can remain visible. |
| Successful catalogue response settles with no matching content and no catalogue issue | **No matching capabilities** / **Try a different search or filter.** | Change the local search/view if useful. Empty does not mean all integrations are disconnected or that access should be widened. |
| Apps-only view | Never shows **Loading skills…**; it keeps its provider/Outlook results and existing no-match rendering | This change does not add a new app-status loader or establish provider availability. |

The new loading line is deliberately conditional on an otherwise empty presentation; it does not obscure matching app content while skills are pending. Catalogue issues also include the existing storage-preparation warning; the final branch suppresses generic empty text for that issue in skills-relevant views too. Do not describe storage unavailability as a failed provider or empty catalogue.

## Existing controls and guards

`PluginsSkillsView.tsx:66–79` keeps request sequencing, current ownership and mutation checks before accepting skill results. The existing **Retry** at line201 calls the same `load()` path; **Refresh capabilities** at189 is unchanged. The correction changes only the final rendering at234–236. Search at191 remains controlled, selection at194–199 remains one exclusive view, and current query/focus are not reset. Manual refresh/Retry use the existing read paths; no automatic consent or action retry was added. Skill mutation still checks owned context, management permission, storage availability and mutation exclusion at102–109.

## Evidence and exclusions

[Local verification receipt](../../recovery/2026-11-05/catalogue-loading-local/README.md) and [saved output](../../recovery/2026-11-05/catalogue-loading-local/tests.log): root's one isolated pinned-Node24 invocation selected3 mocked lifecycle cases, all passed with32 skipped. Cases cover deferred initial response→matching result with query/focus retained and no mutation/consent calls; failure→warning without false empty; successful empty only after settlement. Earlier dependency startup failures remain preserved and are not behavior RED. No full suite or new tests ran while writing this supplement.

Exact current source SHA256: `desktop/src/views/PluginsSkillsView.tsx` = `9fbe878d62eea6d678fa3ffbe3cc0d9bbe2477c239b33a7735d5c49cbe920461`; `lib/desktop/__tests__/pluginsSkillsLifecycle.test.ts` = `a1db3428726edd678e724670dad28a0887030635a9a5a14103990e1a66fa9212`. Historical guide bytes were compared with the committed file:9460bytes, SHA256 `616f9498b4bfbbb4f68a64489cd4640324a6afb680c99c08d312cb93184f121f`, unchanged. Its r1 source/review/customer-eligibility history is not rebound to this supplement.

Browser/native/screen-reader/rendered acceptance, current installer inclusion, live provider health, source-knowledge publication, editorial review and customer eligibility remain unestablished by this unit. The previously shown475desktop is older; these source/test observations do not claim it contains the correction.
