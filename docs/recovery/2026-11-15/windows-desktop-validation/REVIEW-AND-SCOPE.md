# Windows desktop validation source

Owner explicitly directs sign-in/download repairs and Windows testing BEFORE returning to Governance. This renews the ordinary Windows desktop testing task; it does not renew any consumed Governance compiler/runtime grant.

Added standard public windows-2022 job,30minute limit, read-only permission, checkout without persisted credentials, Node24, npmci/frontend identity/type/build, locked Cargo unit tests and strict Clippy. No packaging, signing, publication, provider, credential-vault access or Governance artifacts.

Six Rust-file changes are test-only: canonical file URLs and explicit LF Git fixtures, platform-neutral manifest guards enabled on Windows, direct-child stream/size/deadline/cancellation tests, explicit unavailable create/input/observation tests. Existing unsupported Windows implementations still refuse. Windows process descendant custody, actual installed UI, Google pairing, secure-vault persistence, signed installer, upgrade/uninstall and clean machine acceptance are not established here.

Independent release_batch_review source review CLEAR, no Important/Critical findings. Read-only review ran no native tests/account effects. Root confirms full ordinary19669PASS/1expectedfailure/1144skip,1803passfiles106skip, strict root types PASS, desktop release/type/frontend build PASS (warnings retained),36Python CLI PASS. Actual Windows native compilation/tests are NOT yet observed; require actual exact-head CI before merge. No Windows success claim from local syntax/source checks.
