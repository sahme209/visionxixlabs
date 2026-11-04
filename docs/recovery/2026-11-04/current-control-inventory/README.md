# Current source-control candidate extraction

Fresh extraction at c4d94cb3:757tracked TSX files,2688source candidates (989desktop/1699website),1271dynamic or missing labels. This is not a count of unique visible controls, supported customer features or completed documentation. Every record remains needs_runtime_and_documentation_review. The unchanged extractor intentionally writes stableHelpId:null and does NOT evaluate already-mounted help metadata; null does not mean no binding exists.

The old4c2143 snapshot (749files/2602candidates) and canonical source-control-candidates.json remain byte-identical. The new summary shows8added files and47previous source files with changed bytes, reinforcing source-version review rather than inferred current eligibility. Counts from different revisions must not be summed into completion evidence. Native/OS controls, custom wrappers outside the extraction set, generated controls, reachable states and runtime/media/editorial/customer review remain separate.

## Actual execution and integrity

The existing extractor was copied to a new private directory with exactly two operator configuration substitutions: canonical input root and separate owned output path. Reversing just those declarations restores its original exact bytes/hash. TypeScript was read from the existing installed dependency through a read-only source reference; no dependency installed and no application module executed. Scrubbed environment/Node24.21.0 and kernel network denial were retained.

First startup stopped at Git opening /dev/null under the all-external-write denial; no inventory output or source parse completed. Original failure/profile/log/receipt are preserved. After verifying /dev/null is its root-owned character device, an independently reviewed v2 profile allowed only that normal stdio sink in addition to private-directory writes. Repository writes and network access stayed denied. The corrected run exited0 and all757emitted file hashes matched current source afterward; HEAD, original script and historical inventory were unchanged. Exact output hash and checks are in postflight-v2.json.

Fresh-context read-only post-review found no important issue; tests/scanner were not repeated. This ordinary source audit is not the pending native Security experiment, custody/issuer qualification, provider call, database fixture, build, browser/native acceptance, production change or publication. Use the separate artifact as a review queue, not customer help authority. SourceCommit binds the stated input snapshot, not later changes.
