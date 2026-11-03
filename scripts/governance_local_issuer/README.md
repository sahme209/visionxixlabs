# Local issuer package observations

This package **does not provide an executing issuer identity**. It constructs and verifies a bounded file-set observation, and performs a fail-closed launch preflight. `packageDigest` hashes canonical package metadata; it is never an `issuerArtifactDigest`, launch capability, fleet proof, credential grant or activation permission.

`materialize.py` accepts the exact successful build receipt and copies fixed Next runtime inputs, every traced support path, all materialized dependencies and the actual Node binary into a new private output. Original `.nft.json` paths are resolved against the original successful stage and its declared dependency boundary, then relocated inside the package. Before/after trace hashes are retained in the separate construction receipt. Compiled executable bytes are not rewritten or rebuilt. Outside, missing, cyclic or ambiguous inputs refuse; new workspace code is not silently adopted. Required sensitive files refuse rather than being omitted.

Run isolated tests from repository root:

```sh
python3 -m unittest discover -s scripts/governance_local_issuer/tests
```

The output parent for materialization must already be an owned, private directory (mode 0700). Creation of both manifest and construction receipt is exclusive/no-follow; existing manifests permit only an exact read-only idempotency check. Receipts live outside the executable package. No user environment dump or private configuration is copied.

Legacy profile `next-start-darwin-arm64/1` retains 250,000 trace entries. Explicit isolated-build profile `next-start-darwin-arm64/2` permits 512,000; all other limits are unchanged. Manifest format remains `axiom.local-issuer-package/1`. `manifest.py` is the schema source. Canonical JSON sorts fixed ASCII keys with compact separators and UTF-8 encoding; path arrays use ASCII byte order. Profile 1 refuses non-ASCII paths rather than assuming cross-language case equivalence. Provenance has exactly `sourceRevision`, `archiveSha256`, `buildReceiptSha256`, and `materializationReceiptSha256`. Runtime fields declare the intended Node/platform prerequisite, not proof about a running process. Closure fields deliberately keep `privateBootstrapConsumer` and `executingIssuerIdentity` unavailable.

Limits apply before/during reads: 250,000 total regular/directory/symlink entries, 32 MiB path data, 2 GiB per file, 8 GiB total file data; 4,096 traces, 8 MiB per trace, 64 MiB total traces, 250,000 legacy or 512,000 isolated trace entries and 32 MiB trace target paths. Manifest reads are capped at 64 MiB; required-server metadata at 8 MiB. JSON duplicate keys, partial/changed reads, missing files, unlisted files, mode changes, hardlink aliases, unsafe links, collisions and special files refuse. Recognized PEM scanning is stateful across all chunks: header, arbitrary whitespace, then 64 base64 bytes. Quoted crypto parser header literals are not key material. This is **not a generic secret detector or a guarantee that a file contains no credentials**.

`seal_probe.py` creates a tiny owned data-only read-only image, tests actual `ST_RDONLY` and `EROFS`, detaches in `finally`, and separately probes one sandboxed child's backing-file write denial. It does not launch Next or qualify a process/consumer. `launcher.py` never imports or executes application code: it remains unavailable while the compiled private consumer, canonical same-module verifier and complete controlled process/loader/native profile are missing.

Apple libraries served from the dyld shared cache are explicit **trusted-host prerequisites**, not hashed JavaScript closure or host attestation. Native unresolved dependencies refuse materialization. Source/build receipts, file-set observations, kernel control probes and actual verified executing identity remain separate. Current production issuer wiring is untouched.


The isolated CLI path uses `--completed-build-observation`, `--build-run`, `--stage`,
`--repo`, `--cache-source`, `--bound-engines`, `--generation-run`, `--node`, and
`--destination`. It independently rechecks current source/generated/Node/output
inputs against the original compiler-exit record and separate successful read-only
observation, preserving the original failed observer result. It requires canonical
real stage dependencies and archive-owned local-package links. The legacy
`--build-receipt` path retains its old symlink/receipt boundary. No ready boolean or
receipt constructs executing identity. Both paths retain required private Next
framework metadata and the existing sensitive-file/PEM refusals, without claiming
a generic secret detector. No credential values are printed.

Native linkage uses actual typed LOAD commands, distinguishing install IDs and
recording all unsupported/missing/escaping search contexts. Only unique contained
parsed dylib targets and declared macOS system prerequisites are bound. Dynamic,
inherited, search-context and runtime qualification remain unavailable. Source and
binary bytes are not patched to manufacture a successful native profile.
