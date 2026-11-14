# Independent conditional build design/preparation review

Verdict: **CLEAR as a conditional design after independently verified provenance clarification. NOT an accepted execution packet.** No build/compiler/runtime/native/SQL/browser/provider operation performed. Actual executor is not implemented/reviewed by this checkpoint.

## Verified prepared candidate

Read REVIEW.md, CANDIDATE.json and private SOURCE-MANIFEST.json; streamed every archive member without extraction or execution. The compressed snapshot SHA256 is `96a7d10c6190e30a4f7ecf2ad2bff18bb70a117e00314269c68307bb7a9d0c46`. All 13,933 members are regular files, unique, relative and without traversal; exact member names and every SHA256 match the private manifest. Total uncompressed source bytes:183,932,294. No dependency/Git/root-work/loaded-env member was found; tracked .env.example remains source template only.

Private SOURCE-MANIFEST.json SHA256: `ac3fb341c9f7508662054cbab04f51d921e70e2f18d211b8226ee7d91495126b`.

Independently reconstructed the accepted source union in this exact order (later entries supersede overlaps):

- `docs/recovery/2026-11-14/native-time-behavior/host-joined-local/SOURCE-MANIFEST-v2.json` → `inputSha256` (13 entries), receipt SHA256 `496a9cd26310fb681fb964e7287fe67d3ffad2e3c44613530c008743741d4660`.
- `docs/recovery/2026-11-14/native-time-behavior/host-joined-local/production-operational-local/ROOT-FINAL-SOURCE-MANIFEST.json` → `files` (61 entries), receipt SHA256 `f87f8db51ae769fef64f1cdfdfdbd27492960af68d2ae5e563e15475f168dbb4`.
- `docs/recovery/2026-11-14/calm-instrument-presentation/LOCAL-RESULT.json` → `sourceFiles` (6 entries), receipt SHA256 `97d6594c14a12822d67e2c4a13d6ed217d62e158456cc43dab76f8b6fa7a971d`.

The union has80 exact paths. All80 hashes match the archive manifest and current runtime source. Current modified and untracked source under app/components/desktop/lib/packages/scripts has no path outside that accepted union. Later progress-document changes are not silently required to match this earlier immutable source archive.

## Clarification to preserve before asking

CANDIDATE/private manifest currently record acceptedDeltaFiles only as80, with no machine-readable accepted-manifest paths/keys/override order. Add a separate append-only PROVENANCE.json containing these three exact receipt paths+hashes+keys, override order and resulting80-path hash map. Do not rewrite the frozen archive/private manifest. This reviewer has verified that relationship above; the missing explicit linkage is an audit ambiguity, not a discovered byte mismatch.

## Finite executor requirements already consistent with this design

The proposed commands are the existing website build (contract→Prisma generate→production native TypeScript check→Next webpack build) and only after website success the existing desktop build (release check→desktop types→Vite). Prisma schema outputs to staged .prisma/client-source. No migration/Tauri/Rust/signing/installation/restart/preview or actual qualified issuer is selected. One shared30minute active-child budget and <=5seconds owned cleanup, no retry, is a coherent conditional allowance.

The actual fixed executor/input review must make the following concrete before the sole attempt; these are implementation prerequisites, not additional research or authority:

- Exact Node/npm/compiler/engine/cache realpaths and hashes, sanitized allowlisted environment and stage-only write paths; no inherited .env/account/token/production URL, downloads or permissive fallback. Freeze network-denial and outside-stage write-denial enforcement before child launch, including descendants; do not substitute after-the-fact hash comparison for prevention.
- Exact staged dependency namespace and executable resolution. The current @axiom/verified-issuer-runtime symlink points into the live checkout, and desktop node_modules points into the existing original checkout cache. Stage owned aliases/copies required to resolve the file dependency to archived staged source and preserve exact Zod/package identity; shared cache stays read-only and unchanged. No hand-edited lock/pin renewal or install. Any missing prerequisite stops before a build attempt.
- Safely extract only this verified member set (no links/extra/traversal), use fresh owned stage/home/cache/temp, enforce remaining shared budget for the second command, own/reap the child group, retain bounded full-success/failure/unknown evidence and output hashes, and skip desktop if website does not pass. Uncertain cleanup consumes/stops the attempt.

These mechanics are deliberately not invented or accepted here: the final executor plus exact input/tool/filter packet still needs independent review before running. Archive coherence does not mean a dirty snapshot is a green CI head, and build success will not establish rendered visual/native acceptance, production schema compatibility, Governance completion or publication authority. The previously blocked file-URL showing remains blocked and is not bypassed.


## Provenance clarification verified

Root added separate PROVENANCE.json without changing the immutable candidate/archive/private manifest. Independently checked all three declared receipt hashes, fields/counts and ordered reconstructed union: exact80-path map matches acceptedSourceFiles and every archived source hash. The preparation ambiguity above is CLOSED. PROVENANCE.json SHA256: `30bf27a6260a94d46ce995aee5333754cf23b96a6b930e7086b7593ee565af08`. No remaining design blocker found; exact executor/input packet review and fresh owner authority remain required before the sole build attempt.
