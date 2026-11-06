# Source-read failure diagnostic completion

1. ~~Preserved both consumed refusal attempts without retry.~~
2. ~~Confirmed latest error is inside source-input reads, before archive phase.~~
3. ~~Four new synthetic cases reproduced missing Git-outcome and error-class information.~~
4. ~~Added bounded Git operation/exit/category on original nonzero result, only in existing explicit private-scratch path. Reads at most8192stderr bytes; never serializes raw text or arguments.~~
5. ~~Offline diagnostics now classify known actual builder refusals and finite Python/OSError causes; strict CLI type/value checks reject forged fields.~~
6. ~~Final6Git+23StageA tests PASS with DeprecationWarnings treated as errors; independent source review found no important defects.~~
7. **Open:** real cause and artifact generation; no new actual run authorized or executed.

Initial green run emitted a regex escape DeprecationWarning; raw-string correction made before the final29-test run. No full repository suite or actual vendor/OS operation. Source tests mock subprocess boundaries and use synthetic inputs.

`developer_tool_dispatch`, `ownership_refusal`, `repository_unavailable`, `os_access_refusal`, and `revision_unavailable` are heuristic categories of bounded stderr, not proven root causes. Unknown messages remain unclassified. Operation labels contain no revision, repository or argument values. Nonzero outcomes still raise the original exact_git_read_failed refusal; success operations and existing timeout/sandbox/currentness/one-attempt rules are unchanged. Known builder classes are explicitly selected because each loaded builder has its own exception class.

No permissions, schema, credentials, real Git/npm/Prisma invocation, installation, deployment or spending. Botha5/0204 remain consumed and their receipts immutable. Fresh execution would require exact new source/packet review and specific authorization.
