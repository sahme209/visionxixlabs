# Local repair of v0.1.22 native Swift availability failure

Authorized run 41224761240 attempt 2 reached real build steps. Both Mac jobs failed in AxiomWindowObservation.swift at MainActor.assumeIsolated, which requires macOS 10.15. This is a native compilation failure, not Apple credential or notarization rejection. Linux succeeded; Windows was still building at this receipt.

Before editing, full two-file Swift typechecking for x86_64-apple-macosx10.13 reproduced the same two availability errors (exit 1). The build script propagates the framework's deployment target into swiftc; its fallback value does not override an explicit older target.

The local correction marks only the focus-monitor implementation as macOS 10.15+ and guards the exported subscription on the main queue. Older systems return inactive focus (false), without loading that monitor or granting computer input. Existing macOS 15.2 observation/input capability checks, one-attempt/native confirmation/foreground checks are unchanged. The app's general minimum OS was not raised.

Corrected x86_64-apple-macosx10.13 full two-file typecheck passed, with no diagnostics. Corrected ARM arm64-apple-macosx11.0 full two-file typecheck also passed with no diagnostics. Independent source review found no important defects; linker/runtime behavior on older hosts was not tested. This is local-only; the immutable retry source/tag is unchanged. No additional CI, signing, publication or spending authorization is inferred.

Logs: /private/tmp/axiom-v122-swift-baseline.log and /private/tmp/axiom-v122-swift-corrected.log. Failed job IDs: Intel124929243828, ARM124929243832.
