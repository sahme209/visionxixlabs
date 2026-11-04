# Local Governance document replacement frontend — source-only unit

Base `f5bca40030864141abe6d42303d2bc2fcd0ce9dd`. Branch `codex/governance-document-replacement`; isolated worktree `/private/tmp/axiom-governance-document-replacement`. No canonical runtime files changed.

Separate replacement component offers explicit saved-document selection, historical artifact validation and deliberate current-head metadata load. Fixed original name/scope, server-returned CAS version and exact local replacement bytes are reviewed separately; metadata/counts are not old document text. Source digest comparison is content identity only, not snapshot freshness. Version999 stays read-only. File/head/target changes clear review. Submission captures one UUID and tuple; any unavailable outcome holds for the original read-only lookup, never resends. Found-false/error stays held; found-true confirms historical original only. Parent locks refresh/target controls while busy/held; context remount aborts and discards private pending bytes with no persistence or restart-recovery claim.

Initial uploader, App/Settings/DEV identity mounts, feature flags, backend policies and transport effect classification are unchanged. Existing POST Governance read path remains a read effect. Actual mounted preview remains read-only; mocked broad-identity components do not establish native acceptance or authority. Feature disabled503 leaves replacement unavailable, with no initial-upload fallback or flag-enable instruction. No original raw document text is read/disclosed.

## Verification

- Initial `red.log`: two missing-method behavioral failures plus one incomplete mock-identity fixture exception. The fixture exception is not behavioral RED.
- Corrected fixture `red-corrected-fixture.log`: three behavioral failures (missing parent control and missing client method); exit1. This precedes production changes.
- Final `frozen-focused.log`:15 mocked UI/client checks pass; exit0. `first-green`, `expanded`, `green`, `final-focused` preserve intermediate iterations. Expanded failure was ambiguous checkbox test selection, corrected to exact review label.
- `compat.log`:22 existing initial-upload/intelligence-client checks pass; exit0; not rerun.
- `desktop-types.log`: full production desktop/src types pass; exit0.
- `test-types.log`: test-only tuple/cast typing failures; corrected test annotations in `test-types-corrected.log` pass; exit0. Focused15 rerun after those test-source changes, with unchanged production bytes.
- `frontend-build.log`: one attempt exit1 because runner cwd was repository root, causing Tailwind to select the root config and reject existing desktop/styles.css122 `bg-axiom-surface`. This is retained as a configuration/runner failure, not a passing build or new-code regression. Corrected existing runner cwd to `desktop/`, without source/config/dependency changes. `frontend-build-corrected.log` exit0 records the single corrected frontend attempt; session96087 ended. Initial failed session9593 is retained separately; neither was a Rust/native build. No passing build was repeated.

All commands use existing pinned local dependencies; cleared synthetic environment and kernel network denial protect canonical and pinned cache writes. No provider/auth/DB/server/API/native/browser/credentials/Keychain/Security/helper/Rust/restart/909/AI/install/push/integration operations occurred. The Vite command is frontend-only; no user previews were touched. Test mocks never invoke actual metadata reads or storage. No full suite or model evaluator run.

Exact current source hashes are in `source-hashes.json`; raw commands/configs/exits/logs copied here. Runtime code is frozen READY for independent review. No push/integration.
