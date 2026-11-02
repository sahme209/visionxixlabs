# ChatGPT visible website audit — initial public documentation pass

Observed November2, 2026 in the user-visible in-app browser. Partial public presentation/interaction research, not a claim about vendor behavior or a completed whole-site audit. No authentication, prompt submission, generated guide, API call or paid model request was performed. Docs Agent WebMCP tools were offered but no generation/action was invoked.

| Inspected page/control | Observed result | Original Axiom decision |
|---|---|---|
| https://learn.chatgpt.com/docs | Separate top-level learning destinations, second-level feature/security/admin categories, task-oriented sidebar, goal-led introduction, product image and primary quickstart/secondary exploration CTA. | Separate marketing, task guides and reference while preserving one recognizable shell; a first-use CTA should lead to the next real task. |
| Primary Quickstart CTA | Actual navigation loaded https://learn.chatgpt.com/docs/quickstart. | Verify destinations, not only link existence. |
| Desktop setup | Numbered installation, sign-in, workspace and first-message guidance; links explain platform/feature limits and deeper tasks. No installer downloaded. | Axiom quickstart must distinguish supported platforms, current capability and actual acceptance limits. |
| Web setup radio | Selected state and URL changed to ?setup=web; visible instructions changed to the web path instead of keeping irrelevant desktop steps. | Use a stable shareable platform choice and show the appropriate prerequisites rather than one oversized guide. |
| Clearly labeled Chat/Work illustration | Selected Work changed the illustration's state. The page explicitly says this does not change real account settings. | Interactive Axiom documentation must visibly label illustration/simulation and never masquerade as provider execution or authority. |
| Daily briefing example | Selecting the example changed the displayed prompt and exposed an Open in ChatGPT control. It was not submitted. | Examples can illustrate a goal, but opening/executing a real task requires its separate permissions and review; no automatic action from reading docs. |

The overview accessibility tree exposed a Docs Agent close control that the supported click could not activate; a screenshot showed that the panel was not visually open at that viewport. No successful close or Docs Agent conversation is claimed. The subsequent primary Quickstart link navigation was verified by URL and loaded content. Do not count hidden/unavailable controls as exercised.

Screenshot: /Users/samirahmed/Documents/Codex/2026-10-22/referenced-chatgpt-conversation-this-is-an/outputs/chatgpt-quickstart-audit-2026-11-02.jpg. It is a reference-site screenshot, not an Axiom demo or implementation.

## Still to inspect

Public marketing/product homepage, unique menu destinations, download-platform disclosure, navigation/search, security/admin task pages, use cases, training/resources, pricing/availability, support states, footer/mobile and keyboard/contrast behavior. Codex-specific destinations need their own recorded coverage. Claude and Grok remain pending. Do not copy competitor branding, wording, media or unsupported claims.
