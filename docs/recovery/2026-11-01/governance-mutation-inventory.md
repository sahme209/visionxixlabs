# Source-backed mutation inventory — coverage preparation

The application still refuses Governance enrollment: a working selected coordinator cannot prove that alternate mutation paths are covered. This inventory makes the actual source review traceable before any registration or activation.

The parser read3,248 TypeScript/JavaScript files in its explicit runtime-root set and hash-inventoried21 Rust/Swift files for separate manual review. It found237 explicit potential-write syntax occurrences,57 unresolved sends and many generic method-name candidates (mostly not yet distinguished from local state, database and other operations). These are source candidates, NOT confirmed provider effects, bugs, reachable features or security holes. All14,484 candidates remain unreviewed and issue no authority. There were no parse errors. All source hashes and candidate-ID uniqueness were independently checked against the worktree after generation.

The parser supports named/namespace SDK aliases, computed send syntax, literal methods in common HTTP wrappers, imported HTTP aliases, computed/spread/conflicting method uncertainty and parse-error reporting. It strips URL userinfo/path/query from its endpoint metadata, retaining host only. It never imports inspected application code as executable code or invokes a provider/database. The runner restricts source reads to ordinary files inside the checkout and atomically writes its private report.

Nine fixture tests pass; the initial empty extractor failed before the implemented behavior. Independent source review found no important issues. No application runtime changed, so this tooling increment does not justify repeating its unchanged passing production/native builds.

## First reviewed priorities

`governance-mutation-review-priorities.json` binds the current source hashes and matching candidate IDs for the modern GitHub transport, contained raw-PAT transport, legacy IAM writer, and platform CloudFormation-template hosting. It is only a review queue, never an activation receipt.

The template host's S3 CreateBucket/PutObject calls publish the platform's static connection template using its broker account. That context must be reviewed separately; do not blindly classify it as a customer deployment or exempt it from security controls. No AWS call or denied action was retried. Other HTTP/SDK callers and native writes still need end-to-end authority/scope tracing.

## Next core acceptance

Trace every high-signal transport and its callers to canonical tenant/resource authority and actual before-claim/final-write checks. Group proven local-state/database false positives without silently authorizing unresolved calls. Keep source hashes attached to classifications and invalidate them after source changes. Establish a closed, reviewed execution catalog only after these real paths and unsupported refusals are proven. Then compose transactional enrollment and positive/negative real-store journeys; never feed this unreviewed JSON or a test Boolean into readExecutionCoverage.

Remaining limitations include shadowed bindings, variable/indirect commands, reflection/generated code, semantic wrapper behavior, operational workers outside the declared roots, and manual native-language review. A complete source list is not complete execution coverage. Full Governance and the overall project remain unfinished.

Artifacts: governance-mutation-source-candidates.json, governance-mutation-review-priorities.json. Evidence: /private/tmp/axiom-mutation-inventory-{red,green,final-tests}.log and /private/tmp/axiom-mutation-inventory-summary.json. This is private internal recovery/review material, not customer support content or public marketing.
