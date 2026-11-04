# Full release intake owns its desktop context

The old full form survived an account/workspace context replacement even though the ticket-first form already had context reset handling. Its update/submit/completion checks only tracked flight/mounting. Actual regressions reproduced stale-handler submission and old-context completion effects: eight failures before repair,20 compatibility cases passed.

The parent now observes both the context revision and configuration object, hides a form whose captured owner no longer matches, resets revision/read ownership and remounts with the context key. The child synchronously checks its captured configuration/revision at update, submit, result, error and final UI changes. Config-only replacement is covered separately from numeric revision changes. This changes existing draft isolation, not approvals or backend authority.

The first partial repair had22passes/six failures and is retained as a diagnostic, not acceptance. The final focused suite passes28/28; full desktop noEmit types pass under network denial/private temporary writes. Root independently compared exact payload, validation, submission-ID declaration and service-call construction against23ceb1e0: unchanged. Original already-submitted work is not cancelled, replayed or declared failed by losing its UI context. Returning to the original workspace may require inspecting saved requests; no durable recovery or current native acceptance is claimed.

## Documentation boundary

The29/52 source maps and intake article r1 still pin runtime19821435. This repair changes that source, so their earlier integrity results are historical and must not be presented as acceptance of this newer runtime. Preserve the article revision and frozen24 evaluation inputs; requalify mappings explicitly in the next documentation batch, with a separately versioned article when needed. No retrieval evaluation, production deployment, provider request, native restart, credentials or database work occurred.

Process logs are stored as verbatim text in `.log.json` envelopes with original filename and byte digest; original raw logs remain in the owned work directory.
