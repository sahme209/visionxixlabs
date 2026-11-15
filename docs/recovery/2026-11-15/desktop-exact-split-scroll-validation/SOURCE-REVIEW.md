# Independent split-scroll source correction review

2026-11-15. **CLEAR for the narrow local CSS correction.** File-only inspection against `/Users/samirahmed/.codex/axiom-local-backups/20261115-043314-split-scroll-before`. No test, compiler, browser/listener, native, account/provider action or cache mutation by this reviewer. Only this report was written.

The complete desktop stylesheet delta is one declaration: `.engineering-panes { position:relative; display:flex; }` instead of display:flex alone. It keeps the existing inline display:flex/display:none conditional in App, layout direction, scrolling, dimensions, source callbacks and authentication/permission checks unchanged. No focus target, warning, control or screen-reader content is hidden or removed. It establishes a positioned containing block without introducing a z-index or new stacking context.

## Cause supported by source and browser diagnostic

At widths below1100px the existing split workspace stacks two560px panes inside the engineering-panes scroll container. Agent contains absolute-positioned screen-reader-only descendants, including the Conversation label and Request configuration text; their nearby workspace/composer ancestors are not positioned. Absolute descendants can use a containing block outside an intervening overflow container and contribute scrollable overflow beyond that container. A hidden1px label can still have a far-down static position even though its text is visually clipped. Positioning engineering-panes supplies a local containing block so this geometry is contained in the intended pane scrolling context.

The saved actual browser observation is strong differential evidence: at1024×600 document height935 and keyboard focus moved windowY246 while pane scroll was602. A diagnostic that preserved inline display and added only position:relative changed document height to600 and windowY0 while pane scroll stayed602. This supports the containing-block diagnosis and preserves real content scrolling. The saved record does not identify a single exact offending descendant, so this review treats the sr-only labels as source-supported candidates rather than claiming an instrumented element-level proof.

## Acceptance boundary

The diagnostic override was cleared and the approved preview closed before applying this source change. It is not a fresh built-source rendering result. Next validation should reproduce1024×600 split mode and focus the lower Model settings control, confirming windowY stays0, document height matches viewport and the inner panes still scroll. Also check normal single-pane mode, wide split mode, keyboard focus/overlays, short/enlarged-text and both themes. Existing inline display visibility gates must remain authoritative.

No source other than the reviewed stylesheet correction was changed by this reviewer. The prior website build can be reused only with the separately prepared unchanged-web-input proof; the changed desktop CSS needs its own coherent compilation/render review. Full native/provider/Governance and production requirements remain separate.
