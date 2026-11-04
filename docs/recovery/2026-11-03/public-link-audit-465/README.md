# B6 local one-hop public destination inspection

Inspected 38 unique public destinations derived from six local preview pages (source465d4ef0).35 returned HTTP200 and no response set cookies. Three returned the preview proxy's explicit redirect refusal: Azure/GCP source redirects to /integrations; /docs/architecture source redirects to /docs/releaseops. Both target pages were included among successful responses. These are intentionally blocked preview redirects, not verified website defects. Nine external/account/fragment-only destinations were excluded, not requested. No external requests, authentication, forms, provider writes or installer downloads occurred.

This is finite static-anchor/HTTP coverage, not browser rendering, click/keyboard/focus, fragments, deeper nested link coverage, accessibility, responsive/media/performance or new-source acceptance. Existing source465 preview was reused; no rebuild. Public link checks do not complete B6.
