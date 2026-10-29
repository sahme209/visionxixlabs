# Coding stage completion must reflect confirmed work

Repository read failure now fails `code_read` before paid proposal generation. Missing credentials/metadata/patch, invalid or inapplicable patches and unsuccessful PR responses now fail `code_pr_open`; they no longer report a successful simulated step.

A failed PR request may follow a successful branch write. That result reports an unknown repository write outcome and directs inspection of the run branch; it does not claim the repository was untouched or automatically retry. Confirmed successful responses retain the existing PR number and URL behavior.

The generated PR body describes the configured approval gate without claiming two distinct humans: authenticated API keys can be approval principals. The historical registration function name remains for compatibility, with comments corrected to describe the real executors.

Four RED regressions reproduced the old successful fallback behavior. Five focused tests then passed, including confirmed success preservation and unknown partial-write reporting. Full regression suite: 9972 passed, zero failed, 107 skipped. TypeScript passed. Independent review found no blocker. Final build and production release status are recorded separately.

This does not prove a real GitHub write journey, replace the legacy global GitHub credential with tenant installation authorization, execute a repository's test suite, or resolve stalled historical pipeline runs. No external GitHub mutation, paid model call, existing-run reset or cockpit change was performed for these tests.
