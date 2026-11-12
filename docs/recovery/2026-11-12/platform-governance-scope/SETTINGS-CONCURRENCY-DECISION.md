# Settings concurrency — owner design decision needed

The approved design requires a source-qualified safe write/currentness profile. Three approved official reads are recorded in SETTINGS-VERCEL-SOURCE-REVIEW.md. Existing-variable PATCH has an observed revision in its response but no documented request-side compare-and-swap in the inspected contract. Therefore the original stronger boundary is not qualified.

Recommended next scope: implement and qualify create-only settings first, never upsert/overwrite. Keep existing-variable updates explicitly unavailable while preserving them as an unfinished master-plan requirement. This permits local code/synthetic and owned-isolated tests only; it does not approve real settings, credentials, deployment or spending. Native pending/unknown reservations and fresh exact independent approval remain mandatory. Absence/read+create cannot itself be called atomic without actual qualified provider semantics.

Alternative: accept a different boundary for updates—Axiom serializes its own actions and checks exact current metadata immediately before one PATCH, but cannot guarantee a privileged external writer will not race between that read and write. This would need a separately reviewed design and explicit acceptance; it is not selected by this document. No overwrite/update implementation or default is authorized here.

Work independent of this choice, including local native reservation and read-only/private workflow preparation, may continue. Do not retire the existing unmanaged entrypoints as a claim of usable replacement or mark settings coverage complete.
