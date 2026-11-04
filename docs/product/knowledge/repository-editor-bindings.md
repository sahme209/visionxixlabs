# Repository editor static control bindings

**INTERNAL DRAFT — unpublished. Customer eligible: false. Publication approved: false.**

This supplement binds static `data-help-id` metadata to actual controls in the mounted `RepositoryWorkspaceView` editor unit. It does not publish customer help, add authority, qualify a release, or complete master B4. The original [27-family source guide](repository-editor-controls.md) and its historical source manifest remain unchanged.

The finite [binding inventory](repository-editor-bindings.json) records each ID, source file, guide family, actual element tag, source anchor and SHA-256 of the original exact JSX node. It covers 22 of 27 families through 23 literal JSX declarations. Family 6 has separate `repositories.editor.file-row` and `repositories.editor.changed-file-row` declarations; each value may repeat across rendered rows because these are family metadata, not DOM IDs or file identities. Family 27 covers only the Ask Agent entry button.

Remaining unbound: families 7–9 use shared confirmation buttons with dynamic labels; families 24–25 live inside shared FileDiff pagination. Family 27's Prepare Agent draft confirmation and its Cancel also remain unbound. No shared dialog or FileDiff props, behavior or nodes were changed. Checkout acquisition, branch/sync and commit/publish controls are outside this supplement.

Only static attributes were added to runtime source. Removing those exact attributes restores the baseline file byte for byte. No handlers, state, labels, focus, layout structure, permission checks or approval boundaries changed. The original node hashes also check that every attribute sits on its exact existing control rather than a wrapper or a similarly named field.

Validation: focused Node/TypeScript AST tests ran under kernel network denial. The binding test failed before attributes were added (all 23 declarations absent), then all four tests passed after addition. Negative cases reject missing, duplicate, dynamic, unknown, wrong-tag and swapped-field metadata. A full-source baseline SHA-256 check proves attribute removal restores the baseline bytes. No full build, native restart, screenshot, provider request, network request or customer walkthrough was performed.

Exact source hashes for this supplement are recorded separately in `repository-editor-bindings.sources.json`. Neither those hashes nor the AST checks assert native execution or customer eligibility.
