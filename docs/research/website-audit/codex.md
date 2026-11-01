# Codex / OpenAI documentation audit — first pass

Observed visibly on November 1, 2026. Partial navigation/interaction research; no account actions, application permission changes or generated support guide.

## Observed

The public Codex landing page presents purpose, authentic product imagery, example tasks and product surfaces (desktop, web, IDE, CLI), then plan/access destinations. Lazy-loading download and try controls resolved after the page loaded. The developer-documentation destination redirected to ChatGPT Learn, so the audit records that actual destination rather than asserting the old documentation URL is unchanged.

ChatGPT Learn has grouped sections for getting started, foundations, platforms and releases, plus search, an overview image, recent updates, and an optional docs-agent surface. The Permissions article has a compact in-page contents list, copy-page/copy-section affordances, conceptual explanation, concrete modes and troubleshooting links.

Its embedded permission-mode example explicitly states that choosing a mode does not change application permissions. Changed that example from “Approve for me” to “Ask for approval” and verified the selected radio and explanatory text changed. No real ChatGPT/Codex permission setting was touched.

## Axiom implications

- State the supported product surface and prerequisites next to the action.
- Demonstrate policy choices through explicitly non-operative examples before asking customers to configure real authority.
- Explain access scope separately from who approves an action; avoid treating approval as an expansion of permissions.
- Keep readable conceptual guidance alongside exact control instructions and troubleshooting.
- Future support answers must cite reviewed, current Axiom articles, not infer authority from a documentation demonstration.

## Sources

- https://chatgpt.com/codex/
- https://developers.openai.com/codex (observed redirect)
- https://learn.chatgpt.com/docs
- https://learn.chatgpt.com/docs/permission-modes

Remaining: dedicated CLI/IDE/cloud details, search journeys, deeper linked controls, responsive/accessibility checks and cross-page consistency. No all-buttons-complete claim.
