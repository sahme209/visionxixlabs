# Prepared event-time pointer observation (not integrated)

Existing #196/#198 receipts cannot distinguish layout/viewport drift from anchor replacement. This isolated helper records at most one passive pointerdown, pointerup and click sample per installation. At event time it observes current anchor identity, original-anchor replacement, hit/event-target category, bounded client coordinates, current rectangle, scroll and layout/visual viewport values. It does not dispatch, prevent events, navigate, wait or change deadlines.

Hit testing uses original validated coordinates; only stored evidence is rounded. Fields contain no DOM text, arbitrary URLs, input values or credentials. Independent review found no blocker for this unintegrated helper; 16 focused observation/geometry/click/privacy tests passed. Web TypeScript passed in the diagnostics branch. This is preparation, not acceptance evidence or a root-cause fix.

Before integration: include the helper in immutable source hashing, bind installation/reading to documentation interaction, project its closed schema through the public sanitizer with accessor/privacy tests, and independently review full fixture integration. Any CI publication requires exact push authorization. Retain genuine pointer input, existing timeouts, destination assertions, browser isolation and security controls. No production code changed.
