# Native decision refresh after Settings

The real one-call rejection acceptance on source 9e331244 left a pending single-file proposal visible after Settings → Agent, although Governance had no pending action. The existing manual read immediately displayed `commit_github_file was rejected.` No approval/write or further inference occurred. The single call settled for 2 cents (158 → 156 cents, 17 calls, zero held/pending), and the GitHub calculator blob remained f643dbe6c99109a8d06d57bf5c1f4b2c348b4ae8.

A regression reproduces the missed return read when document visibility is hidden. Previously the silent return used the same hidden-document suppression as background polling. Explicit internal return now permits one owned, coalesced read even while hidden; interval/focus background reads remain suppressed. Context/epoch ownership, approval enforcement, queue pause and no-execution semantics remain intact.

Focused 94 Agent tests pass, including visible/hidden return and hidden polling suppression. Fresh independent native rejection acceptance after this fix is not claimed: its one paid-call authorization is consumed. Test fixtures are not provider success. Production 9e331244 remains unchanged until release gates pass.
