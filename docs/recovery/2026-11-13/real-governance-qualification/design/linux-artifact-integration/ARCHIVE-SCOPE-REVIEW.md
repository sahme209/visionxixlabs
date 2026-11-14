# Independent review — pinned source archive scope

Verdict: CLEAR for the conditional owner decision. This is a finite source-evidence acquisition, not library adoption, execution or qualification. No implementation or external request was performed during this review.

## Scope and integrity

The proposal names one official immutable commit and one unauthenticated codeload URL. The previously saved complete recursive tree supplies an independent exact 322-blob/3,751,845-byte inventory. Requiring every file's Git blob digest and length, with no missing/extra entries and no hash replacement, resolves source identity more strongly than trusting the archive root or its newly observed transport hash. The complete source inventory directly covers the known timestamp-origin, executable-constructor and Cargo/build-input questions without a repeated individual-file read loop.

The 8 MiB compressed/16 MiB expanded/1,024-entry/512-byte-path bounds, no redirects/proxy/auth/cookies/retry, fresh private destination and nonexecutable output are appropriately narrow. Rejecting links, special/sparse entries and unsafe extraction avoids granting the archive authority over filesystem coordinates. An export-ignored tracked file remains an explicit incomplete outcome, not grounds for a second automatic fetch.

## Required preparation checks within this scope

These are implementation details of the already stated bounds, not additional external permissions:

- Enforce byte/entry/path bounds while streaming/decompressing, before allocating or saving a claimed member. Include archive metadata/extension records in resource accounting; do not let PAX/GNU long-name or sparse metadata bypass path/type/duplicate checks. Reject unsupported extension shapes rather than silently normalizing them into accepted source.
- Match canonical POSIX member paths under exactly one expected top-level prefix; reject traversal, duplicate canonical destinations, unexpected directory entries and file/directory collisions. Do not use a generic extraction API. Preserve regular source bytes exactly and calculate Git's `blob <length>\0` digest, rather than plain SHA1(content).
- The thirty-second deadline must bound the actual request/body read, and error paths must close the response. Stop after the first request regardless of HTTP, archive or inventory outcome; no redirect follow, transport retry or alternative URL.
- Save only validated source bytes into a newly created owned private destination with nonexecutable modes and no overwrite/symlink-follow path. Treat archive-provided owner/mode/time metadata as untrusted and never apply it. Failed/incomplete receipts must not mark the directory a complete checkout.
- Never import, build, interpret or execute fetched text, including Cargo/build scripts, procedural macros or executable-marked files. Parsing manifests or source as inert text stays within the proposal; dependency resolution does not.

## Remaining acceptance boundary

A successful archive establishes the inspected source inventory only. It does not establish runtime clock accuracy, drift/rate/lifetime bounds, producer identity, descriptor/lifecycle isolation, target ABI, Linux behavior, compilation or execution safety. Those conclusions must come from the actual source argument and later specifically authorized qualification; no broad new gate or guessed guarantee is introduced here.
