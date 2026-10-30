# Exact TextEdit writability compatibility

Live diagnosis now proves the selected signed TextEdit text area does not return a Boolean AXEnabled attribute. It is not reporting an explicit disabled Boolean. No edit occurred; before text is unchanged.

Proposed narrowly bounded compatibility: retain the exact signed TextEdit process/window, unique nonsecure AXTextArea, document/text binding, foreground handoff, native confirmation, one-use owner/task authority and durable attempt ledger. Read AXEnabled with its actual AXError. Explicit false, wrong type, denied access, timeout and unknown errors always refuse. Only the specific documented attributeUnsupported result may be accepted, and only when AXUIElementIsAttributeSettable positively confirms AXValue is writable. A missing/failed writability query always refuses. Recheck this capability at preparation, current-target checks and immediately before the one write.

This changes the prior requirement for a literal AXEnabled=true and therefore needs the user's validation-first boundary review before execution logic is changed. No generic fallback, application activation, arbitrary app/window, password field, background input, extra permission, automatic retry or saved-document exception is added. The already approved exact disposable before→after test remains the only live effect authorized and has not been consumed by a dispatch.

Validation plan: pure Swift matrix for true/false/unsupported/error combinations, fixed privacy-safe diagnostics, frontend/Rust/native compilation, independent review and one real exact test only after successful native preparation/confirmation. Local implementation only; no Vercel or public installer change.
