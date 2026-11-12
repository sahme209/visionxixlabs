# GitHub bootstrap public-source review — November12

Owner allowed design preparation and up to three official GitHub documentation pages. Read exactly these three canonical pages; followed no external/key/discovery/source/account links:

- https://docs.github.com/en/actions/reference/security/oidc — native request variables and token permission; supported signed-claim fields; exact subject formats must be selected from actual configuration. It does not prove actual process origin from a name/URL or qualify our future native endpoint/response.
- https://docs.github.com/en/actions/reference/security/secure-use — immutable dependency/source review, injection and secret-log risks; actions/runner are an explicit trust boundary. Do not infer a vetted runtime from a hash string alone.
- https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments — configured rules pass before job dispatch to a runner; this does not inspect our repository's real rules/bypass state.

The first search query used a malformed site qualifier and returned unrelated snippets; none of those sources was opened or relied upon. Subsequent discovery was restricted to docs.github.com. Reopened only the same OIDC page for the native-request section; no fourth canonical page was read. No account/provider endpoint, actual token/key, code execution, workflow/configuration or spending action occurred.

Proposed consequence (inference, NOT a vendor guarantee): separate the native bootstrap-channel trust decision from later cryptographically authenticated/current workload authority. Do not implement the stronger pre-token assertion as a matching environment/hash success. The three-page allowance is consumed. Actual channel values, response profile, keys/protection/native provenance and live acceptance are unqualified.

A fresh independent read-only builder check identified ambiguous substitution wording; the design now limits local rejection to malformed/profile-mismatched inputs and explicitly places same-channel tampering within the compromised-runner boundary. Backend exact signed-claim checks remain mandatory. No product code or acceptance gate changed.
