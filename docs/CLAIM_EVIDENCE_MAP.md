# Public Claim-to-Evidence Map

Last updated: 2026-09-29

| Public claim | Allowed wording | Product evidence | Verification class | Limitation |
| --- | --- | --- | --- | --- |
| Downloadable desktop application | Axiom Agent is distributed as platform installers | Release manifest API and public `desktop-v0.1.11` assets | Artifact existence, CI build, publication, independent ARM DMG digest, and disk-image integrity verified | Website production still selects 0.1.9 until the stuck Vercel rollout is repaired; clean-host first launch is not verified |
| macOS/Windows/Linux availability | Name the exact available asset, architecture, and signing state from the current manifest | `lib/desktop/releaseManifest.ts`; release run `36653889931` | Manifest and release-CI verified | macOS 0.1.11 is Developer ID signed, Gatekeeper accepted, and notarized; Windows/Linux remain honestly marked unsigned; clean-host installation is outstanding |
| AWS connection | Assume-role connector implemented; configuration required | `awsValidator.ts`, `awsConnection.ts`, coverage map | Application-side implementation | Live customer account validation unavailable |
| AWS analysis | Preview-grade inventory and security analysis | `awsPreviewScanner.ts`, security scanner | Mock/pure verification | Do not call full live scanning |
| Azure/GCP | Format validation and preview analysis | provider validators/preview scanners | Application-side preview | Live SDK validation/execution not released |
| Execution | Generated Terraform/CLI artifacts are review-only; local apply disabled | execution plan/generator modules and desktop safety copy | Source/unit evidence | No released live cloud mutation proof |
| Approval separation | Review, approve, merge, dispatch, environment approval, and change management are distinct domain capabilities | templates, permission strings, workflow modules | Domain implementation | Server-side/live provider enforcement incomplete |
| Blast radius | Planning kernel batches/rejects scope beyond configured limits | `operationOrchestrator.ts` | Kernel assertions/source | Not verified against released cloud mutation |
| Outcome memory | Prior outcomes can influence later guidance | `outcomeMemory.ts`, `runAgent.ts` | Application-side implementation | Retention/deletion and released journey incomplete |
| Audit evidence | Supported workflows preserve actor/action/rationale/time/outcome records | audit models/services | Partial | Not every journey/export is verified; “audit-ready” is contextual, not certification |
| Tenant isolation | Tenant identifiers and checks exist | repositories and service authorization | Partial | Requires service-by-service and restore-path verification |
| Security/compliance | Describe implemented product controls only | security/permission/redaction/audit modules | Partial | No SOC 2, ISO 27001, HIPAA, or other certification claimed |
| Sandbox | Scripted, isolated, fictional, non-persistent website demonstration | `lib/demo/demoScenarios.ts`, demo guards | Source/build evidence | Not the installed app; no external operations |
| Collaboration/integrations | State the exact action: e.g. notification adapter, preview repo inventory, planned issue write | integration registry plus adapter implementation | Varies per connector | Never equate logo/registry entry with live synchronized workflow |
| Customer adoption | No customer adoption/testimonial claim currently allowed | No approved proof supplied | Not verified | Use release history, docs, tests, and sandbox instead |

Claims move to a stronger verification class only after the exact released build completes the corresponding configured customer journey and the result is recorded in `VERIFICATION_REPORT.md`.
