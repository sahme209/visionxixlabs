# Offline refusal: bounded diagnosis

Saved filesystem observation confirms no offline stage, offline success receipt, generation attempt or emission attempt. The offline child emitted the generic exception handler message, not a bounded launch diagnostic.

Source call order in `run_offline_child` is packet verification → fixed context/tools → source Git observations → Git archive → extraction → archived-source validation → offline installation. Since extraction did not leave a stage, there is no evidence that npm installation, Prisma generation or compilation started. This narrows the investigation to pre-extraction validation/Git/archive/extraction, but does not distinguish those causes. A subprocess error without the allowed diagnostic, validation refusal or ordinary Python exception can all reach the same generic handler.

The current log therefore cannot justify changing the sandbox or requesting another identical run. Next implementation should preserve a finite phase code and allowlisted refusal classification in the offline child, with synthetic tests for validation, Git, extraction and unknown exceptions. Do not log exception text, paths, environment or customer data. Preserve all refusal/one-attempt semantics. That diagnostic change must be reviewed before a new frozen execution packet; the consumed packet remains untouched.
