# Internal source guide: Skip to content

Source: `components/Navigation.tsx`, shared public marketing navigation. This internal guide accompanies the local source change; it is not customer publication.

When keyboard focus reaches navigation, the first focusable control is the native “Skip to content” button. It is visually hidden until focused, then displays a white surface, black text and orange focus outline. Native button activation calls the existing navigation disclosure close states, finds the document's current `main` element, and focuses it with normal native focus/scroll behavior. If no main exists, activation safely ends after closing disclosures. Existing main IDs and tabindex values are preserved; only a missing tabindex receives `-1` to make programmatic focus possible. The backdrop wrapper remains navigation's first child, preserving the mobile dialog containing-block boundary.

The control reads or sends no customer data and changes no permissions, provider state, consent, route or hash. It makes no backend request. The mobile modal retains its existing focus trap and inert header; the bypass is intended to avoid entering repeated navigation, not to add an escape from inside the modal.

Automated evidence: five focused jsdom behavior tests, twelve existing Navigation checks and scoped TypeScript passed. Actual keyboard traversal/Enter/Space in supported browsers, visible focus/contrast/rendering, mobile modal behavior, focus scroll placement below fixed chrome, and screen-reader announcement/reading position remain for browser and assistive-technology acceptance. No WCAG compliance conclusion is asserted.
