# Docs contents breakpoint focus — local repair

The existing contents panel is visible on wide screens even when its narrow disclosure state is collapsed. Narrowing could hide a focused guide-search field/link without moving focus; widening could hide the focused narrow-only disclosure button. Two actual-component assertions reproduced those failures, while outside-focus and expanded-panel controls passed.

A bounded media-query listener now moves focus from a newly hidden collapsed panel to its visible disclosure, or from the newly hidden disclosure to the visible guide search. It preserves outside focus, search text and the open state of expanded contents. Modern and legacy listeners are removed on cleanup. Existing route-change, Escape and composition handling remain unchanged.

Verification: RED 2 failures/2 passing controls, GREEN 4; six existing disclosure and two existing IME checks pass; scoped types and independent review pass. The harness is isolated and network-denied with only owned temporary/cache writes. Receipts preserve the failing and passing results. This is rendered component evidence with simulated media-query changes, not actual CSS-layout/browser/assistive-technology acceptance.

This is within the already approved whole-website usability/accessibility work and changes no authentication, permissions, provider action, AI, data or production boundary. No provider/browser/native action, full build, deployment or spending occurred in this focused unit. The previous full build of source836 remains historical; final packaging of this later UI change is separate. Existing source guides will be rebound to the new revision before claiming current source coverage. The master B4/B6 and full project requirements remain open.
