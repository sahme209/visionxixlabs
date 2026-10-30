# Bounded transport refusal diagnosis

Fresh note7292 was independently approved and executed once, then recorded refused/version3/attempt1. Never replay it or create a child chain. The exact note absence proof passed before preparation. The refusal's precise cause remains unconfirmed.

The transport previously swallowed every pre-dispatch error into refused with no phase. Local diagnostics now report only fixed code-defined phase names, caller-aborted and deadline-expired booleans. They contain no error strings, candidate IDs, payloads, credentials or provider responses. Logging failure cannot affect execution. Authority, 15-second transport budget, native checks and one-attempt semantics are unchanged. The request composition logs this bounded report on refusal. 25 transport/composition checks passed, including secret-free reporting and failing logger behavior.

Not deployed. This change alone is not claimed to fix the underlying refusal, and authorizes no further attempt. A concrete live diagnostic path and rollout approval are still required before another production change.
