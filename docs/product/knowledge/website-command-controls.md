# Website command palette controls

Internal source draft for local runtime266b3987, pinned by the sidecar file hashes. Not customer/editorial/publication/media approved. These documentation keys describe source controls; command IDs are not unique DOM control IDs or permission grants. No command was executed while authoring.

## Open and search

The root layout mounts the palette globally. On a Mac, ordinary Cmd+K toggles it; other platforms use Ctrl+K, based on the browser platform string. Its listener returns early for native composing events and legacy keyCode229, leaving those events to the input method. The palette is not rendered for paths beginning `/control`, `/account` or `/auth`. That visibility condition is not an authorization boundary, sign-in, provider access check or permission to open protected destinations. [root-mount, palette-lifecycle, palette-select]

Opening schedules search focus after30milliseconds. Type in **Search the site… type, then ↵** to filter the local command definitions; no AI or search endpoint is used by this component. Search matches label, hint, category and keywords, ignoring case; exact substrings score ahead of looser ordered-character matches. Empty search groups the current list into Product, Resources, Company and External. The result count is filtered definitions over catalog definitions, not available integrations, deployment capacity or health. No match shows suggestions such as demo, pricing, handbook or status. [palette-search, palette-surface]

## Controls and outcomes

| Documentation key | Input | Result and recovery |
| --- | --- | --- |
| website.commands.toggle | Cmd+K / Ctrl+K | Toggle the local overlay; closing resets query and active index. The query is not a durable draft. |
| website.commands.search | Search field | Updates local filtering and resets the highlighted row. It does not submit text to AI. |
| website.commands.move | Ordinary Up / Down | Moves the active row within current results; pointer hover also changes the active row. No wrapping promise or screen-reader announcement acceptance is implied. |
| website.commands.open | Ordinary Enter or a row click | Closes the overlay, then calls router.push for internal destinations or window.open with noopener/noreferrer for external ones. Navigation is not a provider/API action. |
| website.commands.close | Ordinary Escape or Close command palette backdrop button | Closes the overlay. No prior-trigger focus restoration, complete focus trap or actual assistive-technology acceptance is established by this source inventory. |
| website.commands.composition | Composing Enter, Escape, arrows or shortcut | Existing handlers return without consuming the event, selecting a route or toggling the palette. Real OSIME/browser behavior still needs qualification. |

A destination can still be unavailable, require authentication or fail navigation. Preserve any unrelated application task/action history; opening this palette does not retry, execute or reconcile it. The local guarded preview intentionally blocks private/API/form/auth and unsupported RSC/query requests, so source-listed destinations are not all usable there. [palette-lifecycle, palette-select, palette-row, preview-evidence]

## Current catalog — source declarations only

Hints and labels are navigation metadata, not proof of shipped integration support, verified security, real-time uptime, pricing, release acceptance or remote content. Two download commands intentionally share a destination. The table inventories26current definitions, not26unique pages or all website controls. External URLs below were transcribed, never opened or fetched.

| Source command ID | Display label | Category | Declared destination | Navigation type |
| --- | --- | --- | --- | --- |
| home | Home | Product | `/` | Internal router |
| axiom | Axiom capabilities | Product | `/product` | Internal router |
| releaseops | Axiom workflow | Product | `/product#workflow-overview` | Internal router |
| demo | Try the sandbox | Product | `/demo` | Internal router |
| operator | Download Axiom Agent | Product | `/download` | Internal router |
| plans | Access and pricing | Product | `/plans` | Internal router |
| integrations | Integrations | Product | `/integrations` | Internal router |
| download | Product download | Product | `/download` | Internal router |
| docs | Documentation | Resources | `/docs` | Internal router |
| blog | Blog | Resources | `/blog` | Internal router |
| changelog | Changelog | Resources | `/changelog` | Internal router |
| insights | Insights | Resources | `/insights` | Internal router |
| casestudies | Case studies | Resources | `/case-studies` | Internal router |
| design | Design system | Resources | `/design` | Internal router |
| manifesto | Manifesto | Company | `/manifesto` | Internal router |
| principles | Design principles | Company | `/principles` | Internal router |
| handbook | Engineering handbook | Company | `/handbook` | Internal router |
| team | Team | Company | `/team` | Internal router |
| trust | Trust | Company | `/trust` | Internal router |
| security | Security | Company | `/security` | Internal router |
| press | Press & Media | Company | `/press` | Internal router |
| contact | Contact | Company | `/contact` | Internal router |
| status | System status | Company | `/status` | Internal router |
| linkedin | LinkedIn | External | `https://www.linkedin.com/company/vision-xix-labs/` | External new window |
| github | GitHub · Axiom repo | External | `https://github.com/sahme209/axiom-releases` | External new window |
| x | X (Twitter) | External | `https://x.com/VisionXIXLabs` | External new window |

[palette-commands]

## Current evidence and remaining gates

Thirteen actual rendered component cases verify the bounded composition correction using a synthetic Next router/pathname, including three ordinary navigation/Escape/account-visibility controls. They do not exercise live destinations. The current local build passed compilation/types; two delivered JavaScript hashes contain the changed code markers. HTTP delivery and string presence do not prove client execution, browser focus, real OSIME, mobile layout, AT or successful remote navigation. No new test, build, browser or HTTP run was made for this guide. [keyboard-evidence, preview-evidence]

Still required: a genuine browser walkthrough including all command destinations, restricted/private and external behavior, keyboard focus/escape/return handling, input methods, assistive technology, narrow/mobile layouts, approved media and installed/released-version guidance. Full header/footer/mobile controls, account/provider workflows, every global keyboard interaction and the rest of B4/B5 remain outside this finite guide. Customer eligibility and support retrieval authority remain false. Governance, independent human reviews and production controls are unchanged.
