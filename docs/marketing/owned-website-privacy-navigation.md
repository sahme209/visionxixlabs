# Owned website first-visit consent and documentation timeout observations

Actual prior screenshots showed the first-visit privacy dialog still open. The
fixture now waits for existing playback readiness and the exact privacy dialog,
selects its actual Essential only button through the existing geometry/hit guard
and real CDP mouse press/release, and observes the dialog absent before the first
screenshot. The closed phase is now `playback_ready_after_essential_consent`; the earlier document-before-playback phase remains recognized only for historical receipts. Application consent code owns persistence; the driver never seeds
storage, hides DOM, invokes handlers or selects optional analytics. Closed
`essential_consent_control` and `essential_consent_selected` tokens record this
step without page content. Existing 11 interaction assertions and their deadlines
remain; the unchanged absolute session bound still caps all work.

Only a documentation wait's original website_dom_timeout triggers a final read of
three booleans: pathnameIsDocs, executionPresent and tourPresent. Failed/malformed
observations remain null; unknown fields, getters and non-booleans are rejected
by the public projector. The original failure is rethrown unchanged. No URL,
header value, page text, provider result or exception payload is published.

No proxy/header change is included. Pinned Next sends routing/prefetch headers
that the current proxy drops; its server can also validate an RSC cache hash and
redirect mismatches. Missing router state is supported by rendering, so those
facts alone do not prove the observed navigation failure. The new observation
locates the stalled page boundary without bypassing actual Next Link navigation.

Two new inert tests failed before implementation. Final 32 tests across privacy/
navigation, pointer geometry, operation diagnostics and CI projection pass, with
scoped ESLint, syntax and whitespace checks. Existing VM receipt bindings include
the new nullable observation. These tests use fake DOM/CDP state and execute no
browser, server, listener, provider, database or production operation. A fresh
integrated browser receipt remains required; no runtime success is claimed.
