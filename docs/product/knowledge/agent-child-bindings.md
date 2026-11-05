# Agent child controls: static binding supplement

**INTERNAL DRAFT — unpublished. Customer eligible: false. Publication approved: false.**

This supplement binds inert static `data-help-id` family metadata to every intrinsic interactive declaration in eight complete component files. It adds no help navigation, retrieval integration, customer publication, authority or execution behavior. B4 and genuine native/customer acceptance remain open.

The [historical Agent source guide](agent-workspace-controls.md), its authoring ID and original provenance remain unchanged. Inventory entries cross-reference its existing sections without asserting that its older snapshot has been requalified. The original insertion unit started from post-rename-IME baseline commit `41bf7dc4e33066d5eaea3d577f37da3702cf4f12` and is separate from the [46 direct main-view bindings](agent-workspace-bindings.md). `AgentChatView.tsx` was not modified.

| Whole-file scope | Direct declarations | Historical guide coverage |
| --- | ---: | --- |
| `ConversationRename.tsx` | 5 | Rename entry, title, save, refresh and cancel; includes the corrected composition guard in the baseline. |
| `AgentModelSelector.tsx` | 2 | Model search and native select; reusable label-dependent family, not a particular model or entitlement. |
| `AgentMessageContent.tsx` | 2 | Copy code and validated HTTPS message anchor; rendering metadata grants neither clipboard success nor link safety approval. |
| `FileDiff.tsx` | 2 | Previous/next diff-page controls; shared across app surfaces. |
| `AgentApprovedActions.tsx` | 5 | Saved outcome, readiness, prepare, execute once and cancel; metadata never enables these actions. |
| `AgentGithubReceipts.tsx` | 1 | Validated recorded GitHub receipt anchor; mapped instances repeat family metadata. |
| `AgentRestartReceipts.tsx` | 1 | Read-only workflow receipt refresh. |
| `Disclosure.tsx` | 1 | Generic shared expand/collapse trigger; not screen-specific help or evidence. |
| **Total** | **19** | **14 buttons, 2 inputs, 1 select and 2 anchors.** |

The [inventory](agent-child-bindings.json) records exact source/tag, stable family ID, guide section, readable source anchor and SHA-256 of each complete original JSX node. Enumeration covers whole files, including local helper functions and locally authored Markdown render callbacks. Select options belong to their parent select; forms and display nodes are not independently actionable controls. Counts describe source declarations, not a simultaneous rendered state.

IDs under `agent.workspace.*` identify reusable Agent control families. `shared.file-diff-previous`, `shared.file-diff-next` and `shared.disclosure-toggle` deliberately identify generic shared controls wherever these components render across the app. A disclosure ID does not identify its label, enclosing screen, record, permissions or child contents. Repeated instances may carry the same family attribute; these attributes are not unique DOM IDs or operation identities.

Explicit exclusions: the main `AgentChatSession` declarations and every helper/component defined inside `AgentChatView.tsx`; custom imported components and third-party Markdown-generated internals; native clipboard/external-link implementations; settings/editor destinations; service/provider state and backend/tool policy. Locally authored Markdown anchor/copy renderers are included, but this unit does not recursively follow imported components or generated data. No new whole-app or all-state coverage claim follows from this finite unit.

**Historical insertion evidence (before the later functional guards):** Only 19 literal attributes were added to runtime source. Stripping precisely those attributes restores each entire baseline file byte for byte, independently compared against Git. All handlers, keyboard logic, labels, render conditions, state, layout, permissions and approval/execution checks are preserved. No imported API, shared prop contract or dependency changed.

**Historical insertion test run:** Five focused Node/TypeScript AST tests passed under kernel network denial with a scrubbed environment, private HOME/cache and writes restricted to a fresh private test directory. The validator independently discovers every intrinsic interactive declaration in each whole file, checks per-file counts and tag profiles, validates exact original node hashes and checks all full baseline hashes. Adversarial cases reject missing, duplicate, dynamic, unknown, wrong-tag, swapped-field and cross-file metadata; a new unbound control or metadata on a display node also fails. Initial actual unbound source produced three failures/two passes: completeness failed as intended, and mutation tests requiring existing attributes also failed before insertion. After insertion all five passed. Evidence and independent Git comparisons are in `work/agent-child-bindings/`.

This is source-only static validation. No full build, native restart/control, browser interaction, screenshot, provider/network request, database operation, customer walkthrough, accepted media, editorial approval, release qualification or publication was performed. The [source manifest](agent-child-bindings.sources.json) records this supplement's exact source hashes, not customer eligibility or genuine execution acceptance.

## Current local source requalification — November4

Actual Git `18284bd29aad7b663a5ccc908932f3202655632b` retains the original control IDs, purposes, tags and node digests. Only reviewed precommit connection guards changed non-metadata source. The current stripped baseline is derived from that exact Git source; the prior baseline remains in Git history. [Proof](../../recovery/2026-11-04/agent-binding-requalification/README.md). This is unshipped local source, not the current983 native build or customer help/retrieval approval.
