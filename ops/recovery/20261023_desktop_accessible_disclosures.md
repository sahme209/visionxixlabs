# Native-accessible desktop disclosures

Native accessibility activation did not expand the Agent configuration summary. Cloud enrollment and diagnostics used the same summary pattern. Coordinate control was unavailable, so no claim of successful native expansion was made.

These three controls now use explicit buttons with `aria-expanded`, `aria-controls`, unique panel IDs and visible focus outlines. Collapsed panels are hidden from keyboard and accessibility navigation but remain mounted, preserving existing form state and effects. Expansion grants no permissions, changes no targets and starts no OAuth action. Profile selection remains local and is intersected with current service policy.

The integration introduction and repeated connection-instructions card are condensed into helper text. Provider actions, cloud forms, consent qualifications, diagnostics and the accepted web cockpit remain intact.

The new native-control regression failed before the change. All 127 focused component checks pass, including Agent profile/streaming/draft behavior and connection ownership/refresh. Existing tests now open the disclosure through its visible button before interacting with hidden profile controls. Independent review found no blocker. Native artifact acceptance remains required before claiming the controls work in the installed app.
